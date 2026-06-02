#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { resolveHarnessId } from "./lib/harness/env.ts";
import { resolveModel } from "./lib/harness/registry.ts";
import { validateSkillDir } from "./lib/validate-skill.ts";

const HELP_TEXT = `Usage: setup-workspace.ts [OPTIONS]

Validate a skill directory, resolve the model, create the workspace,
and print resolved config as JSON to stdout.

Options:
  --skill-dir PATH    Skill directory containing SKILL.md and evals/evals.json (required)
  --model NAME        Model ID (optional — see SKILL_EVAL_MODEL and harness-specific env)
  --workspace-dir PATH  Workspace directory (default: {skill-dir}-workspace)
  --harness NAME      Agent harness (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
`;

interface Config {
  skill: string;
  skillDir: string;
  harness: string;
  model: string;
  workspaceDir: string;
}

type ParsedFlags = {
  skillDir: string;
  model: string | undefined;
  workspaceDir: string | undefined;
  harness: string;
};

async function parseFlags(): Promise<
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number }
> {
  const base = parseCLI({
    strings: ["skill-dir", "model", "workspace-dir", "harness"],
    required: ["skill-dir"],
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  try {
    return {
      success: true,
      flags: {
        skillDir: base.parsed["skill-dir"] as string,
        model: base.parsed.model as string | undefined,
        workspaceDir: base.parsed["workspace-dir"] as string | undefined,
        harness: await resolveHarnessId(base.parsed.harness as string | undefined),
      },
    };
  } catch (err) {
    return { success: false, message: String(err), code: 1 };
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
  try {
    const validation = await validateSkillDir(flags.skillDir);
    const model = await resolveModel(flags.harness, flags.model);
    const workspaceDir = flags.workspaceDir || `${flags.skillDir}-workspace`;

    await Deno.mkdir(workspaceDir, { recursive: true });

    const config: Config = {
      skill: validation.name,
      skillDir: flags.skillDir,
      harness: flags.harness,
      model,
      workspaceDir,
    };

    console.error("");
    console.error(`Skill:     ${config.skill}`);
    console.error(`  dir:     ${config.skillDir}`);
    console.error(`  evals:   ${validation.evalsCount} entries`);
    console.error(`Harness:   ${config.harness}`);
    console.error(`Model:     ${config.model}`);
    console.error(`Workspace: ${config.workspaceDir}`);
    console.error("");

    console.log(JSON.stringify(config, null, 2));
  } catch (err) {
    console.error(`Error: ${err}`);
    Deno.exit(1);
  }
}

if (import.meta.main) main();
