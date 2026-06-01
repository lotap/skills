import type { AgentRunRequest, AgentRunResult, Harness } from "./types.ts";
import { constructAgentMessage } from "./message.ts";
import { assertCommandOnPath, commandOnPath } from "./command.ts";
import { resolveProvidedOrEnv } from "./env.ts";
import { exitMissingModel } from "./model.ts";

async function listOpencodeModels(): Promise<string[]> {
  try {
    const cmd = new Deno.Command("opencode", {
      args: ["models"],
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await cmd.output();
    if (!success) return [];
    return new TextDecoder().decode(stdout).trim().split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function fuzzyMatch(provided: string, available: string[]): string | null {
  const lower = provided.toLowerCase();
  const exact = available.find((m) => m.toLowerCase() === lower);
  if (exact) return exact;
  for (const model of available) {
    const suffix = model.split("/").pop()?.toLowerCase();
    if (suffix === lower) return model;
    if (suffix?.includes(lower) || lower.includes(suffix ?? "")) return model;
  }
  return available.find((m) => m.toLowerCase().includes(lower)) ?? null;
}

function extractSessionId(stdout: ReadableStream<Uint8Array>): Promise<string | undefined> {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "step_start" && event.sessionID) {
            return event.sessionID;
          }
        } catch { /* skip malformed */ }
      }
    }
    return undefined;
  })();
}

async function fetchOpencodeTokens(sessionId: string): Promise<{ input: number; output: number }> {
  if (!/^ses_[a-zA-Z0-9]+$/.test(sessionId)) throw new Error("Invalid session ID");
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
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("No session data");
  const row = rows[0];
  return { input: row.tokens_input ?? 0, output: row.tokens_output ?? 0 };
}

async function defaultOpencodeModel(): Promise<string | undefined> {
  try {
    const cmd = new Deno.Command("opencode", {
      args: ["config", "get", "model"],
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await cmd.output();
    if (!success) return undefined;
    const model = new TextDecoder().decode(stdout).trim();
    return model || undefined;
  } catch {
    return undefined;
  }
}

export const opencodeHarness: Harness = {
  id: "opencode",

  async resolveModel(provided?: string): Promise<string> {
    const candidate = resolveProvidedOrEnv(provided, "OPENCODE_MODEL");
    if (!candidate) {
      const configured = await defaultOpencodeModel();
      if (configured) return configured;
      exitMissingModel("opencode", ["OPENCODE_MODEL"], "opencode/gpt-4o");
    }

    const available = await listOpencodeModels();
    if (available.length === 0) return candidate;

    const match = fuzzyMatch(candidate, available);
    if (match) {
      if (match !== candidate) {
        console.error(`Model "${candidate}" resolved to "${match}"`);
      }
      return match;
    }

    console.error(`Model "${candidate}" not found among available opencode models.`);
    console.error(`Available models:\n  ${available.join("\n  ")}`);
    console.error("Provide --model with a fully qualified model ID (e.g. opencode/gpt-4o).");
    Deno.exit(1);
  },

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    await assertCommandOnPath("opencode");
    const message = constructAgentMessage(req.prompt, req.outputDir, req.skillPath);
    const startTime = Date.now();

    const cmdArgs = [
      "run",
      "--format",
      "json",
      ...(req.headless ? ["--dangerously-skip-permissions"] : []),
      "-m",
      req.model,
      "--dir",
      req.cwd,
      "--",
      message,
    ];

    const proc = new Deno.Command("opencode", {
      args: cmdArgs,
      stdout: "piped",
      stderr: "inherit",
    });

    const child = proc.spawn();
    const [sessionId, status] = await Promise.all([
      extractSessionId(child.stdout),
      child.status,
    ]);

    const durationMs = Date.now() - startTime;
    let totalTokens = 0;
    let tokensSource: AgentRunResult["tokensSource"] = "none";

    if (sessionId) {
      try {
        const t = await fetchOpencodeTokens(sessionId);
        totalTokens = t.input + t.output;
        tokensSource = "harness";
      } catch (err) {
        console.error(`Warning: opencode token fetch failed: ${err}`);
      }
    }

    return {
      ok: status.success,
      durationMs,
      totalTokens,
      tokensSource,
      error: status.success ? undefined : `opencode exited with code ${status.code}`,
    };
  },
};

/** Used by harness detection. */
export function opencodeAvailable(): Promise<boolean> {
  return commandOnPath("opencode");
}
