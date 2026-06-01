import type { AgentRunRequest, AgentRunResult } from "./types.ts";
import { assertCommandOnPath, runProcess } from "./command.ts";
import { constructAgentMessage } from "./message.ts";
import { buildAgentResult } from "./tokens.ts";

export interface CliHarnessRunOptions {
  bin: string;
  buildArgs: (ctx: {
    message: string;
    req: AgentRunRequest;
  }) => string[];
  label: string;
  parseTokens?: (stdout: string) => number | null;
}

export async function runCliHarness(
  req: AgentRunRequest,
  options: CliHarnessRunOptions,
): Promise<AgentRunResult> {
  await assertCommandOnPath(options.bin);
  const message = constructAgentMessage(req.prompt, req.outputDir, req.skillPath);
  const args = options.buildArgs({ message, req });
  const proc = await runProcess({ bin: options.bin, args, cwd: req.cwd, timeoutMs: req.timeoutMs });
  return buildAgentResult(proc, options.label, options.parseTokens);
}
