import type { Harness, HarnessId } from "./types.ts";
import { createGenericCliHarness } from "./custom.ts";

const HARNESS_IDS: readonly HarnessId[] = ["opencode", "cursor", "claude-code", "codex"];

const loaders: Record<HarnessId, () => Promise<Harness>> = {
  opencode: () => import("./opencode.ts").then((m) => m.opencodeHarness),
  cursor: () => import("./cursor.ts").then((m) => m.cursorHarness),
  "claude-code": () => import("./claude-code.ts").then((m) => m.claudeCodeHarness),
  codex: () => import("./codex.ts").then((m) => m.codexHarness),
};

const cache = new Map<string, Harness>();

export function listHarnessIds(): string[] {
  return [...HARNESS_IDS];
}

/** True if the id matches a built-in harness. */
export function isBuiltinHarness(id: string): boolean {
  return HARNESS_IDS.includes(id as HarnessId);
}

export async function getHarness(id: string): Promise<Harness> {
  const cached = cache.get(id);
  if (cached) return cached;

  // Lazy-load built-in harnesses, create generic harness for custom IDs.
  if (isBuiltinHarness(id)) {
    const harness = await loaders[id as HarnessId]!();
    cache.set(id, harness);
    return harness;
  }

  const custom = createGenericCliHarness(id);
  cache.set(id, custom);
  return custom;
}

export async function resolveModel(harnessId: string, provided?: string): Promise<string> {
  return (await getHarness(harnessId)).resolveModel(provided);
}
