export function resolveCommand(envKey: string, defaultCmd: string): string {
  return Deno.env.get(envKey)?.trim() || defaultCmd;
}

export async function commandOnPath(command: string): Promise<boolean> {
  const bin = command.split("/").pop() ?? command;
  const which = new Deno.Command("which", { args: [bin], stderr: "null" });
  return (await which.output()).success;
}

export async function assertCommandOnPath(cmd: string): Promise<void> {
  if (!(await commandOnPath(cmd))) {
    throw new Error(`${cmd} not found in PATH`);
  }
}

export interface ProcessResult {
  success: boolean;
  code: number;
  stdout: string;
  durationMs: number;
}

export async function runProcess(options: {
  bin: string;
  args: string[];
  cwd: string;
}): Promise<ProcessResult> {
  const startTime = Date.now();
  const proc = new Deno.Command(options.bin, {
    args: options.args,
    cwd: options.cwd,
    stdout: "piped",
    stderr: "inherit",
  });
  const result = await proc.output();
  return {
    success: result.success,
    code: result.code,
    stdout: new TextDecoder().decode(result.stdout),
    durationMs: Date.now() - startTime,
  };
}
