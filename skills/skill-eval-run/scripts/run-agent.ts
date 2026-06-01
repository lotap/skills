#!/usr/bin/env -S deno run --allow-all

import "./lib/load-env.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { resolveHarnessId } from "./lib/harness/env.ts";
import { getHarness } from "./lib/harness/registry.ts";
import { writeTimingFile } from "./lib/harness/write-timing.ts";

function help(): never {
  console.error(`Usage: run-agent.ts [OPTIONS]

Run an agent via the selected harness and write timing.json.

Options:
  --prompt TEXT       Task description for the agent (required)
  --output-dir PATH   Directory where agent writes output files (required)
  --model NAME        Model identifier — harness-specific (required)
  --timing-file PATH  Output path for timing.json (required)
  --dir PATH          Working directory (default: .)
  --skill PATH        Path to SKILL.md to load (omit for baseline)
  --harness NAME      Agent harness (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
  --no-headless       Do not pass headless / skip-permission flags to the harness

Exit codes:
  0   Agent completed
  1   Agent failed or errored
  2   Invalid arguments
`);
  Deno.exit(0);
}

async function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["prompt", "output-dir", "model", "timing-file", "dir", "skill", "harness"],
    boolean: ["help", "no-headless"],
    alias: { h: "help" },
    default: { dir: "." },
  });

  if (parsed.help) help();

  const missing = ["prompt", "output-dir", "model", "timing-file"].filter((k) => !parsed[k]);
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.join(", ")}`);
    Deno.exit(2);
  }

  return {
    prompt: parsed.prompt as string,
    outputDir: parsed["output-dir"] as string,
    model: parsed.model as string,
    timingFile: parsed["timing-file"] as string,
    dir: parsed.dir as string,
    skill: parsed.skill as string | undefined,
    harness: await resolveHarnessId(parsed.harness as string | undefined),
    headless: !parsed["no-headless"],
  };
}

async function main() {
  const flags = await parseFlags();
  await Deno.mkdir(flags.outputDir, { recursive: true });

  const startTime = Date.now();

  try {
    const harness = await getHarness(flags.harness);
    const result = await harness.run({
      prompt: flags.prompt,
      outputDir: flags.outputDir,
      model: flags.model,
      cwd: flags.dir,
      skillPath: flags.skill,
      headless: flags.headless,
    });

    writeTimingFile(flags.timingFile, result);

    if (!result.ok) {
      console.error(result.error ?? "Agent run failed");
      Deno.exit(1);
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    try {
      writeTimingFile(flags.timingFile, {
        ok: false,
        durationMs,
        totalTokens: 0,
        tokensSource: "none",
        error: String(err),
      });
    } catch { /* best-effort */ }
    console.error(`Error: ${err}`);
    Deno.exit(1);
  }
}

if (import.meta.main) main();
