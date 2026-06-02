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
    throw new Error(`${skillDir}/SKILL.md not found`);
  }

  const name = parseSkillName(skMd, basename(skillDir) || skillDir);

  let evalsJson: string;
  try {
    evalsJson = await Deno.readTextFile(join(skillDir, "evals", "evals.json"));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new Error(`${skillDir}/evals/evals.json not found — create one and re-run`);
    }
    throw new Error(`${skillDir}/evals/evals.json could not be read: ${err}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(evalsJson);
  } catch (err) {
    throw new Error(`${skillDir}/evals/evals.json parse error: ${err}`);
  }

  try {
    const parsed = parse(EvalsFileSchema, raw);
    return { name, evalsCount: parsed.evals.length };
  } catch (err) {
    if (err instanceof ValiError) {
      const details = err.issues.map(
        (issue: { path?: { key: string | number }[]; message: string }) =>
          `  ${issue.path?.map((p) => p.key).join(".") ?? "?"}: ${issue.message}`,
      ).join("\n");
      throw new Error(`${skillDir}/evals/evals.json schema error:\n${details}`);
    }
    throw new Error(`${skillDir}/evals/evals.json validation error: ${err}`);
  }
}
