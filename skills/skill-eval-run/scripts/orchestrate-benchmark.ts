#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { join } from "jsr:@std/path";
import { harnessModelSlug, dateTimeStamp, runWithConcurrency, warnUnknownEntryIds } from "./lib/helpers.ts";
import { resolveHarnessId } from "./lib/harness/env.ts";
import { runAgentCore } from "./run-agent.ts";
import { DEFAULT_TIMEOUT_SECONDS, DEFAULT_PARALLEL_ENTRIES } from "./lib/constants.ts";

function log(...args: unknown[]) {
  console.error("[benchmark]", ...args);
}

const HELP_TEXT = `Usage: orchestrate-benchmark.ts [OPTIONS]

Run agent phases for all eval entries (baseline and with-skill). Grade and
aggregate separately via grade-benchmark.ts and aggregate-benchmark.ts.

Options:
  --skill NAME        Skill name (e.g. cli-guidelines) (required)
  --skill-dir PATH    Full path to skill directory (required)
  --model NAME        Model identifier (required, harness-specific)
  --harness NAME      Agent harness (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
  --workspace-dir PATH  Workspace directory (default: {skill-dir}-workspace)
  --entries TEXT      Comma-separated entry IDs (default: all in evals.json)
  --parallel NUMBER   Max parallel entries (default: 2)
  --timeout NUMBER    Agent timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --skip-baseline     Skip baseline runs (use existing)
  --skip-with-skill   Skip with-skill runs

Exit codes:
  0   All agent runs succeeded
  1   Some agent runs failed
  2   Invalid arguments
`;

type ParsedFlags = {
  skill: string;
  "skill-dir": string;
  model: string;
  harness: string;
  slug: string;
  "workspace-dir": string;
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
    strings: ["skill", "skill-dir", "model", "harness", "workspace-dir", "entries", "timeout"],
    booleans: ["skip-baseline", "skip-with-skill"],
    required: ["skill", "skill-dir", "model"],
    defaults: { parallel: DEFAULT_PARALLEL_ENTRIES, timeout: String(DEFAULT_TIMEOUT_SECONDS) },
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  try {
    const parsed = base.parsed;
    const harness = await resolveHarnessId(parsed.harness as string | undefined);
    const skillDir = parsed["skill-dir"] as string;
    const modelStr = parsed.model as string;
    const workspaceDir = (parsed["workspace-dir"] as string | undefined) || `${skillDir}-workspace`;
    const entries = parsed.entries
      ? (parsed.entries as string).split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const parallel = Math.max(1, (parsed.parallel as number) || 2);
    const timeoutSec = Math.max(1, parseInt(parsed.timeout as string, 10) || DEFAULT_TIMEOUT_SECONDS);

    return {
      success: true,
      flags: {
        skill: parsed.skill as string,
        "skill-dir": skillDir,
        model: modelStr,
        harness,
        slug: harnessModelSlug(harness, modelStr.split("/").pop() || modelStr),
        "workspace-dir": workspaceDir,
        entries,
        parallel,
        "skip-baseline": !!parsed["skip-baseline"],
        "skip-with-skill": !!parsed["skip-with-skill"],
        timeoutMs: timeoutSec * 1000,
      },
    };
  } catch (err) {
    return { success: false, message: String(err), code: 1 };
  }
}

async function processEntry(
  entry: { id: number | string; prompt: string },
  flags: ParsedFlags,
  dt: string,
): Promise<boolean> {
  const eid = entry.id;
  const runPath = join(flags["workspace-dir"], String(eid), flags.slug);
  const baseOut = join(runPath, "baseline", "outputs");
  const baseTiming = join(runPath, "baseline", "timing.json");
  const wsRunPath = join(runPath, "with-skill", dt);
  const wsOut = join(wsRunPath, "outputs");
  const wsTiming = join(wsRunPath, "timing.json");

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
      const start = Date.now();
      const r = await runAgentCore({
        prompt: entry.prompt,
        outputDir: baseOut,
        model: flags.model,
        harness: flags.harness,
        cwd: flags["workspace-dir"],
        timingFile: baseTiming,
        timeoutMs: flags.timeoutMs,
        headless: true,
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      log(`entry=${eid} baseline: ${r ? "done" : "FAILED"} (${elapsed}s)`);
      if (!r) ok = false;
    }
  }

  if (!flags["skip-with-skill"]) {
    log(`entry=${eid} with-skill: starting...`);
    const start = Date.now();
    const r = await runAgentCore({
      prompt: entry.prompt,
      outputDir: wsOut,
      model: flags.model,
      harness: flags.harness,
      cwd: flags["workspace-dir"],
      timingFile: wsTiming,
      skillPath: join(flags["skill-dir"], "SKILL.md"),
      timeoutMs: flags.timeoutMs,
      headless: true,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`entry=${eid} with-skill: ${r ? "done" : "FAILED"} (${elapsed}s)`);
    if (!r) ok = false;
  }

  log(`entry=${eid}: ${ok ? "pass" : "FAIL"}`);

  return ok;
}

async function main() {
  await loadEnvFiles();
  const parsed = await parseFlags();
  if (!parsed.success) {
    log(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;
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
    warnUnknownEntryIds(flags.entries, evalFile.evals.map((e) => String(e.id)), log);
    entries = entries.filter((e) => flags.entries.includes(String(e.id)));
  }

  if (entries.length === 0) {
    log("No eval entries to run");
    Deno.exit(1);
  }

  await Deno.mkdir(flags["workspace-dir"], { recursive: true });

  log(`skill=${flags.skill} harness=${flags.harness} model=${flags.model} entries=${entries.length} parallel=${flags.parallel}`);

  const tasks = entries.map(
    (entry) => () => processEntry(
      { id: entry.id, prompt: entry.prompt },
      flags,
      dt,
    ),
  );

  const results = await runWithConcurrency(tasks, flags.parallel);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const allOk = results.every(Boolean);
  const passCount = results.filter((r) => r).length;

  log(`Benchmark agent runs complete: ${passCount}/${entries.length} passed (${totalTime}s total)`);

  Deno.exit(allOk ? 0 : 1);
}

if (import.meta.main) main();
