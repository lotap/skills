#!/usr/bin/env -S deno run --allow-all

import "./lib/load-env.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { resolveHarnessId } from "./lib/harness/env.ts";
import { resolveModel } from "./lib/harness/registry.ts";
import { validateSkillDir } from "./lib/validate-skill.ts";

function help(): never {
  console.error(`Usage: setup-workspace.ts [OPTIONS]

Validate a skill directory, resolve the model, create the workspace,
and print resolved config as JSON to stdout.

Options:
  --skill-dir PATH    Skill directory containing SKILL.md and evals/evals.json (required)
  --model NAME        Model ID (optional — see SKILL_EVAL_MODEL and harness-specific env)
  --workspace-dir PATH  Workspace directory (default: {skill-dir}-workspace)
  --harness NAME      Agent harness (required — built-in ID, custom binary, or SKILL_EVAL_HARNESS)
`);
  Deno.exit(0);
}

interface Config {
  skill: string;
  skillDir: string;
  harness: string;
  model: string;
  workspaceDir: string;
}

async function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["skill-dir", "model", "workspace-dir", "harness"],
    boolean: ["help"],
    alias: { h: "help" },
  });

  if (parsed.help) help();

  if (!parsed["skill-dir"]) {
    console.error("Missing required flag: --skill-dir");
    Deno.exit(1);
  }

  return {
    skillDir: parsed["skill-dir"] as string,
    model: parsed.model as string | undefined,
    workspaceDir: parsed["workspace-dir"] as string | undefined,
    harness: await resolveHarnessId(parsed.harness as string | undefined),
  };
}

async function main() {
  try {
    const flags = await parseFlags();
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
