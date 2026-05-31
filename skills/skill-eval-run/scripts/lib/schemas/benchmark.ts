import { object, number, type InferOutput } from "npm:valibot";

const StatSchema = object({
  mean: number(),
  stddev: number(),
});

const RunTypeSchema = object({
  pass_rate: StatSchema,
  time_seconds: StatSchema,
  tokens: StatSchema,
});

export const BenchmarkSchema = object({
  run_summary: object({
    baseline: RunTypeSchema,
    with_skill: RunTypeSchema,
    delta: object({
      pass_rate: number(),
      time_seconds: number(),
      tokens: number(),
    }),
  }),
});

export type Benchmark = InferOutput<typeof BenchmarkSchema>;
