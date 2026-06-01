#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import { parse } from "npm:valibot";
import { BenchmarkSchema } from "./lib/schemas/benchmark.ts";
import { sanitizeJson, pickLatestDir } from "./lib/helpers.ts";

function help(): never {
  console.error(`Usage: aggregate-benchmark.ts [OPTIONS]

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
`);
  Deno.exit(0);
}

function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["workspace-dir", "benchmark-file", "entries"],
    boolean: ["help"],
    alias: { h: "help" },
  });

  if (parsed.help) help();

  const missing = ["workspace-dir", "benchmark-file"].filter((k) => !parsed[k]);
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.join(", ")}`);
    Deno.exit(2);
  }

  const entries = parsed.entries
    ? (parsed.entries as string).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return {
    "workspace-dir": parsed["workspace-dir"] as string,
    "benchmark-file": parsed["benchmark-file"] as string,
    entries,
  };
}

interface RunData {
  passRate: number;
  timeSeconds: number;
  tokens: number;
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

function collectRuns(workspaceDir: string, strategy: "baseline" | "with-skill", entries?: string[]): RunData[] {
  const results: RunData[] = [];
  for (const entryDir of Deno.readDirSync(workspaceDir)) {
    if (!entryDir.isDirectory) continue;
    if (entries && entries.length > 0 && !entries.includes(entryDir.name)) continue;
    for (const modelDir of Deno.readDirSync(join(workspaceDir, entryDir.name))) {
      if (!modelDir.isDirectory) continue;
      const base = join(workspaceDir, entryDir.name, modelDir.name);
      const subPath = strategy === "baseline"
        ? "baseline"
        : (() => {
          const latest = pickLatestDir(join(base, "with-skill"));
          return latest ? `with-skill/${latest}` : undefined;
        })();
      if (!subPath) continue;
      try {
        const timing = JSON.parse(Deno.readTextFileSync(join(base, subPath, "timing.json")));
        const grading = JSON.parse(sanitizeJson(Deno.readTextFileSync(join(base, subPath, "grading.json"))));
        results.push({
          passRate: grading.summary?.pass_rate ?? 0,
          timeSeconds: (timing.duration_ms ?? 0) / 1000,
          tokens: timing.total_tokens ?? 0,
        });
      } catch (err) {
        console.error(`Warning: skipping ${join(base, subPath)} — ${err}`);
      }
    }
  }
  return results;
}

async function main() {
  const flags = parseFlags();

  const baseline = collectRuns(flags["workspace-dir"], "baseline", flags.entries);
  const withSkill = collectRuns(flags["workspace-dir"], "with-skill", flags.entries);

  if (baseline.length === 0 && withSkill.length === 0) {
    console.error("No run data found in workspace");
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
      },
      delta: {
        pass_rate: wsPassMean - blPassMean,
        time_seconds: wsTimeMean - blTimeMean,
        tokens: wsTokenMean - blTokenMean,
      },
    },
  };

  parse(BenchmarkSchema, data);
  Deno.writeTextFileSync(flags["benchmark-file"], JSON.stringify(data, null, 2) + "\n");
  console.log(JSON.stringify(data, null, 2));
}

if (import.meta.main) main();
