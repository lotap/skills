import { resolveProvidedOrEnv } from "./env.ts";

export function exitMissingModel(
  harnessId: string,
  envKeys: string[],
  examples: string,
): never {
  const envHint = ["SKILL_EVAL_MODEL", ...envKeys].join(", ");
  console.error(
    `Could not resolve model for ${harnessId} harness. Provide --model or set ${envHint}.`,
  );
  console.error(`Examples: ${examples}`);
  Deno.exit(1);
}

export function requireModel(
  harnessId: string,
  provided: string | undefined,
  envKeys: string[],
  examples: string,
): string {
  const candidate = resolveProvidedOrEnv(provided, ...envKeys);
  if (!candidate) exitMissingModel(harnessId, envKeys, examples);
  return candidate;
}
