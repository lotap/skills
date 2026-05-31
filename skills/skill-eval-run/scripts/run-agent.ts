#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse } from "npm:valibot";
import { TimingSchema } from "./lib/schemas/timing.ts";

function help(): never {
  console.error(`Usage: run-agent.ts [OPTIONS]

Run an agent via opencode run --format json and capture wall-clock
duration and real token counts from the session database.

Options:
  --prompt TEXT       Task description for the agent (required)
  --output-dir PATH   Directory where agent writes output files (required)
  --model NAME        Model identifier (required)
  --timing-file PATH  Output path for timing.json (required)
  --dir  PATH         Working directory (default: .)
  --skill PATH        Path to SKILL.md to load (omit for baseline)

Exit codes:
  0   Agent completed
  1   Agent failed or errored
  2   Invalid arguments
`);
  Deno.exit(0);
}

function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["prompt", "output-dir", "model", "timing-file", "dir", "skill"],
    boolean: ["help"],
    alias: { h: "help" },
    default: { dir: "." },
  });

  if (parsed.help) help();

  const missing = ["prompt", "output-dir", "model", "timing-file"].filter(
    (k) => !parsed[k],
  );
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.join(", ")}`);
    Deno.exit(2);
  }

  return parsed as unknown as {
    prompt: string;
    "output-dir": string;
    model: string;
    "timing-file": string;
    dir: string;
    skill?: string;
  };
}

function constructMessage(
  prompt: string,
  outputDir: string,
  skillPath: string | undefined,
): string {
  const instruction = skillPath
    ? `Read ${skillPath} and use it to complete the following task.`
    : "Execute the following task without consulting any skill. Use only your default behavior.";

  return `${instruction}

Write output files to: ${outputDir}

${prompt}`;
}

function extractSessionId(
  stdout: ReadableStream<Uint8Array>,
): Promise<string | undefined> {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "step_start" && event.sessionID) {
            return event.sessionID;
          }
        } catch {
          // skip malformed lines
        }
      }
    }
    return undefined;
  })();
}

async function fetchTokens(sessionId: string) {
  if (!/^[0-9a-f-]+$/i.test(sessionId)) throw new Error("Invalid session ID");
  const sql =
    `SELECT tokens_input, tokens_output FROM session WHERE id = '${sessionId.replace(/'/g, "''")}';`;
  const cmd = new Deno.Command("opencode", {
    args: ["db", "--format", "json", sql],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  if (!result.success) throw new Error("DB query failed");
  const rows = JSON.parse(new TextDecoder().decode(result.stdout));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No session data");
  }
  const row = rows[0];
  return {
    input: row.tokens_input ?? 0,
    output: row.tokens_output ?? 0,
  };
}

async function main() {
  const flags = parseFlags();

  await Deno.mkdir(flags["output-dir"], { recursive: true });

  const message = constructMessage(flags.prompt, flags["output-dir"], flags.skill);

  // check opencode
  const which = new Deno.Command("which", { args: ["opencode"] });
  if (!(await which.output()).success) {
    console.error("Error: opencode not found in PATH");
    Deno.exit(1);
  }

  const cmdArgs = [
    "run", "--format", "json", "--dangerously-skip-permissions",
    "-m", flags.model,
    "--dir", flags.dir,
    "--", message,
  ];

  const startTime = Date.now();
  const proc = new Deno.Command("opencode", {
    args: cmdArgs, stdout: "piped", stderr: "inherit",
  });

  try {
    const child = proc.spawn();
    const [sessionId, status] = await Promise.all([
      extractSessionId(child.stdout),
      child.status,
    ]);

    const durationMs = Date.now() - startTime;
    let totalTokens = 0;

    if (sessionId) {
      try {
        const t = await fetchTokens(sessionId);
        totalTokens = t.input + t.output;
      } catch (err) {
        console.error(`Warning: token fetch failed: ${err}`);
      }
    }

    const timingData = { total_tokens: totalTokens, duration_ms: durationMs };
    parse(TimingSchema, timingData);
    Deno.writeTextFileSync(flags["timing-file"], JSON.stringify(timingData) + "\n");

    if (!status.success) {
      console.error(`Agent exited with code ${status.code}`);
      Deno.exit(1);
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    try {
      const timingData = { total_tokens: 0, duration_ms: durationMs };
      parse(TimingSchema, timingData);
      Deno.writeTextFileSync(flags["timing-file"], JSON.stringify(timingData) + "\n");
    } catch { /* best-effort */ }
    console.error(`Error: ${err}`);
    Deno.exit(1);
  }
}

if (import.meta.main) main();
