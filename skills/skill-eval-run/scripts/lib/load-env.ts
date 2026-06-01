import { dirname, join, normalize, resolve, fromFileUrl } from "jsr:@std/path";
import { load } from "jsr:@std/dotenv";

const SKILL_EVAL_RUN_ROOT = resolve(
  join(dirname(fromFileUrl(import.meta.url)), "../.."),
);

/** Parse `.env` file; does not override existing `Deno.env` entries. */
async function applyEnvFile(path: string): Promise<boolean> {
  try {
    const env = await load({ envPath: path, export: false });
    for (const [key, value] of Object.entries(env)) {
      if (!Deno.env.has(key)) {
        Deno.env.set(key, value);
      }
    }
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
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
export async function loadEnvFiles(): Promise<string[]> {
  const loaded: string[] = [];
  for (const path of collectEnvFilePaths()) {
    if (await applyEnvFile(path)) loaded.push(path);
  }
  return loaded;
}


