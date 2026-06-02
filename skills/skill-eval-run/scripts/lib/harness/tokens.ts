import type { AgentRunResult, TokensSource } from "./types.ts";
import type { ProcessResult } from "./command.ts";

function sumUsage(usage: Record<string, unknown>): number | null {
  const rawInput = usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens;
  const rawOutput = usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens;
  const input = typeof rawInput === "number" ? rawInput : (typeof rawInput === "string" || typeof rawInput === "bigint") ? Number(rawInput) : NaN;
  const output = typeof rawOutput === "number" ? rawOutput : (typeof rawOutput === "string" || typeof rawOutput === "bigint") ? Number(rawOutput) : NaN;
  if (!Number.isNaN(input) && !Number.isNaN(output)) {
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

/** OpenCode JSONL: sum tokens from step_finish events. */
export function tokensFromOpencodeJsonl(stdout: string): number | null {
  let totalInput = 0;
  let totalOutput = 0;
  let found = false;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "step_finish" && event.part?.tokens && typeof event.part.tokens === "object") {
        const tokens = event.part.tokens as Record<string, unknown>;
        const rawInput = tokens.input;
        const rawOutput = tokens.output;
        const input = typeof rawInput === "number" ? rawInput : NaN;
        const output = typeof rawOutput === "number" ? rawOutput : NaN;
        if (!Number.isNaN(input) && !Number.isNaN(output)) {
          totalInput += input;
          totalOutput += output;
          found = true;
        }
      }
    } catch { /* skip line */ }
  }
  return found ? totalInput + totalOutput : null;
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
    error: proc.success ? undefined : `${label} exited with code ${proc.code}: ${proc.stderr.slice(0, 500)}`,
  };
}
