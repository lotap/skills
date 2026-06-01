import { join } from "jsr:@std/path";

export function modelSlugDir(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const queue = tasks.map((task, i) => ({ task, i }));
  const results = new Array<T>(tasks.length);
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      let item;
      while ((item = queue.shift())) {
        results[item.i] = await item.task();
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/** Pick the most recently modified subdirectory inside a directory. */
export function pickLatestDir(baseDir: string): string | undefined {
  try {
    const dirs = Array.from(Deno.readDirSync(baseDir)).filter((d) => d.isDirectory);
    if (dirs.length === 0) return undefined;
    dirs.sort((a, b) => {
      const mA = Deno.statSync(join(baseDir, a.name)).mtime?.getTime() ?? 0;
      const mB = Deno.statSync(join(baseDir, b.name)).mtime?.getTime() ?? 0;
      return mB - mA;
    });
    return dirs[0].name;
  } catch {
    return undefined;
  }
}

/** Strip backslash from invalid JSON escape sequences (e.g. \` → `). */
export function sanitizeJson(raw: string): string {
  return raw.replace(/\\([^"\\\/bfnrtu])/g, "$1");
}

export function dateTimeStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
