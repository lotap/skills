#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse, safeParse } from "npm:valibot";
import { GradingSchema } from "./lib/schemas/grading.ts";

function help(): never {
  console.error(`Usage: run-grader.ts [OPTIONS]

Grade outputs against assertions. Runs an agent to evaluate, then validates
the result with the grading schema and writes grading.json via lib.

Options:
  --assertions JSON    JSON array of assertion strings (required)
  --outputs-dir PATH   Directory with agent output files (required)
  --model NAME         Model identifier (required)
  --grading-file PATH  Output path for grading.json (required)
  --dir  PATH          Working directory (default: .)

Exit codes:
  0   Grading written and valid
  1   Grading failed or invalid
  2   Invalid arguments
`);
  Deno.exit(0);
}

function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["assertions", "outputs-dir", "model", "grading-file", "dir"],
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

  return {
    assertions,
    "outputs-dir": parsed["outputs-dir"] as string,
    model: parsed.model as string,
    "grading-file": parsed["grading-file"] as string,
    dir: parsed.dir as string,
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
  const flags = parseFlags();
  const gradingDir = new URL("..", `file://${flags["grading-file"]}`).pathname;

  await Deno.mkdir(gradingDir, { recursive: true });

  const prompt = constructGradingPrompt(
    flags.assertions,
    flags["outputs-dir"],
    gradingDir,
  );

  const agentScript = new URL("run-agent.ts", import.meta.url).pathname;
  const tempTiming = `${gradingDir}/.grading-timing.json`;

  const graderArgs = [
    "run", "--allow-all", agentScript,
    "--prompt", prompt,
    "--output-dir", gradingDir,
    "--model", flags.model,
    "--dir", flags.dir,
    "--timing-file", tempTiming,
  ];
  const graderCmd = new Deno.Command("deno", { args: graderArgs, stdout: "inherit", stderr: "inherit" });
  const ok = (await graderCmd.output()).success;

  try { await Deno.remove(tempTiming); } catch { /* ok */ }

  if (!ok) {
    console.error("Grader agent failed");
    Deno.exit(1);
  }

  const gradingPath = `${gradingDir}/grading.json`;
  let raw: string;
  try {
    raw = await Deno.readTextFile(gradingPath);
  } catch {
    console.error("Error: grading.json not written by agent");
    Deno.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Error: grading.json is not valid JSON");
    Deno.exit(1);
  }

  const validation = safeParse(GradingSchema, parsed);
  if (!validation.success) {
    console.error("Error: grading.json does not match schema");
    console.error(validation.issues?.map((i) => `  ${i.path?.map((p) => p.key).join(".") ?? "?"}: ${i.message}`).join("\n"));
    Deno.exit(1);
  }

  parse(GradingSchema, validation.output);
  Deno.writeTextFileSync(flags["grading-file"], JSON.stringify(validation.output, null, 2) + "\n");
  console.error(`Grading written to ${flags["grading-file"]}`);
}

if (import.meta.main) main();
