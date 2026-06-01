import type { AgentRunRequest, AgentRunResult, Harness } from "./types.ts";
import { assertCommandOnPath } from "./command.ts";
import { constructAgentMessage } from "./message.ts";
import { runProcess } from "./command.ts";
import { buildAgentResult, tokensFromJsonOrJsonl } from "./tokens.ts";

/**
 * Create a generic CLI harness for an arbitrary binary.
 *
 * Runs `<bin> <message>` as a single positional argument, measures wall-clock
 * duration, and attempts JSON/JSONL token extraction from stdout. Model
 * resolution delegates to --model / SKILL_EVAL_MODEL.
 */
export function createGenericCliHarness(id: string): Harness {
  return {
    id,

    resolveModel(provided?: string): Promise<string> {
      if (provided?.trim()) return Promise.resolve(provided.trim());
      const env = Deno.env.get("SKILL_EVAL_MODEL")?.trim();
      if (env) return Promise.resolve(env);
      console.error(
        `No model specified for custom harness "${id}". Provide --model or set SKILL_EVAL_MODEL.`,
      );
      Deno.exit(1);
    },

    async run(req: AgentRunRequest): Promise<AgentRunResult> {
      await assertCommandOnPath(id);
      const message = constructAgentMessage(req.prompt, req.outputDir, req.skillPath);
      const proc = await runProcess({ bin: id, args: [message], cwd: req.cwd });
      return buildAgentResult(proc, id, tokensFromJsonOrJsonl);
    },
  };
}
