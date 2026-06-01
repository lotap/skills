import { isBuiltinHarness, listHarnessIds } from "./registry.ts";
import { detectAvailableHarnesses } from "./detect.ts";

/**
 * Validate a harness ID. Built-in IDs are accepted; any other string is treated
 * as a custom harness binary name (no validation needed — it will be resolved
 * at runtime by the registry).
 */
export function validateHarnessId(id: string): string {
  if (!isBuiltinHarness(id)) {
    console.error(
      `[harness] "${id}" is not a built-in harness. ` +
        `Using it as a custom binary name. ` +
        `Built-in: ${listHarnessIds().join(", ")}`,
    );
  }
  return id;
}

/**
 * Resolve harness: --harness flag → SKILL_EVAL_HARNESS → detect & prompt.
 *
 * When an explicit value is provided it is accepted as-is (built-in or custom).
 * When omitted the function probes PATH, prints what it found, and exits with
 * a message asking the caller to confirm via --harness or SKILL_EVAL_HARNESS.
 * There is no default — the user must always affirm the harness choice.
 */
export async function resolveHarnessId(flag?: string): Promise<string> {
  const explicit = flag?.trim() || Deno.env.get("SKILL_EVAL_HARNESS")?.trim();
  if (explicit) {
    return validateHarnessId(explicit);
  }

  const detected = await detectAvailableHarnesses();

  if (detected.length === 0) {
    console.error("No agent harness detected on PATH.");
    console.error("Provide --harness or set SKILL_EVAL_HARNESS.");
    console.error(`Built-in: ${listHarnessIds().join(", ")}`);
    console.error("Custom:   --harness <binary-name> (any CLI on PATH)");
    Deno.exit(2);
  }

  console.error("Detected agent harnesses:");
  for (const h of detected) {
    console.error(`  ${h.id}  (${h.reason})`);
  }
  console.error("");
  console.error("Confirm with --harness <id> or set SKILL_EVAL_HARNESS.");
  Deno.exit(2);
}

/** Model from flag, then SKILL_EVAL_MODEL, then harness-specific env keys. */
export function resolveProvidedOrEnv(
  provided: string | undefined,
  ...harnessEnvKeys: string[]
): string | undefined {
  if (provided?.trim()) return provided.trim();
  const skillEval = Deno.env.get("SKILL_EVAL_MODEL")?.trim();
  if (skillEval) return skillEval;
  for (const key of harnessEnvKeys) {
    const value = Deno.env.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}
