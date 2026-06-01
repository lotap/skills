import { object, string, number, array, optional, union, type InferOutput } from "npm:valibot";

export const EvalEntrySchema = object({
  id: union([string(), number()]),
  prompt: string(),
  assertions: optional(array(string()), []),
});

export const EvalsFileSchema = object({
  evals: array(EvalEntrySchema),
});

export type EvalEntry = InferOutput<typeof EvalEntrySchema>;
export type EvalsFile = InferOutput<typeof EvalsFileSchema>;
