# Fix Plan: deterministic-eval-scripts Branch

## Decisions Confirmed
- `sanitizeJson` → **removed entirely**; fail on invalid JSON
- `aggregate-benchmark.ts` missing phase → **Option B** (exit with clear message)
- `--timeout-ms` → **Option B** (flag on all 3 agent-calling scripts with relaxed defaults)

---

## Step 1: Remove `load-env.ts` module-level side effects

**File:** `skills/skill-eval-run/scripts/lib/load-env.ts`

**Changes:**
- Remove the bottom-of-file auto-execution block (lines 97-100):
  ```ts
  const loadedPaths = loadEnvFiles();
  if (loadedPaths.length > 0) {
    console.error(`[skill-eval-run] loaded env: ${loadedPaths.join(", ")}`);
  }
  ```
- Keep `export function loadEnvFiles(): string[]` and all helpers.

**Files to add explicit `loadEnvFiles()` call in `main()`:**
- `scripts/setup-workspace.ts`
- `scripts/run-agent.ts`
- `scripts/run-grader.ts`
- `scripts/grade-benchmark.ts`
- `scripts/aggregate-benchmark.ts`
- `scripts/orchestrate-benchmark.ts`
- `scripts/list-skills.ts`

Call pattern:
```ts
async function main() {
  loadEnvFiles(); // Add this at the top of main()
  const flags = await parseFlags();
  ...
}
```

---

## Step 2: Refactor `parseFlags()` and `help()` to avoid hidden `Deno.exit()`

**Files:** All 7 entrypoint scripts

**Changes per file:**
- Change `parseFlags()` return type to:
  ```ts
  | { success: true; flags: ParsedFlags }
  | { success: false; message: string; code: number }
  ```
- On validation errors, return `{ success: false, message: "Missing required flags: ...", code: 2 }` instead of calling `Deno.exit(2)`.
- In `main()`:
  ```ts
  const parsed = await parseFlags();
  if (!parsed.success) {
    console.error(parsed.message);
    Deno.exit(parsed.code);
  }
  const flags = parsed.flags;
  ```
- Keep `help()` calling `Deno.exit(0)` since it's invoked by explicit user request (`--help`).

---

## Step 3: Replace Unix `which` with cross-platform detection

**File:** `scripts/lib/harness/command.ts`

**Change `commandOnPath()`:**
```ts
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
```

---

## Step 4: Capture `stderr` in `runProcess()`

**File:** `scripts/lib/harness/command.ts`

**Changes:**
- Add `stderr: string` to `ProcessResult` interface.
- Change `stderr: "inherit"` to `stderr: "piped"`.
- Decode stderr and include in return object.

**File:** `scripts/lib/harness/tokens.ts`

**Change `buildAgentResult()`:**
```ts
error: proc.success ? undefined : `${label} exited with code ${proc.code}: ${proc.stderr.slice(0, 500)}`,
```

---

## Step 5: Add subprocess timeouts

**File:** `scripts/lib/harness/types.ts`

**Change:**
```ts
export interface AgentRunRequest {
  prompt: string;
  outputDir: string;
  model: string;
  cwd: string;
  skillPath?: string;
  headless: boolean;
  timeoutMs?: number; // ADD
}
```

**File:** `scripts/lib/harness/command.ts`

**Change `runProcess()`:**
```ts
export async function runProcess(options: {
  bin: string;
  args: string[];
  cwd: string;
  timeoutMs?: number;
}): Promise<ProcessResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  let timeoutId: number | undefined;

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  }

  const proc = new Deno.Command(options.bin, {
    args: options.args,
    cwd: options.cwd,
    stdout: "piped",
    stderr: "piped",
    signal: controller.signal,
  });

  let result: Deno.CommandOutput;
  try {
    result = await proc.output();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const elapsed = Date.now() - startTime;
      return {
        success: false,
        code: -1,
        stdout: "",
        stderr: `Timeout after ${options.timeoutMs}ms`,
        durationMs: elapsed,
      };
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  return {
    success: result.success,
    code: result.code,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
    durationMs: Date.now() - startTime,
  };
}
```

**File:** `scripts/lib/harness/run-cli.ts`

**Change:**
```ts
const proc = await runProcess({ bin: options.bin, args, cwd: req.cwd, timeoutMs: req.timeoutMs });
```

**Files needing `--timeout-ms` flag:**
- `scripts/run-agent.ts` → default `600000` (10 min)
- `scripts/orchestrate-benchmark.ts` → default `600000`, pass to `run-agent.ts`
- `scripts/grade-benchmark.ts` → default `600000`, pass to `run-grader.ts`
- `scripts/run-grader.ts` → default `600000`, pass to inner `run-agent.ts`

---

## Step 6: Fix `run-grader.ts` redundant parse and remove `sanitizeJson`

