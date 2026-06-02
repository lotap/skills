#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { join } from "jsr:@std/path";
import { safeParse } from "npm:valibot";
import { BenchmarkSchema } from "./lib/schemas/benchmark.ts";
import { pickLatestDir, warnUnknownEntryIds } from "./lib/helpers.ts";

const HELP_TEXT = `Usage: aggregate-benchmark.ts [OPTIONS]

Scan workspace directory for timing.json and grading.json files, compute
mean/stddev/delta statistics, and write benchmark.json.

Options:
  --workspace-dir PATH  Path to workspace directory (required)
  --benchmark-file PATH Output path for benchmark.json (required)
  --entries TEXT        Comma-separated entry IDs (default: all in workspace)

Exit codes:
  0   Benchmark written
  1   No data found or error
  2   Invalid arguments
`;

type ParsedFlags = {
  "workspace-dir": string;
  "benchmark-file": string;
  entries: string[];
};

function parseFlags():
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number } {
  const base = parseCLI({
    strings: ["workspace-dir", "benchmark-file", "entries"],
    required: ["workspace-dir", "benchmark-file"],
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  const parsed = base.parsed;
  const entries = parsed.entries
    ? (parsed.entries as string).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return {
    success: true,
    flags: {
      "workspace-dir": parsed["workspace-dir"] as string,
      "benchmark-file": parsed["benchmark-file"] as string,
      entries,
    },
  };
}

interface RunData {
  passRate: number;
  timeSeconds: number;
  tokens: number;
  tokensSource: string;
}

function aggregateTokensSource(runs: RunData[]): string {
  if (runs.length === 0) return "none";
  const sources = new Set(runs.map((r) => r.tokensSource));
  if (sources.size === 1) return sources.values().next().value as string;
  return "mixed";
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stddev(vals: number[], m: number): number {
  if (vals.length < 2) return 0;
  const sqDiffs = vals.map((v) => (v - m) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (vals.length - 1));
}

async function collectRuns(workspaceDir: string, strategy: "baseline" | "with-skill", entries?: string[]): Promise<RunData[]> {
  const entrySet = entries && entries.length > 0 ? new Set(entries) : null;
  const pairs: { entryDir: string; modelDir: string }[] = [];
  for await (const entry of Deno.readDir(workspaceDir)) {
    if (!entry.isDirectory) continue;
    if (entrySet && !entrySet.has(entry.name)) continue;
    for await (const model of Deno.readDir(join(workspaceDir, entry.name))) {
      if (!model.isDirectory) continue;
      pairs.push({ entryDir: entry.name, modelDir: model.name });
    }
  }

  const results = await Promise.all(pairs.map(async ({ entryDir, modelDir }) => {
    const base = join(workspaceDir, entryDir, modelDir);
    let subPath: string | undefined;
    if (strategy === "baseline") {
      subPath = "baseline";
    } else {
      const latest = await pickLatestDir(join(base, "with-skill"));
      subPath = latest ? `with-skill/${latest}` : undefined;
    }
    if (!subPath) return null;
    try {
      const [timingRaw, gradingRaw] = await Promise.all([
        Deno.readTextFile(join(base, subPath, "timing.json")),
        Deno.readTextFile(join(base, subPath, "grading.json")),
      ]);
      const timing = JSON.parse(timingRaw);
      const grading = JSON.parse(gradingRaw);
      return {
        passRate: grading.summary?.pass_rate ?? 0,
        timeSeconds: (timing.duration_ms ?? 0) / 1000,
        tokens: timing.total_tokens ?? 0,
        tokensSource: timing.tokens_source ?? "none",
      } as RunData;
    } catch (err) {
      console.error(`Warning: skipping ${join(base, subPath)} — ${err}`);
      return null;
    }
  }));

  return results.filter((r): r is RunData => r !== null);
}

async function main() {
  await loadEnvFiles();
  const parsed = parseFlags();
  if (!parsed.success) {
    console.error(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;

  if (flags.entries.length > 0) {
    try {
      const existing = [];
      for await (const entry of Deno.readDir(flags["workspace-dir"])) {
        if (entry.isDirectory) existing.push(entry.name);
      }
      warnUnknownEntryIds(flags.entries, existing);
    } catch { /* workspace dir may not exist yet */ }
  }

  const baseline = await collectRuns(flags["workspace-dir"], "baseline", flags.entries);
  const withSkill = await collectRuns(flags["workspace-dir"], "with-skill", flags.entries);

  if (baseline.length === 0 && withSkill.length === 0) {
    console.error("No run data found in workspace");
    Deno.exit(1);
  }

  if (baseline.length === 0) {
    console.error("No baseline runs found in workspace — run orchestrate-benchmark.ts --skip-with-skill first");
    Deno.exit(1);
  }

  if (withSkill.length === 0) {
    console.error("No with-skill runs found in workspace — run orchestrate-benchmark.ts first");
    Deno.exit(1);
  }

  const blPassMean = mean(baseline.map((r) => r.passRate));
  const blTimeMean = mean(baseline.map((r) => r.timeSeconds));
  const blTokenMean = mean(baseline.map((r) => r.tokens));
  const wsPassMean = mean(withSkill.map((r) => r.passRate));
  const wsTimeMean = mean(withSkill.map((r) => r.timeSeconds));
  const wsTokenMean = mean(withSkill.map((r) => r.tokens));

  const data = {
    run_summary: {
      baseline: {
        pass_rate: {
          mean: blPassMean,
          stddev: stddev(baseline.map((r) => r.passRate), blPassMean),
        },
        time_seconds: {
          mean: blTimeMean,
          stddev: stddev(baseline.map((r) => r.timeSeconds), blTimeMean),
        },
        tokens: {
          mean: blTokenMean,
          stddev: stddev(baseline.map((r) => r.tokens), blTokenMean),
        },
        tokens_source: aggregateTokensSource(baseline),
      },
      with_skill: {
        pass_rate: {
          mean: wsPassMean,
          stddev: stddev(withSkill.map((r) => r.passRate), wsPassMean),
        },
        time_seconds: {
          mean: wsTimeMean,
          stddev: stddev(withSkill.map((r) => r.timeSeconds), wsTimeMean),
        },
        tokens: {
          mean: wsTokenMean,
          stddev: stddev(withSkill.map((r) => r.tokens), wsTokenMean),
        },
        tokens_source: aggregateTokensSource(withSkill),
      },
      delta: {
        pass_rate: wsPassMean - blPassMean,
        time_seconds: wsTimeMean - blTimeMean,
        tokens: wsTokenMean - blTokenMean,
      },
    },
  };

  const validation = safeParse(BenchmarkSchema, data);
  if (!validation.success) {
    console.error("Error: computed benchmark data does not match schema:");
    console.error(
      validation.issues?.map((i) => `  ${i.path?.map((p) => p.key).join(".") ?? "?"}: ${i.message}`).join("\n"),
    );
    Deno.exit(1);
  }
  try {
    await Deno.writeTextFile(flags["benchmark-file"], JSON.stringify(validation.output, null, 2) + "\n");
  } catch (err) {
    console.error(`Error writing benchmark file: ${err}`);
    Deno.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  Deno.exit(0);
}

if (import.meta.main) main();
