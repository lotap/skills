import type { Harness } from "./types.ts";
import { resolveCommand } from "./command.ts";
import { requireModel } from "./model.ts";
import { runCliHarness } from "./run-cli.ts";
import { tokensFromJsonl } from "./tokens.ts";

export function codexCommand(): string {
  return resolveCommand("CODEX_CMD", "codex");
}

export const codexHarness: Harness = {
  id: "codex",

  resolveModel(provided?: string): Promise<string> {
    return Promise.resolve(requireModel(
      "codex",
      provided,
      ["CODEX_MODEL", "OPENAI_MODEL"],
      "gpt-5.3-codex",
    ));
  },

  run(req) {
    const bin = codexCommand();
    return runCliHarness(req, {
      bin,
      label: bin,
      parseTokens: tokensFromJsonl,
      buildArgs: ({ message, req }) => [
        "exec",
        "--json",
        "-C",
        req.cwd,
        "-m",
        req.model,
        ...(req.headless ? ["--full-auto"] : []),
        "--sandbox",
        "workspace-write",
        message,
      ],
    });
  },
};
