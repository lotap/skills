#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from "jsr:@std/cli/parse-args";
import { join, dirname, fromFileUrl } from "jsr:@std/path";
import { modelSlugDir, dateTimeStamp, runWithConcurrency } from "./lib/helpers.ts";

function log(...args: unknown[]) {
  console.error("[benchmark]", ...args);
}

function help(): never {
  log(`Usage: orchestrate-benchmark.ts [OPTIONS]

Run full benchmark across all eval entries. Composes narrow scripts:
  - run-agent.ts for baseline and with-skill phases
  - run-grader.ts for grading
  - aggregate-benchmark.ts for final aggregation

Options:
  --skill NAME        Skill name (e.g. cli-guidelines) (required)
  --skill-dir PATH    Full path to skill directory (required)
  --model NAME        Model identifier (required)
  --workspace-dir PATH  Workspace directory (default: {skill-dir}-workspace)
  --entries TEXT      Comma-separated entry IDs (default: all in evals.json)
  --parallel NUMBER   Max parallel entries (default: 2)
  --skip-baseline     Skip baseline runs (use existing)
  --skip-with-skill   Skip with-skill runs

Exit codes:
  0   Benchmark completed
  1   Some entries failed
  2   Invalid arguments
`);
  Deno.exit(0);
}

function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["skill", "skill-dir", "model", "workspace-dir", "entries", "parallel"],
    boolean: ["help", "skip-baseline", "skip-with-skill"],
    alias: { h: "help" },
    default: { parallel: "2" },
  });

  if (parsed.help) help();

  const missing = ["skill", "skill-dir", "model"].filter((k) => !parsed[k]);
  if (missing.length > 0) {
    log(`Missing required flags: ${missing.join(", ")}`);
    Deno.exit(2);
  }

  const modelSlug = modelSlugDir((parsed.model as string).split("/").pop() || parsed.model!);
  const workspaceDir = parsed["workspace-dir"] || `${parsed["skill-dir"]}-workspace`;
  const entries = parsed.entries
    ? (parsed.entries as string).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];
  const parallel = Math.max(1, parseInt(parsed.parallel as string, 10) || 2);

  return {
    skill: parsed.skill as string,
    "skill-dir": parsed["skill-dir"] as string,
    model: parsed.model as string,
    slug: modelSlug,
    "workspace-dir": workspaceDir,
    entries,
    parallel,
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

async function processEntry(
  entry: { id: number | string; prompt: string; assertions: string[] },
  flags: ReturnType<typeof parseFlags>,
  dt: string,
): Promise<boolean> {
  const eid = entry.id;
  const runPath = join(flags["workspace-dir"], String(eid), flags.slug);
  const baseOut = join(runPath, "baseline", "outputs");
  const baseTiming = join(runPath, "baseline", "timing.json");
  const baseGrading = join(runPath, "baseline", "grading.json");
  const wsRunPath = join(runPath, "with-skill", dt);
  const wsOut = join(wsRunPath, "outputs");
  const wsTiming = join(wsRunPath, "timing.json");
  const wsGrading = join(wsRunPath, "grading.json");

  await Deno.mkdir(baseOut, { recursive: true });
  await Deno.mkdir(wsOut, { recursive: true });

  let ok = true;

  if (!flags["skip-baseline"]) {
    const baseFiles: string[] = [];
    try { for await (const e of Deno.readDir(baseOut)) baseFiles.push(e.name); } catch { /* ok */ }
    if (baseFiles.length > 0) {
      log(`entry=${eid} baseline: outputs exist, skipping`);
    } else {
      log(`entry=${eid} baseline: starting...`);
      const r = await runScript(
        `entry=${eid} baseline`,
        "run-agent.ts",
        {
          prompt: entry.prompt,
          "output-dir": baseOut,
          model: flags.model,
          dir: flags["workspace-dir"],
          "timing-file": baseTiming,
        },
      );
      if (!r) ok = false;
    }
  }

  if (!flags["skip-with-skill"]) {
    log(`entry=${eid} with-skill: starting...`);
    const r = await runScript(
      `entry=${eid} with-skill`,
      "run-agent.ts",
      {
        prompt: entry.prompt,
        "output-dir": wsOut,
        model: flags.model,
        dir: flags["workspace-dir"],
        "timing-file": wsTiming,
        skill: join(flags["skill-dir"], "SKILL.md"),
      },
    );
    if (!r) ok = false;
  }

  // Grading
  let gradeOk = true;

  try {
    await Deno.stat(baseGrading);
    log(`entry=${eid} baseline grading: exists, skipping`);
  } catch {
    log(`entry=${eid} baseline grading: starting...`);
    if (!await runScript(`entry=${eid} baseline grading`, "run-grader.ts", {
      assertions: JSON.stringify(entry.assertions),
      "outputs-dir": baseOut,
      model: flags.model,
      dir: flags["workspace-dir"],
      "grading-file": baseGrading,
    })) gradeOk = false;
  }

  try {
    await Deno.stat(wsGrading);
    log(`entry=${eid} with-skill grading: exists, skipping`);
  } catch {
    log(`entry=${eid} with-skill grading: starting...`);
    if (!await runScript(`entry=${eid} with-skill grading`, "run-grader.ts", {
      assertions: JSON.stringify(entry.assertions),
      "outputs-dir": wsOut,
      model: flags.model,
      dir: flags["workspace-dir"],
      "grading-file": wsGrading,
    })) gradeOk = false;
  }

  if (!gradeOk) ok = false;

  // Report entry result
  if (ok) {
    // Read pass rates from grading files
    const rates: string[] = [];
    for (const [label, path] of [["baseline", baseGrading], ["with-skill", wsGrading]] as const) {
      try {
        const g = JSON.parse(await Deno.readTextFile(path));
        const pr = g.summary?.pass_rate;
        if (pr !== undefined) rates.push(`${label}=${pr}`);
      } catch {
        // grading file not available
      }
    }
    const extra = rates.length > 0 ? ` (${rates.join(", ")})` : "";
    log(`entry=${eid}: pass${extra}`);
  } else {
    log(`entry=${eid}: FAIL`);
  }

  return ok;
}

async function main() {
  const flags = parseFlags();
  const dt = dateTimeStamp();
  const startTime = Date.now();

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
    entries = entries.filter((e) => flags.entries.includes(String(e.id)));
  }

  if (entries.length === 0) {
    log("No eval entries to run");
    Deno.exit(1);
  }

  await Deno.mkdir(flags["workspace-dir"], { recursive: true });

  log(`skill=${flags.skill} model=${flags.model} entries=${entries.length} parallel=${flags.parallel}`);

  const tasks = entries.map(
    (entry) => () => processEntry(
      { id: entry.id, prompt: entry.prompt, assertions: entry.assertions ?? [] },
      flags,
      dt,
    ),
  );

  const results = await runWithConcurrency(tasks, flags.parallel);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const allOk = results.every(Boolean);
  const passCount = results.filter((r) => r).length;
  const failCount = results.filter((r) => !r).length;

  const benchFile = join(flags["workspace-dir"], `benchmark.${flags.slug}.${dt}.json`);
  log(`Benchmark agent runs complete: ${passCount}/${entries.length} passed (${totalTime}s total)`);

  log("Aggregating results...");
  const aggOk = await runScript("aggregate", "aggregate-benchmark.ts", {
    "workspace-dir": flags["workspace-dir"],
    "benchmark-file": benchFile,
  });

  if (aggOk) {
    log(`Benchmark written to: ${benchFile}`);
  }

  Deno.exit(allOk ? 0 : 1);
}

if (import.meta.main) main();
