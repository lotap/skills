import { dirname, join, normalize, resolve, fromFileUrl } from "jsr:@std/path";

const SKILL_EVAL_RUN_ROOT = resolve(
  join(dirname(fromFileUrl(import.meta.url)), "../.."),
);

/** Parse `KEY=value` lines; does not override existing `Deno.env` entries. */
function applyEnvFile(path: string): boolean {
  let text: string;
  try {
    text = Deno.readTextFileSync(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    let body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;

    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Deno.env.has(key)) continue;

    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }

    Deno.env.set(key, value);
  }

  return true;
}

function envFileFlagFromArgs(): string | undefined {
  const args = Deno.args;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--env-file" && args[i + 1]) return args[i + 1];
    if (arg.startsWith("--env-file=")) return arg.slice("--env-file=".length);
  }
  return undefined;
}

function collectEnvFilePaths(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const add = (path: string) => {
    const abs = normalize(resolve(path));
    if (seen.has(abs)) return;
    seen.add(abs);
    ordered.push(abs);
  };

  const flag = envFileFlagFromArgs();
  if (flag) add(flag);

  const explicit = Deno.env.get("SKILL_EVAL_ENV_FILE")?.trim();
  if (explicit) add(explicit);

  const fromCwd: string[] = [];
  let dir = Deno.cwd();
  while (true) {
    fromCwd.push(join(dir, ".env"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const path of fromCwd.reverse()) add(path);

  add(join(SKILL_EVAL_RUN_ROOT, ".env"));

  return ordered;
}

/** Load `.env` files into `Deno.env` (existing env vars win). */
export function loadEnvFiles(): string[] {
  const loaded: string[] = [];
  for (const path of collectEnvFilePaths()) {
    if (applyEnvFile(path)) loaded.push(path);
  }
  return loaded;
}

const loadedPaths = loadEnvFiles();
if (loadedPaths.length > 0) {
  console.error(`[skill-eval-run] loaded env: ${loadedPaths.join(", ")}`);
}
