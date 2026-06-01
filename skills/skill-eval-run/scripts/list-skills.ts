#!/usr/bin/env -S deno run --allow-all

import "./lib/load-env.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { findAllSkills } from "./lib/find-skills.ts";

function help(): never {
  console.error(`Usage: list-skills.ts [OPTIONS]

List available skills by searching for SKILL.md files.

Options:
  --dir PATH  Directory to search for skill subdirectories (default: ./skills)
`);
  Deno.exit(0);
}

async function main() {
  try {
    const parsed = parseArgs(Deno.args, {
      string: ["dir"],
      boolean: ["help"],
      alias: { h: "help" },
      default: { dir: "./skills" },
    });

    if (parsed.help) help();

    const skills = await findAllSkills([parsed.dir as string]);

    if (skills.length === 0) {
      console.error(`No skills found in ${parsed.dir}`);
      Deno.exit(1);
    }

    console.log(JSON.stringify(skills, null, 2));
  } catch (err) {
    console.error(`Error: ${err}`);
    Deno.exit(1);
  }
}

if (import.meta.main) main();
