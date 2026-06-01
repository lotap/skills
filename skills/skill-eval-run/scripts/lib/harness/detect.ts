import type { HarnessId } from "./types.ts";
import { commandOnPath } from "./command.ts";
import { cursorAgentCommand } from "./cursor.ts";
import { claudeCommand } from "./claude-code.ts";
import { codexCommand } from "./codex.ts";
import { opencodeAvailable } from "./opencode.ts";

export interface HarnessDetection {
  id: HarnessId;
  reason: string;
}

/** Probe PATH for known agent CLIs. Returns what's available, no ordering. */
export async function detectAvailableHarnesses(): Promise<HarnessDetection[]> {
  const found: HarnessDetection[] = [];

  const agentCmd = cursorAgentCommand();
  if (await commandOnPath(agentCmd)) {
    found.push({ id: "cursor", reason: `${agentCmd} found on PATH` });
  }

  const claudeCmd = claudeCommand();
  if (await commandOnPath(claudeCmd)) {
    found.push({ id: "claude-code", reason: `${claudeCmd} found on PATH` });
  }

  const codexCmd = codexCommand();
  if (await commandOnPath(codexCmd)) {
    found.push({ id: "codex", reason: `${codexCmd} found on PATH` });
  }

  if (await opencodeAvailable()) {
    found.push({ id: "opencode", reason: "opencode found on PATH" });
  }

  return found;
}
