import { object, number, type InferOutput } from "npm:valibot";

export const TimingSchema = object({
  total_tokens: number(),
  duration_ms: number(),
});

export type Timing = InferOutput<typeof TimingSchema>;
