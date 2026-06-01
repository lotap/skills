import { object, number, picklist, optional, string, type InferOutput } from "npm:valibot";

export const TokensSourceSchema = picklist(["harness", "estimated", "none"]);

export const TimingSchema = object({
  total_tokens: number(),
  duration_ms: number(),
  tokens_source: TokensSourceSchema,
  error: optional(string()),
});

export type Timing = InferOutput<typeof TimingSchema>;
