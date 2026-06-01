import { parse } from "npm:valibot";
import { TimingSchema, type Timing } from "../schemas/timing.ts";
import type { AgentRunResult } from "./types.ts";

export function resultToTiming(result: AgentRunResult): Timing {
  return {
    total_tokens: result.totalTokens,
    duration_ms: result.durationMs,
    tokens_source: result.tokensSource,
    error: result.error,
  };
}

export async function writeTimingFile(path: string, result: AgentRunResult): Promise<void> {
  const timing = resultToTiming(result);
  parse(TimingSchema, timing);
  await Deno.writeTextFile(path, JSON.stringify(timing) + "\n");
}
