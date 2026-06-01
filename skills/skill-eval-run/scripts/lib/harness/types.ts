export type HarnessId = "opencode" | "cursor" | "claude-code" | "codex";

export type TokensSource = "harness" | "estimated" | "none";

export interface AgentRunRequest {
  prompt: string;
  outputDir: string;
  model: string;
  cwd: string;
  skillPath?: string;
  headless: boolean;
  timeoutMs?: number;
}

export interface AgentRunResult {
  ok: boolean;
  durationMs: number;
  totalTokens: number;
  tokensSource: TokensSource;
  error?: string;
}

export interface Harness {
  readonly id: string;
  resolveModel(provided?: string): Promise<string>;
  run(req: AgentRunRequest): Promise<AgentRunResult>;
}