**File:** `scripts/run-grader.ts`

**Changes:**
1. Remove `sanitizeJson` import.
2. Replace `JSON.parse(sanitizeJson(raw))` with `JSON.parse(raw)`.
3. Remove the redundant `parse(GradingSchema, validation.output)` call.
4. Use `validation.output` directly for `Deno.writeTextFileSync()`.

---

## Step 7: Harden `opencode.ts`

**File:** `scripts/lib/harness/opencode.ts`

**Changes:**

### A. Add timeout support to `spawn()`
```ts
async function runWithTimeout(cmd: Deno.Command, timeoutMs?: number): Promise<{ status: Deno.CommandStatus; stdout: ReadableStream<Uint8Array> }> {
  const controller = new AbortController();
  let timeoutId: number | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }
  const child = cmd.spawn();
  try {
    const status = await child.status;
    return { status, stdout: child.stdout };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
```

### B. Tighten `fuzzyMatch()`
```ts
function fuzzyMatch(provided: string, available: string[]): string | null {
  const lower = provided.toLowerCase();
  // 1. Exact case-insensitive
  const exact = available.find((m) => m.toLowerCase() === lower);
  if (exact) return exact;
  // 2. Suffix exact match only
  for (const model of available) {
    const suffix = model.split("/").pop()?.toLowerCase();
    if (suffix === lower) return model;
  }
  return null;
}
```

### C. Tighten SQL validation
```ts
async function fetchOpencodeTokens(sessionId: string): Promise<{ input: number; output: number }> {
  if (!/^ses_[a-zA-Z0-9]+$/.test(sessionId)) throw new Error("Invalid session ID");
  if (sessionId.length > 64) throw new Error("Session ID too long");
  // ... rest unchanged
}
```

---

## Step 8: Handle missing phases in `aggregate-benchmark.ts`

**File:** `scripts/aggregate-benchmark.ts`

**Changes:**
- After collecting `baseline` and `withSkill` arrays:
  ```ts
  if (baseline.length === 0) {
    console.error("No baseline runs found in workspace — run orchestrate-benchmark.ts --skip-with-skill first");
    Deno.exit(1);
  }
  if (withSkill.length === 0) {
    console.error("No with-skill runs found in workspace — run orchestrate-benchmark.ts first");
    Deno.exit(1);
  }
  ```
- Remove `sanitizeJson` import and usage (replace with direct `JSON.parse`).

---

## Step 9: Minor polish

**File:** `scripts/lib/helpers.ts`

**Change `dateTimeStamp()` to UTC:**
```ts
export function dateTimeStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
}
```

**File:** `scripts/lib/harness/tokens.ts`

**Change `sumUsage()` to coerce strings/bigints:**
```ts
function sumUsage(usage: Record<string, unknown>): number | null {
  const rawInput = usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens;
  const rawOutput = usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens;
  const input = typeof rawInput === "number" ? rawInput : typeof rawInput === "string" || typeof rawInput === "bigint" ? Number(rawInput) : NaN;
  const output = typeof rawOutput === "number" ? rawOutput : typeof rawOutput === "string" || typeof rawOutput === "bigint" ? Number(rawOutput) : NaN;
  if (!Number.isNaN(input) && !Number.isNaN(output)) {
    return input + output;
  }
  return null;
}
```

**Files:** `scripts/list-skills.ts`, `scripts/setup-workspace.ts`

**Change:** Add explicit `Deno.exit(0)` at end of `main()`.

---

## Execution Order

1. `types.ts` (add `timeoutMs`)
2. `command.ts` (cross-platform + stderr + timeout)
3. `run-cli.ts` (pass timeout)
4. Harness files: `cursor.ts`, `claude-code.ts`, `codex.ts`, `custom.ts`, `opencode.ts`
5. `load-env.ts` (remove side effects)
6. Entrypoints (all 7): add `loadEnvFiles()`, refactor `parseFlags()`, add `--timeout-ms`
7. `run-grader.ts` (remove sanitizeJson, fix redundant parse)
8. `aggregate-benchmark.ts` (missing phase handling, remove sanitizeJson)
9. `helpers.ts` + `tokens.ts` (polish)

---

## Files Modified (all in `skills/skill-eval-run/scripts/`)

- `lib/load-env.ts`
- `lib/harness/types.ts`
- `lib/harness/command.ts`
- `lib/harness/run-cli.ts`
- `lib/harness/opencode.ts`
- `lib/harness/tokens.ts`
- `lib/helpers.ts`
- `setup-workspace.ts`
- `run-agent.ts`
- `run-grader.ts`
- `grade-benchmark.ts`
- `aggregate-benchmark.ts`
- `orchestrate-benchmark.ts`
- `list-skills.ts`
