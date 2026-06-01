export function resolveCommand(envKey: string, defaultCmd: string): string {
  return Deno.env.get(envKey)?.trim() || defaultCmd;
}

export async function commandOnPath(command: string): Promise<boolean> {
  const bin = command.split("/").pop() ?? command;

  // Try POSIX `command -v` first
  try {
    const sh = new Deno.Command("sh", {
      args: ["-c", `command -v ${JSON.stringify(bin)}`],
      stderr: "null",
      stdout: "null",
    });
    if ((await sh.output()).success) return true;
  } catch { /* ignore */ }

  // Fallback to Windows `where`
  try {
    const where = new Deno.Command("where", { args: [bin], stderr: "null" });
    if ((await where.output()).success) return true;
  } catch { /* ignore */ }

  return false;
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
  stderr: string;
  durationMs: number;
}

export async function runProcess(options: {
  bin: string;
  args: string[];
  cwd: string;
  timeoutMs?: number;
}): Promise<ProcessResult> {
  const startTime = Date.now();

  const proc = new Deno.Command(options.bin, {
    args: options.args,
    cwd: options.cwd,
    stdout: "piped",
    stderr: "piped",
  });

  const child = proc.spawn();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // Process may have already exited
      }
    }, options.timeoutMs);
  }

  async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
    try {
      return await new Response(stream).text();
    } catch {
      return "";
    }
  }

  let status: Deno.CommandStatus;
  let stdout = "";
  let stderr = "";

  try {
    const stdoutPromise = streamToText(child.stdout);
    const stderrPromise = streamToText(child.stderr);
    [status, stdout, stderr] = await Promise.all([
      child.status,
      stdoutPromise,
      stderrPromise,
    ]);
  } catch (err) {
    if (timedOut) {
      return {
        success: false,
        code: -1,
        stdout,
        stderr: stderr || `Timeout after ${options.timeoutMs}ms`,
        durationMs: Date.now() - startTime,
      };
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  return {
    success: status.success,
    code: status.code,
    stdout,
    stderr,
    durationMs: Date.now() - startTime,
  };
}
