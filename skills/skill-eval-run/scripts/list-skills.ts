#!/usr/bin/env -S deno run --allow-all

import { loadEnvFiles } from "./lib/load-env.ts";
import { parseCLI } from "./lib/parse-cli.ts";
import { findAllSkills } from "./lib/find-skills.ts";

const HELP_TEXT = `Usage: list-skills.ts [OPTIONS]

List available skills by searching for SKILL.md files.

Options:
  --dir PATH  Directory to search for skill subdirectories (default: ./skills)
`;

type ParsedFlags = {
  dir: string;
};

function parseFlags():
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number } {
  const base = parseCLI({
    strings: ["dir"],
    defaults: { dir: "./skills" },
    helpText: HELP_TEXT,
  });
  if (!base.success) return base;

  return {
    success: true,
    flags: {
      dir: base.parsed.dir as string,
    },
  };
}

async function main() {
  await loadEnvFiles();
  const parsed = parseFlags();
  if (!parsed.success) {
    console.error(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;
  try {
    const skills = await findAllSkills([flags.dir]);

    if (skills.length === 0) {
      console.error(`No skills found in ${flags.dir}`);
      Deno.exit(1);
    }

    console.log(JSON.stringify(skills, null, 2));
    Deno.exit(0);
  } catch (err) {
    console.error(`Error: ${err}`);
    Deno.exit(1);
  }
}

if (import.meta.main) main();
