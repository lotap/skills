import type { AgentRunResult, TokensSource } from "./types.ts";
import type { ProcessResult } from "./command.ts";

function sumUsage(usage: Record<string, unknown>): number | null {
  const input = usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens;
  if (typeof input === "number" && typeof output === "number") {
    return input + output;
  }
  return null;
}

/** Single JSON object with a usage field (Claude Code, Cursor Agent CLI). */
export function tokensFromJson(stdout: string): number | null {
  try {
    const data = JSON.parse(stdout);
    const usage = data.usage ?? data.result?.usage;
    if (usage && typeof usage === "object") {
      return sumUsage(usage as Record<string, unknown>);
    }
  } catch { /* not JSON */ }
  return null;
}

/** JSONL events with usage or tokens fields (Codex). */
export function tokensFromJsonl(stdout: string): number | null {
  let total = 0;
  let found = false;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const usage = event.usage ?? event.token_usage;
      if (usage && typeof usage === "object") {
        const parsed = sumUsage(usage as Record<string, unknown>);
        if (parsed !== null) {
          total += parsed;
          found = true;
        }
      }
      if (typeof event.tokens === "number") {
        total += event.tokens;
        found = true;
      }
    } catch { /* skip line */ }
  }
  return found ? total : null;
}

export function tokensFromJsonOrJsonl(stdout: string): number | null {
  return tokensFromJson(stdout) ?? tokensFromJsonl(stdout);
}

export function buildAgentResult(
  proc: ProcessResult,
  label: string,
  parseTokens?: (stdout: string) => number | null,
): AgentRunResult {
  let totalTokens = 0;
  let tokensSource: TokensSource = "none";
  if (parseTokens) {
    const parsed = parseTokens(proc.stdout);
    if (parsed !== null) {
      totalTokens = parsed;
      tokensSource = "harness";
    }
  }
  return {
    ok: proc.success,
    durationMs: proc.durationMs,
    totalTokens,
    tokensSource,
    error: proc.success ? undefined : `${label} exited with code ${proc.code}`,
  };
}
