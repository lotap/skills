#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { join, dirname } from "jsr:@std/path";
import { safeParse } from "npm:valibot";
import { GradingSchema } from "./lib/schemas/grading.ts";
import { resolveHarnessId, validateHarnessId } from "./lib/harness/env.ts";
import { runAgentCore } from "./run-agent.ts";
import { DEFAULT_TIMEOUT_SECONDS } from "./lib/constants.ts";

const HELP_TEXT = `Usage: run-grader.ts [OPTIONS]

Grade outputs against assertions. Runs an agent to evaluate, then validates
the result with the grading schema and writes grading.json via lib.

Options:
  --assertions JSON    JSON array of assertion strings (required)
  --outputs-dir PATH   Directory with agent output files (required)
  --model NAME         Model identifier (required, harness-specific)
  --grading-file PATH  Output path for grading.json (required)
  --dir PATH           Working directory (default: .)
  --harness NAME       Harness for eval runs (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
  --grader-harness NAME  Harness for grading (default: same as --harness)

Exit codes:
  0   Grading written and valid
  1   Grading failed or invalid
  2   Invalid arguments
`;

type ParsedFlags = {
  assertions: string[];
  "outputs-dir": string;
  model: string;
  "grading-file": string;
  dir: string;
  harness: string;
  timeoutMs: number;
};

async function parseFlags(): Promise<
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number }
> {
  const base = parseCLI({
    strings: [
      "assertions",
      "outputs-dir",
      "model",
      "grading-file",
      "dir",
      "harness",
      "grader-harness",
      "timeout",
    ],
    required: ["assertions", "outputs-dir", "model", "grading-file"],
    defaults: { dir: ".", timeout: String(DEFAULT_TIMEOUT_SECONDS) },
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  const parsed = base.parsed;

  let assertions: string[];
  try {
    assertions = JSON.parse(parsed.assertions as string);
    if (!Array.isArray(assertions)) throw new Error();
  } catch {
    return { success: false, message: "Error: --assertions must be a valid JSON array of strings", code: 2 };
  }

  const harness = await resolveHarnessId(parsed.harness as string | undefined);
  const graderHarness = parsed["grader-harness"]
    ? validateHarnessId(parsed["grader-harness"] as string)
    : harness;

  const timeoutSec = Math.max(1, parseInt(parsed.timeout as string, 10) || DEFAULT_TIMEOUT_SECONDS);

  return {
    success: true,
    flags: {
      assertions,
      "outputs-dir": parsed["outputs-dir"] as string,
      model: parsed.model as string,
      "grading-file": parsed["grading-file"] as string,
      dir: parsed.dir as string,
      harness: graderHarness,
      timeoutMs: timeoutSec * 1000,
    },
  };
}

function constructGradingPrompt(
  assertions: string[],
  outputsDir: string,
  gradingDir: string,
): string {
  const schema = `{
  "assertion_results": [
    { "text": string, "passed": boolean, "evidence": string }
  ],
  "summary": { "passed": number, "failed": number, "total": number, "pass_rate": number }
}`;

  return `You are a grader. Evaluate whether the outputs satisfy the following assertions.

First, list and read the files in the outputs directory to understand what was produced. Then evaluate each assertion.

Assertions:
${assertions.map((a, i) => `  ${i + 1}. ${JSON.stringify(a)}`).join("\n")}

Outputs directory: ${outputsDir}

Write a grading.json file in ${gradingDir} using this exact schema:

${schema}

Rules:
- PASS only when you find clear, specific evidence.
- Fail when evidence is absent, superficial, or contradicts the assertion.
- The \`text\` field must contain the exact assertion text.
- The summary must match the results array (passed + failed = total).`;
}

export async function runGraderCore(options: {
  assertions: string[];
  outputsDir: string;
  model: string;
  gradingFile: string;
  dir: string;
  harness: string;
  timeoutMs?: number;
}): Promise<boolean> {
  const gradingDir = dirname(options.gradingFile);

  await Deno.mkdir(gradingDir, { recursive: true });

  const prompt = constructGradingPrompt(
    options.assertions,
    options.outputsDir,
    gradingDir,
  );

  const tempTiming = join(gradingDir, ".grading-timing.json");

  const agentOk = await runAgentCore({
    prompt,
    outputDir: gradingDir,
    model: options.model,
    harness: options.harness,
    cwd: options.dir,
    timingFile: tempTiming,
    timeoutMs: options.timeoutMs,
    headless: true,
  });

  try {
    await Deno.remove(tempTiming);
  } catch { /* ok */ }

  if (!agentOk) {
    console.error("Grader agent failed");
    return false;
  }

  const gradingPath = join(gradingDir, "grading.json");
  let raw: string;
  try {
    raw = await Deno.readTextFile(gradingPath);
  } catch {
    console.error("Error: grading.json not written by agent");
    return false;
  }

  let parsedGrading: unknown;
  try {
    parsedGrading = JSON.parse(raw);
  } catch {
    console.error("Error: grading.json is not valid JSON");
    return false;
  }

  const validation = safeParse(GradingSchema, parsedGrading);
  if (!validation.success) {
    console.error("Error: grading.json does not match schema");
    console.error(
      validation.issues?.map((i) => `  ${i.path?.map((p) => p.key).join(".") ?? "?"}: ${i.message}`).join("\n"),
    );
    return false;
  }

  await Deno.writeTextFile(options.gradingFile, JSON.stringify(validation.output, null, 2) + "\n");
  console.error(`Grading written to ${options.gradingFile}`);
  return true;
}

async function main() {
  await loadEnvFiles();
  const parsed = await parseFlags();
  if (!parsed.success) {
    console.error(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;
  const ok = await runGraderCore({
    assertions: flags.assertions,
    outputsDir: flags["outputs-dir"],
    model: flags.model,
    gradingFile: flags["grading-file"],
    dir: flags.dir,
    harness: flags.harness,
    timeoutMs: flags.timeoutMs,
  });
  Deno.exit(ok ? 0 : 1);
}

if (import.meta.main) main();
