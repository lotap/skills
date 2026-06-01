#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from "jsr:@std/cli/parse-args";
import { modelSlugDir, dateTimeStamp, runWithConcurrency } from "./lib/helpers.ts";

function help(): never {
  console.error(`Usage: orchestrate-benchmark.ts [OPTIONS]

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
    console.error(`Missing required flags: ${missing.join(", ")}`);
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

const SCRIPTS_DIR = new URL(".", import.meta.url).pathname;

async function runScript(
  label: string,
  script: string,
  flags: Record<string, string | boolean | undefined>,
): Promise<boolean> {
  console.error(`[${label}] starting...`);
  const args: string[] = ["run", "--allow-all", `${SCRIPTS_DIR}${script}`];
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
  console.error(`[${label}] ${ok ? "done" : "FAILED"}`);
  return ok;
}

async function processEntry(
  entry: { id: number | string; prompt: string; assertions: string[] },
  flags: ReturnType<typeof parseFlags>,
  dt: string,
): Promise<boolean> {
  const eid = entry.id;
  const runPath = `${flags["workspace-dir"]}/${eid}/${flags.slug}`;
  const baseOut = `${runPath}/baseline/outputs`;
  const baseTiming = `${runPath}/baseline/timing.json`;
  const baseGrading = `${runPath}/baseline/grading.json`;
  const wsRunPath = `${runPath}/with-skill/${dt}`;
  const wsOut = `${wsRunPath}/outputs`;
  const wsTiming = `${wsRunPath}/timing.json`;
  const wsGrading = `${wsRunPath}/grading.json`;

  await Deno.mkdir(baseOut, { recursive: true });
  await Deno.mkdir(wsOut, { recursive: true });

  let ok = true;

  if (!flags["skip-baseline"]) {
    const baseFiles: string[] = [];
    try { for await (const e of Deno.readDir(baseOut)) baseFiles.push(e.name); } catch { /* ok */ }
    if (baseFiles.length > 0) {
      console.error(`[${eid}] baseline outputs exist, skipping`);
    } else {
      const r = await runScript(
        `${eid}/baseline`,
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
    const r = await runScript(
      `${eid}/with-skill`,
      "run-agent.ts",
      {
        prompt: entry.prompt,
        "output-dir": wsOut,
        model: flags.model,
        dir: flags["workspace-dir"],
        "timing-file": wsTiming,
        skill: `${flags["skill-dir"]}/SKILL.md`,
      },
    );
    if (!r) ok = false;
  }

  let gradeOk = true;

  try {
    await Deno.stat(baseGrading);
    console.error(`[${eid}] baseline grading exists, skipping`);
  } catch {
    if (!await runScript(`${eid}/baseline`, "run-grader.ts", {
      assertions: JSON.stringify(entry.assertions),
      "outputs-dir": baseOut,
      model: flags.model,
      dir: flags["workspace-dir"],
      "grading-file": baseGrading,
    })) gradeOk = false;
  }

  try {
    await Deno.stat(wsGrading);
    console.error(`[${eid}] with-skill grading exists, skipping`);
  } catch {
    if (!await runScript(`${eid}/with-skill`, "run-grader.ts", {
      assertions: JSON.stringify(entry.assertions),
      "outputs-dir": wsOut,
      model: flags.model,
      dir: flags["workspace-dir"],
      "grading-file": wsGrading,
    })) gradeOk = false;
  }

  if (!gradeOk) ok = false;

  return ok;
}

async function main() {
  const flags = parseFlags();
  const dt = dateTimeStamp();

  const evalsPath = `${flags["skill-dir"]}/evals/evals.json`;
  let evalFile: { evals: { id: number | string; prompt: string; assertions?: string[] }[] };
  try {
    evalFile = JSON.parse(await Deno.readTextFile(evalsPath));
  } catch (err) {
    console.error(`Error reading ${evalsPath}: ${err}`);
    Deno.exit(1);
  }

  let entries = evalFile.evals;
  if (flags.entries.length > 0) {
    entries = entries.filter((e) => flags.entries.includes(String(e.id)));
  }

  if (entries.length === 0) {
    console.error("No eval entries to run");
    Deno.exit(1);
  }

  await Deno.mkdir(flags["workspace-dir"], { recursive: true });

  console.error(`Benchmark: ${flags.skill}  |  Model: ${flags.model}`);
  console.error(`Workspace: ${flags["workspace-dir"]}`);
  console.error(`Entries: ${entries.length}  |  Parallel: ${flags.parallel}`);
  console.error(`Date-time: ${dt}`);
  console.error("");

  const tasks = entries.map(
    (entry) => () => processEntry(
      { id: entry.id, prompt: entry.prompt, assertions: entry.assertions ?? [] },
      flags,
      dt,
    ),
  );

  const results = await runWithConcurrency(tasks, flags.parallel);
  const allOk = results.every(Boolean);
  const failCount = results.filter((r) => !r).length;

  console.error("");
  if (failCount > 0) {
    console.error(`${failCount} / ${entries.length} entries had failures`);
  }

  const benchFile = `${flags["workspace-dir"]}/benchmark.${flags.slug}.${dt}.json`;
  console.error("Aggregating results...");
  const aggOk = await runScript("aggregate", "aggregate-benchmark.ts", {
    "workspace-dir": flags["workspace-dir"],
    "benchmark-file": benchFile,
  });

  if (aggOk) {
    console.error(`\nBenchmark written to: ${benchFile}`);
  }

  Deno.exit(allOk ? 0 : 1);
}

if (import.meta.main) main();
