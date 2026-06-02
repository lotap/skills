import type { Harness } from "./types.ts";
import { commandOnPath } from "./command.ts";
import { resolveProvidedOrEnv } from "./env.ts";
import { exitMissingModel } from "./model.ts";
import { runCliHarness } from "./run-cli.ts";
import { tokensFromOpencodeJsonl } from "./tokens.ts";

async function listOpencodeModels(): Promise<string[]> {
  try {
    const cmd = new Deno.Command("opencode", {
      args: ["models"],
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await cmd.output();
    if (!success) return [];
    return new TextDecoder().decode(stdout).trim().split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function fuzzyMatch(provided: string, available: string[]): string | null {
  const lower = provided.toLowerCase();
  // 1. Exact case-insensitive match
  const exact = available.find((m) => m.toLowerCase() === lower);
  if (exact) return exact;
  // 2. Suffix exact match only
  for (const model of available) {
    const suffix = model.split("/").pop()?.toLowerCase();
    if (suffix === lower) return model;
  }
  return null;
}


async function defaultOpencodeModel(): Promise<string | undefined> {
  try {
    const cmd = new Deno.Command("opencode", {
      args: ["config", "get", "model"],
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await cmd.output();
    if (!success) return undefined;
    const model = new TextDecoder().decode(stdout).trim();
    return model || undefined;
  } catch {
    return undefined;
  }
}

export const opencodeHarness: Harness = {
  id: "opencode",

  async resolveModel(provided?: string): Promise<string> {
    const candidate = resolveProvidedOrEnv(provided, "OPENCODE_MODEL");
    if (!candidate) {
      const configured = await defaultOpencodeModel();
      if (configured) return configured;
      exitMissingModel("opencode", ["OPENCODE_MODEL"], "opencode/gpt-4o");
    }

    const available = await listOpencodeModels();
    if (available.length === 0) return candidate;

    const match = fuzzyMatch(candidate, available);
    if (match) {
      if (match !== candidate) {
        console.error(`Model "${candidate}" resolved to "${match}"`);
      }
      return match;
    }

    throw new Error(
      `Model "${candidate}" not found among available opencode models.\n` +
      `Available models:\n  ${available.join("\n  ")}\n` +
      "Provide --model with a fully qualified model ID (e.g. opencode/gpt-4o).",
    );
  },

  run(req) {
    return runCliHarness(req, {
      bin: "opencode",
      label: "opencode",
      parseTokens: tokensFromOpencodeJsonl,
      buildArgs: ({ message, req }) => [
        "run",
        "--format",
        "json",
        ...(req.headless ? ["--dangerously-skip-permissions"] : []),
        "-m",
        req.model,
        "--dir",
        req.cwd,
        "--",
        message,
      ],
    });
  },
};

/** Used by harness detection. */
export function opencodeAvailable(): Promise<boolean> {
  return commandOnPath("opencode");
}
