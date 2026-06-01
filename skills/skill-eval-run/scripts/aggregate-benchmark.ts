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
  const results: RunData[] = [];
  for await (const entryDir of Deno.readDir(workspaceDir)) {
    if (!entryDir.isDirectory) continue;
    if (entries && entries.length > 0 && !entries.includes(entryDir.name)) continue;
    for await (const modelDir of Deno.readDir(join(workspaceDir, entryDir.name))) {
      if (!modelDir.isDirectory) continue;
      const base = join(workspaceDir, entryDir.name, modelDir.name);
      let subPath: string | undefined;
      if (strategy === "baseline") {
        subPath = "baseline";
      } else {
        const latest = await pickLatestDir(join(base, "with-skill"));
        subPath = latest ? `with-skill/${latest}` : undefined;
      }
      if (!subPath) continue;
      try {
        const timing = JSON.parse(await Deno.readTextFile(join(base, subPath, "timing.json")));
        const grading = JSON.parse(await Deno.readTextFile(join(base, subPath, "grading.json")));
        results.push({
          passRate: grading.summary?.pass_rate ?? 0,
          timeSeconds: (timing.duration_ms ?? 0) / 1000,
          tokens: timing.total_tokens ?? 0,
          tokensSource: timing.tokens_source ?? "none",
        });
      } catch (err) {
        console.error(`Warning: skipping ${join(base, subPath)} — ${err}`);
      }
    }
  }
  return results;
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
  await Deno.writeTextFile(flags["benchmark-file"], JSON.stringify(validation.output, null, 2) + "\n");
  console.log(JSON.stringify(data, null, 2));
  Deno.exit(0);
}

if (import.meta.main) main();
