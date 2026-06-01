#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from "jsr:@std/cli/parse-args";
import { resolveModel } from "./lib/resolve-model.ts";
import { validateSkillDir } from "./lib/validate-skill.ts";

function help(): never {
  console.error(`Usage: setup-workspace.ts [OPTIONS]

Validate a skill directory, resolve the model, create the workspace,
and print resolved config as JSON to stdout.

Options:
  --skill-dir PATH    Skill directory containing SKILL.md and evals/evals.json (required)
  --model NAME        Model ID (optional — auto-detected from env or opencode config)
  --workspace-dir PATH  Workspace directory (default: {skill-dir}-workspace)
`);
  Deno.exit(0);
}

interface Config {
  skill: string;
  skillDir: string;
  model: string;
  workspaceDir: string;
}

function parseFlags() {
  const parsed = parseArgs(Deno.args, {
    string: ["skill-dir", "model", "workspace-dir"],
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
  };
}

async function main() {
  try {
    const flags = parseFlags();

    const validation = await validateSkillDir(flags.skillDir);

    const model = await resolveModel(flags.model);

    const workspaceDir = flags.workspaceDir || `${flags.skillDir}-workspace`;

    await Deno.mkdir(workspaceDir, { recursive: true });

    const config: Config = {
      skill: validation.name,
      skillDir: flags.skillDir,
      model,
      workspaceDir,
    };

    console.error("");
    console.error(`Skill:     ${config.skill}`);
    console.error(`  dir:     ${config.skillDir}`);
    console.error(`  evals:   ${validation.evalsCount} entries`);
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
