#!/usr/bin/env -S deno run --allow-all

import "./lib/load-env.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join, dirname, fromFileUrl } from "jsr:@std/path";
import { harnessModelSlug, pickLatestDir, runWithConcurrency, warnUnknownEntryIds } from "./lib/helpers.ts";
import { resolveHarnessId, validateHarnessId } from "./lib/harness/env.ts";

function log(...args: unknown[]) {
  console.error("[grade]", ...args);
}

function help(): never {
  log(`Usage: grade-benchmark.ts [OPTIONS]

Grade all completed agent runs in a workspace. Iterates eval entries and
calls run-grader.ts for baseline and with-skill outputs.

Options:
  --skill-dir PATH    Path to skill directory (for evals.json) (required)
  --workspace-dir PATH  Workspace directory with agent output dirs (required)
  --model NAME        Model identifier (required, harness-specific)
  --harness NAME      Harness used for eval runs (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
  --grader-harness NAME  Harness for grading (default: same as --harness)
  --entries TEXT      Comma-separated entry IDs (default: all in evals.json)
  --parallel NUMBER   Max parallel entries (default: 2)
  --skip-baseline     Skip grading baseline outputs
  --skip-with-skill   Skip grading with-skill outputs

Exit codes:
  0   All entries graded
  1   Some entries failed grading
  2   Invalid arguments
`);
  Deno.exit(0);
}

async function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["skill-dir", "workspace-dir", "model", "harness", "grader-harness", "entries"],
    boolean: ["help", "skip-baseline", "skip-with-skill"],
    alias: { h: "help" },
    default: { parallel: 2 },
  });

  if (parsed.help) help();

  const missing = ["skill-dir", "workspace-dir", "model"].filter((k) => !parsed[k]);
  if (missing.length > 0) {
    log(`Missing required flags: ${missing.join(", ")}`);
    Deno.exit(2);
  }

  const entries = parsed.entries
    ? (parsed.entries as string).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const harness = await resolveHarnessId(parsed.harness as string | undefined);
  const graderHarness = parsed["grader-harness"]
    ? validateHarnessId(parsed["grader-harness"] as string)
    : harness;

  return {
    "skill-dir": parsed["skill-dir"] as string,
    "workspace-dir": parsed["workspace-dir"] as string,
    model: parsed.model as string,
    harness,
    "grader-harness": graderHarness,
    slug: harnessModelSlug(harness, (parsed.model as string).split("/").pop() || parsed.model!),
    entries,
    parallel: Math.max(1, (parsed.parallel as number) || 2),
    "skip-baseline": !!parsed["skip-baseline"],
    "skip-with-skill": !!parsed["skip-with-skill"],
  };
}

const SCRIPTS_DIR = dirname(fromFileUrl(import.meta.url));

async function runScript(
  label: string,
  script: string,
  flags: Record<string, string | boolean | undefined>,
): Promise<boolean> {
  const start = Date.now();
  const args: string[] = ["run", "--allow-all", join(SCRIPTS_DIR, script)];
  for (const [key, value] of Object.entries(flags)) {
    if (value === undefined || value === false) continue;
    if (value === true) {
      args.push(`--${key}`);
    } else {
      args.push(`--${key}`, String(value));
    }
  }
  const cmd = new Deno.Command("deno", { args, stdout: "inherit", stderr: "inherit" });
  const ok = (await cmd.output()).success;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(`${label}: ${ok ? "done" : "FAILED"} (${elapsed}s)`);
  return ok;
}

async function main() {
  const flags = await parseFlags();

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
    const wsTs = pickLatestDir(wsDir);
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
        if (!await runScript(`entry=${eid} baseline grading`, "run-grader.ts", {
          assertions: JSON.stringify(assertions),
          "outputs-dir": baseOut,
          model: flags.model,
          harness: flags.harness,
          "grader-harness": flags["grader-harness"],
          dir: flags["workspace-dir"],
          "grading-file": baseGrading,
        })) ok = false;
      }
    }

    if (!flags["skip-with-skill"] && wsOut && wsGrading) {
      try {
        await Deno.stat(wsGrading);
        log(`entry=${eid} with-skill grading: exists, skipping`);
      } catch {
        log(`entry=${eid} with-skill grading: starting...`);
        if (!await runScript(`entry=${eid} with-skill grading`, "run-grader.ts", {
          assertions: JSON.stringify(assertions),
          "outputs-dir": wsOut,
          model: flags.model,
          harness: flags.harness,
          "grader-harness": flags["grader-harness"],
          dir: flags["workspace-dir"],
          "grading-file": wsGrading,
        })) ok = false;
      }
    }

    // Report
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
