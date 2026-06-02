import { resolveProvidedOrEnv } from "./env.ts";

export function exitMissingModel(
  harnessId: string,
  envKeys: string[],
  examples: string,
): never {
  const envHint = ["SKILL_EVAL_MODEL", ...envKeys].join(", ");
  throw new Error(
    `Could not resolve model for ${harnessId} harness. Provide --model or set ${envHint}.\n` +
    `Examples: ${examples}`,
  );
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
