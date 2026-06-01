import { parse } from "npm:valibot";
import { TimingSchema, type Timing } from "../schemas/timing.ts";
import type { AgentRunResult } from "./types.ts";

export function resultToTiming(result: AgentRunResult): Timing {
  return {
    total_tokens: result.totalTokens,
    duration_ms: result.durationMs,
    tokens_source: result.tokensSource,
  };
}

export function writeTimingFile(path: string, result: AgentRunResult): void {
  const timing = resultToTiming(result);
  parse(TimingSchema, timing);
  Deno.writeTextFileSync(path, JSON.stringify(timing) + "\n");
}
