#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { join } from "jsr:@std/path";
import { harnessModelSlug, pickLatestDir, runWithConcurrency, warnUnknownEntryIds } from "./lib/helpers.ts";
import { resolveHarnessId, validateHarnessId } from "./lib/harness/env.ts";
import { runGraderCore } from "./run-grader.ts";
import { DEFAULT_TIMEOUT_SECONDS, DEFAULT_PARALLEL_ENTRIES } from "./lib/constants.ts";

function log(...args: unknown[]) {
  console.error("[grade]", ...args);
}

const HELP_TEXT = `Usage: grade-benchmark.ts [OPTIONS]

Grade all completed agent runs in a workspace. Iterates eval entries and
grades baseline and with-skill outputs directly.

Options:
  --skill-dir PATH    Path to skill directory (for evals.json) (required)
  --workspace-dir PATH  Workspace directory with agent output dirs (required)
  --model NAME        Model identifier (required, harness-specific)
  --harness NAME      Harness used for eval runs (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
  --grader-harness NAME  Harness for grading (default: same as --harness)
  --entries TEXT      Comma-separated entry IDs (default: all in evals.json)
  --parallel NUMBER   Max parallel entries (default: 2)
  --timeout NUMBER    Grader timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --skip-baseline     Skip grading baseline outputs
  --skip-with-skill   Skip grading with-skill outputs

Exit codes:
  0   All entries graded
  1   Some entries failed grading
  2   Invalid arguments
`;

type ParsedFlags = {
  "skill-dir": string;
  "workspace-dir": string;
  model: string;
  harness: string;
  "grader-harness": string;
  slug: string;
  entries: string[];
  parallel: number;
  "skip-baseline": boolean;
  "skip-with-skill": boolean;
  timeoutMs: number;
};

async function parseFlags(): Promise<
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number }
> {
  const base = parseCLI({
    strings: ["skill-dir", "workspace-dir", "model", "harness", "grader-harness", "entries", "timeout"],
    booleans: ["skip-baseline", "skip-with-skill"],
    required: ["skill-dir", "workspace-dir", "model"],
    defaults: { parallel: DEFAULT_PARALLEL_ENTRIES, timeout: String(DEFAULT_TIMEOUT_SECONDS) },
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  const parsed = base.parsed;
  const entries = parsed.entries
    ? (parsed.entries as string).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const harness = await resolveHarnessId(parsed.harness as string | undefined);
  const graderHarness = parsed["grader-harness"]
    ? validateHarnessId(parsed["grader-harness"] as string)
    : harness;

  const modelStr = parsed.model as string;
  const timeoutSec = Math.max(1, parseInt(parsed.timeout as string, 10) || DEFAULT_TIMEOUT_SECONDS);

  return {
    success: true,
    flags: {
      "skill-dir": parsed["skill-dir"] as string,
      "workspace-dir": parsed["workspace-dir"] as string,
      model: modelStr,
      harness,
      "grader-harness": graderHarness,
      slug: harnessModelSlug(harness, modelStr.split("/").pop() || modelStr),
      entries,
      parallel: Math.max(1, (parsed.parallel as number) || 2),
      "skip-baseline": !!parsed["skip-baseline"],
      "skip-with-skill": !!parsed["skip-with-skill"],
      timeoutMs: timeoutSec * 1000,
    },
  };
}

async function main() {
  await loadEnvFiles();
  const parsed = await parseFlags();
  if (!parsed.success) {
    log(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;

  const evalsPath = join(flags["skill-dir"], "evals", "evals.json");
  let evalFile: { evals: { id: number | string; prompt: string; assertions?: string[] }[] };
  try {
    evalFile = JSON.parse(await Deno.readTextFile(evalsPath));
  } catch (err) {
    log(`Error reading ${evalsPath}: ${err}`);
    Deno.exit(1);
  }

  let entries = evalFile.evals;
  if (flags.entries.length > 0) {
    warnUnknownEntryIds(flags.entries, evalFile.evals.map((e) => String(e.id)), log);
    entries = entries.filter((e) => flags.entries.includes(String(e.id)));
  }

  if (entries.length === 0) {
    log("No eval entries to grade");
    Deno.exit(1);
  }

  log(
    `skill-dir=${flags["skill-dir"]} harness=${flags.harness} grader=${flags["grader-harness"]} model=${flags.model} entries=${entries.length} parallel=${flags.parallel}`,
  );

  const tasks = entries.map((entry) => async () => {
    const eid = entry.id;
    const runPath = join(flags["workspace-dir"], String(eid), flags.slug);
    const baseOut = join(runPath, "baseline", "outputs");
    const baseGrading = join(runPath, "baseline", "grading.json");
    const wsDir = join(runPath, "with-skill");
    const wsTs = await pickLatestDir(wsDir);
    const wsOut = wsTs ? join(wsDir, wsTs, "outputs") : undefined;
    const wsGrading = wsTs ? join(wsDir, wsTs, "grading.json") : undefined;

    const assertions = entry.assertions ?? [];

    let ok = true;

    if (!flags["skip-baseline"]) {
      try {
        await Deno.stat(baseGrading);
        log(`entry=${eid} baseline grading: exists, skipping`);
      } catch {
        log(`entry=${eid} baseline grading: starting...`);
        const start = Date.now();
        const r = await runGraderCore({
          assertions,
          outputsDir: baseOut,
          model: flags.model,
          gradingFile: baseGrading,
          dir: flags["workspace-dir"],
          harness: flags["grader-harness"],
          timeoutMs: flags.timeoutMs,
        });
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`entry=${eid} baseline grading: ${r ? "done" : "FAILED"} (${elapsed}s)`);
        if (!r) ok = false;
      }
    }

    if (!flags["skip-with-skill"] && wsOut && wsGrading) {
      try {
        await Deno.stat(wsGrading);
        log(`entry=${eid} with-skill grading: exists, skipping`);
      } catch {
        log(`entry=${eid} with-skill grading: starting...`);
        const start = Date.now();
        const r = await runGraderCore({
          assertions,
          outputsDir: wsOut,
          model: flags.model,
          gradingFile: wsGrading,
          dir: flags["workspace-dir"],
          harness: flags["grader-harness"],
          timeoutMs: flags.timeoutMs,
        });
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`entry=${eid} with-skill grading: ${r ? "done" : "FAILED"} (${elapsed}s)`);
        if (!r) ok = false;
      }
    }

    if (ok) {
      const rates: string[] = [];
      for (const path of [baseGrading, ...(wsGrading ? [wsGrading] : [])]) {
        try {
          const g = JSON.parse(await Deno.readTextFile(path));
          const pr = g.summary?.pass_rate;
          if (pr !== undefined) rates.push(`${pr}`);
        } catch { /* skip */ }
      }
      const extra = rates.length > 0 ? ` (${rates.join(", ")})` : "";
      log(`entry=${eid}: pass${extra}`);
    } else {
      log(`entry=${eid}: FAIL`);
    }

    return ok;
  });

  const results = await runWithConcurrency(tasks, flags.parallel);
  const allOk = results.every(Boolean);
  const passCount = results.filter((r) => r).length;
  log(`Grading complete: ${passCount}/${entries.length} passed`);

  Deno.exit(allOk ? 0 : 1);
}

if (import.meta.main) main();
