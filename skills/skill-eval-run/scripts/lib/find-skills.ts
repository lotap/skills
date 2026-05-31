export interface SkillInfo {
  name: string;
  dir: string;
  hasEvals: boolean;
}

function parseSkillName(filePath: string, content: string): string {
  const match = content.match(/^name:\s*(.+)$/m);
  if (match) return match[1].trim();
  return filePath.split("/").slice(-2, -1)[0] || "unknown";
}

export async function findAllSkills(searchDirs: string[]): Promise<SkillInfo[]> {
  const results: SkillInfo[] = [];

  for (const searchDir of searchDirs) {
    try {
      for await (const entry of Deno.readDir(searchDir)) {
        if (!entry.isDirectory) continue;

        const skillDir = `${searchDir}/${entry.name}`;
        const skillMdPath = `${skillDir}/SKILL.md`;

        try {
          const content = await Deno.readTextFile(skillMdPath);
          const name = parseSkillName(skillMdPath, content);

          let hasEvals = false;
          try {
            await Deno.stat(`${skillDir}/evals/evals.json`);
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
