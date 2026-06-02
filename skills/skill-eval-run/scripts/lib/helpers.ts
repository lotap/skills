import { join } from "jsr:@std/path";

export function modelSlugDir(slug: string): string {
  return slug
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function harnessModelSlug(harness: string, model: string): string {
  return `${harness}-${modelSlugDir(model)}`;
}

export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      while (nextIndex < tasks.length) {
        const i = nextIndex++;
        results[i] = await tasks[i]();
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/** Pick the most recently modified subdirectory inside a directory. */
export async function pickLatestDir(baseDir: string): Promise<string | undefined> {
  try {
    const names: string[] = [];
    for await (const entry of Deno.readDir(baseDir)) {
      if (entry.isDirectory) names.push(entry.name);
    }
    if (names.length === 0) return undefined;
    const dirs = await Promise.all(
      names.map(async (name) => {
        const stat = await Deno.stat(join(baseDir, name));
        return { name, mtime: stat.mtime?.getTime() ?? 0 };
      }),
    );
    dirs.sort((a, b) => b.mtime - a.mtime);
    return dirs[0].name;
  } catch {
    return undefined;
  }
}

/** Log a warning for entry IDs that don't match any known valid ID. */
export function warnUnknownEntryIds(
  provided: string[],
  validIds: string[],
  logFn: (...args: unknown[]) => void = console.error,
): void {
  if (provided.length === 0) return;
  const valid = new Set(validIds);
  const unknown = provided.filter((id) => !valid.has(id));
  if (unknown.length > 0) {
    logFn(`Warning: unknown entry IDs: ${unknown.join(", ")}`);
  }
}

export function dateTimeStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
}
