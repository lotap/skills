import type { Harness } from "./types.ts";
import { resolveCommand } from "./command.ts";
import { resolveProvidedOrEnv } from "./env.ts";
import { runCliHarness } from "./run-cli.ts";
import { tokensFromJsonOrJsonl } from "./tokens.ts";

export function cursorAgentCommand(): string {
  return resolveCommand("CURSOR_AGENT_CMD", "agent");
}

export const cursorHarness: Harness = {
  id: "cursor",

  resolveModel(provided?: string): Promise<string> {
    return Promise.resolve(resolveProvidedOrEnv(provided, "CURSOR_MODEL") ?? "auto");
  },

  run(req) {
    const bin = cursorAgentCommand();
    return runCliHarness(req, {
      bin,
      label: bin,
      parseTokens: tokensFromJsonOrJsonl,
      buildArgs: ({ message, req }) => {
        const args = [
          "--print",
          "--trust",
          "--workspace",
          req.cwd,
          "--model",
          req.model,
          "--output-format",
          "json",
        ];
        if (req.headless) {
          args.push("--force", "--approve-mcps");
        }
        args.push(message);
        return args;
      },
    });
  },
};
