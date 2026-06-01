#!/usr/bin/env -S deno run --allow-all

import "./lib/load-env.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join, dirname, fromFileUrl } from "jsr:@std/path";
import { parse, safeParse } from "npm:valibot";
import { GradingSchema } from "./lib/schemas/grading.ts";
import { sanitizeJson } from "./lib/helpers.ts";
import { resolveHarnessId, validateHarnessId } from "./lib/harness/env.ts";

function help(): never {
  console.error(`Usage: run-grader.ts [OPTIONS]

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
`);
  Deno.exit(0);
}

async function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: [
      "assertions",
      "outputs-dir",
      "model",
      "grading-file",
      "dir",
      "harness",
      "grader-harness",
    ],
    boolean: ["help"],
    alias: { h: "help" },
    default: { dir: "." },
  });

  if (parsed.help) help();

  const missing = ["assertions", "outputs-dir", "model", "grading-file"].filter(
    (k) => !parsed[k],
  );
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.join(", ")}`);
    Deno.exit(2);
  }

  let assertions: string[];
  try {
    assertions = JSON.parse(parsed.assertions as string);
    if (!Array.isArray(assertions)) throw new Error();
  } catch {
    console.error("Error: --assertions must be a valid JSON array of strings");
    Deno.exit(2);
  }

  const harness = await resolveHarnessId(parsed.harness as string | undefined);
  const graderHarness = parsed["grader-harness"]
    ? validateHarnessId(parsed["grader-harness"] as string)
    : harness;

  return {
    assertions,
    "outputs-dir": parsed["outputs-dir"] as string,
    model: parsed.model as string,
    "grading-file": parsed["grading-file"] as string,
    dir: parsed.dir as string,
    harness: graderHarness,
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

async function main() {
  const flags = await parseFlags();
  const gradingDir = dirname(flags["grading-file"]);

  await Deno.mkdir(gradingDir, { recursive: true });

  const prompt = constructGradingPrompt(
    flags.assertions,
    flags["outputs-dir"],
    gradingDir,
  );

  const scriptsDir = dirname(fromFileUrl(import.meta.url));
  const agentScript = join(scriptsDir, "run-agent.ts");
  const tempTiming = join(gradingDir, ".grading-timing.json");

  const graderArgs = [
    "run",
    "--allow-all",
    agentScript,
    "--prompt",
    prompt,
    "--output-dir",
    gradingDir,
    "--model",
    flags.model,
    "--dir",
    flags.dir,
    "--timing-file",
    tempTiming,
    "--harness",
    flags.harness,
  ];
  const graderCmd = new Deno.Command("deno", { args: graderArgs, stdout: "inherit", stderr: "inherit" });
  const ok = (await graderCmd.output()).success;

  try {
    await Deno.remove(tempTiming);
  } catch { /* ok */ }

  if (!ok) {
    console.error("Grader agent failed");
    Deno.exit(1);
  }

  const gradingPath = join(gradingDir, "grading.json");
  let raw: string;
  try {
    raw = await Deno.readTextFile(gradingPath);
  } catch {
    console.error("Error: grading.json not written by agent");
    Deno.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitizeJson(raw));
  } catch {
    console.error("Error: grading.json is not valid JSON");
    Deno.exit(1);
  }

  const validation = safeParse(GradingSchema, parsed);
  if (!validation.success) {
    console.error("Error: grading.json does not match schema");
    console.error(
      validation.issues?.map((i) => `  ${i.path?.map((p) => p.key).join(".") ?? "?"}: ${i.message}`).join("\n"),
    );
    Deno.exit(1);
  }

  parse(GradingSchema, validation.output);
  Deno.writeTextFileSync(flags["grading-file"], JSON.stringify(validation.output, null, 2) + "\n");
  console.error(`Grading written to ${flags["grading-file"]}`);
}

if (import.meta.main) main();
