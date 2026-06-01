import { join, basename } from "jsr:@std/path";
import { parse, ValiError } from "npm:valibot";
import { EvalsFileSchema } from "./schemas/evals.ts";

export interface SkillValidation {
  name: string;
  evalsCount: number;
}

function parseSkillName(content: string, fallback: string): string {
  const match = content.match(/^name:\s*(.+)$/m);
  if (match) return match[1].trim();
  return fallback;
}

export async function validateSkillDir(skillDir: string): Promise<SkillValidation> {
  let skMd: string;
  try {
    skMd = await Deno.readTextFile(join(skillDir, "SKILL.md"));
  } catch {
    console.error(`${skillDir}/SKILL.md not found`);
    Deno.exit(1);
  }

  const name = parseSkillName(skMd, basename(skillDir) || skillDir);

  let evalsJson: string;
  try {
    evalsJson = await Deno.readTextFile(join(skillDir, "evals", "evals.json"));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.error(`${skillDir}/evals/evals.json not found — create one and re-run`);
    } else {
      console.error(`${skillDir}/evals/evals.json could not be read: ${err}`);
    }
    Deno.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(evalsJson);
  } catch (err) {
    console.error(`${skillDir}/evals/evals.json parse error: ${err}`);
    Deno.exit(1);
  }

  try {
    const parsed = parse(EvalsFileSchema, raw);
    return { name, evalsCount: parsed.evals.length };
  } catch (err) {
    if (err instanceof ValiError) {
      console.error(`${skillDir}/evals/evals.json schema error:`);
      for (const issue of err.issues) {
        const path = issue.path?.map((p: { key: string | number }) => p.key).join(".") ?? "?";
        console.error(`  ${path}: ${issue.message}`);
      }
    } else {
      console.error(`${skillDir}/evals/evals.json validation error: ${err}`);
    }
    Deno.exit(1);
  }
}
