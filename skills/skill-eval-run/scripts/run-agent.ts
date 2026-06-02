#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { resolveHarnessId } from "./lib/harness/env.ts";
import { getHarness } from "./lib/harness/registry.ts";
import { writeTimingFile } from "./lib/harness/write-timing.ts";
import { DEFAULT_TIMEOUT_SECONDS } from "./lib/constants.ts";
import type { AgentRunRequest } from "./lib/harness/types.ts";

const HELP_TEXT = `Usage: run-agent.ts [OPTIONS]

Run an agent via the selected harness and write timing.json.

Options:
  --prompt TEXT       Task description for the agent (required)
  --output-dir PATH   Directory where agent writes output files (required)
  --model NAME        Model identifier — harness-specific (required)
  --timing-file PATH  Output path for timing.json (required)
  --dir PATH          Working directory (default: .)
  --skill PATH        Path to SKILL.md to load (omit for baseline)
  --harness NAME      Agent harness (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
  --timeout NUMBER    Agent timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --no-headless       Do not pass headless / skip-permission flags to the harness

Exit codes:
  0   Agent completed
  1   Agent failed or errored
  2   Invalid arguments
`;

type ParsedFlags = {
  prompt: string;
  outputDir: string;
  model: string;
  timingFile: string;
  dir: string;
  skill: string | undefined;
  harness: string;
  headless: boolean;
  timeoutMs: number;
};

async function parseFlags(): Promise<
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number }
> {
  const base = parseCLI({
    strings: ["prompt", "output-dir", "model", "timing-file", "dir", "skill", "harness", "timeout"],
    booleans: ["no-headless"],
    required: ["prompt", "output-dir", "model", "timing-file"],
    defaults: { dir: ".", timeout: String(DEFAULT_TIMEOUT_SECONDS) },
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  try {
    const parsed = base.parsed;
    const timeoutSec = Math.max(1, parseInt(parsed.timeout as string, 10) || DEFAULT_TIMEOUT_SECONDS);

    return {
      success: true,
      flags: {
        prompt: parsed.prompt as string,
        outputDir: parsed["output-dir"] as string,
        model: parsed.model as string,
        timingFile: parsed["timing-file"] as string,
        dir: parsed.dir as string,
        skill: parsed.skill as string | undefined,
        harness: await resolveHarnessId(parsed.harness as string | undefined),
        headless: !parsed["no-headless"],
        timeoutMs: timeoutSec * 1000,
      },
    };
  } catch (err) {
    return { success: false, message: String(err), code: 1 };
  }
}

export interface RunAgentOptions extends AgentRunRequest {
  harness: string;
  timingFile: string;
}

export async function runAgentCore(options: RunAgentOptions): Promise<boolean> {
  await Deno.mkdir(options.outputDir, { recursive: true });
  const startTime = Date.now();

  try {
    const harness = await getHarness(options.harness);
    const result = await harness.run(options);
    await writeTimingFile(options.timingFile, result);

    if (!result.ok) {
      console.error(result.error ?? "Agent run failed");
      return false;
    }
    return true;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    try {
      await writeTimingFile(options.timingFile, {
        ok: false,
        durationMs,
        totalTokens: 0,
        tokensSource: "none",
        error: String(err),
      });
    } catch { /* best-effort */ }
    console.error(`Error: ${err}`);
    return false;
  }
}

async function main() {
  await loadEnvFiles();
  const parsed = await parseFlags();
  if (!parsed.success) {
    console.error(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;
  const ok = await runAgentCore({
    prompt: flags.prompt,
    outputDir: flags.outputDir,
    model: flags.model,
    cwd: flags.dir,
    skillPath: flags.skill,
    headless: flags.headless,
    timeoutMs: flags.timeoutMs,
    timingFile: flags.timingFile,
    harness: flags.harness,
  });
  Deno.exit(ok ? 0 : 1);
}

if (import.meta.main) main();
