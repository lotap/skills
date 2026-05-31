import {
  object,
  number,
  string,
  boolean,
  array,
  type InferOutput,
} from "npm:valibot";

export const AssertionResultSchema = object({
  text: string(),
  passed: boolean(),
  evidence: string(),
});

export const SummarySchema = object({
  passed: number(),
  failed: number(),
  total: number(),
  pass_rate: number(),
});

export const GradingSchema = object({
  assertion_results: array(AssertionResultSchema),
  summary: SummarySchema,
});

export type AssertionResult = InferOutput<typeof AssertionResultSchema>;
export type Summary = InferOutput<typeof SummarySchema>;
export type Grading = InferOutput<typeof GradingSchema>;
