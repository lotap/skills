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
    skMd = await Deno.readTextFile(`${skillDir}/SKILL.md`);
  } catch {
    console.error(`${skillDir}/SKILL.md not found`);
    Deno.exit(1);
  }

  const name = parseSkillName(skMd, skillDir.split("/").pop() || skillDir);

  let evalsJson: string;
  try {
    evalsJson = await Deno.readTextFile(`${skillDir}/evals/evals.json`);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.error(`${skillDir}/evals/evals.json not found — create one and re-run`);
    } else {
      console.error(`${skillDir}/evals/evals.json could not be read: ${err}`);
    }
    Deno.exit(1);
  }

  let parsed: { evals?: unknown[] };
  try {
    parsed = JSON.parse(evalsJson);
  } catch (err) {
    console.error(`${skillDir}/evals/evals.json parse error: ${err}`);
    Deno.exit(1);
  }

  if (!Array.isArray(parsed.evals) || parsed.evals.length === 0) {
    console.error(`${skillDir}/evals/evals.json has no eval entries`);
    Deno.exit(1);
  }

  return { name, evalsCount: parsed.evals.length };
}
