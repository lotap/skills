import type { Harness } from "./types.ts";
import { resolveCommand } from "./command.ts";
import { requireModel } from "./model.ts";
import { runCliHarness } from "./run-cli.ts";
import { tokensFromJson } from "./tokens.ts";

export function claudeCommand(): string {
  return resolveCommand("CLAUDE_CODE_CMD", "claude");
}

export const claudeCodeHarness: Harness = {
  id: "claude-code",

  resolveModel(provided?: string): Promise<string> {
    return Promise.resolve(requireModel(
      "claude-code",
      provided,
      ["ANTHROPIC_MODEL", "CLAUDE_MODEL"],
      "claude-sonnet-4-6",
    ));
  },

  run(req) {
    const bin = claudeCommand();
    return runCliHarness(req, {
      bin,
      label: bin,
      parseTokens: tokensFromJson,
      buildArgs: ({ message, req }) => {
        const args = [
          "-p",
          message,
          "--model",
          req.model,
          "--output-format",
          "json",
          "--add-dir",
          req.outputDir,
          "--add-dir",
          req.cwd,
        ];
        if (req.headless) args.push("--dangerously-skip-permissions");
        return args;
      },
    });
  },
};
