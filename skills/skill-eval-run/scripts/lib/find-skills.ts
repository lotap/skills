import { join, basename, dirname } from "jsr:@std/path";

export interface SkillInfo {
  name: string;
  dir: string;
  hasEvals: boolean;
}

function parseSkillName(filePath: string, content: string): string {
  const match = content.match(/^name:\s*(.+)$/m);
  if (match) return match[1].trim();
  return basename(dirname(filePath)) || "unknown";
}

export async function findAllSkills(searchDirs: string[]): Promise<SkillInfo[]> {
  const results: SkillInfo[] = [];

  for (const searchDir of searchDirs) {
    try {
      for await (const entry of Deno.readDir(searchDir)) {
        if (!entry.isDirectory) continue;

        const skillDir = join(searchDir, entry.name);
        const skillMdPath = join(skillDir, "SKILL.md");

        try {
          const content = await Deno.readTextFile(skillMdPath);
          const name = parseSkillName(skillMdPath, content);

          let hasEvals = false;
          try {
            await Deno.stat(join(skillDir, "evals", "evals.json"));
            hasEvals = true;
          } catch {
            // no evals file
          }

          results.push({ name, dir: skillDir, hasEvals });
        } catch {
          // no SKILL.md in this subdirectory
        }
      }
    } catch {
      // searchDir doesn't exist or can't be listed
    }
  }

  return results;
}
