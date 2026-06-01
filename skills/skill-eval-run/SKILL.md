---
name: skill-eval-run
description: Run evals for a skill and grade the outputs. Use when the user wants to test a skill, run benchmarks, evaluate skill performance, or compare with-skill vs baseline outputs.
---

# Skill Eval Run

## Available scripts

- **`scripts/list-skills.ts`** — Discover available skills (search for `SKILL.md` files)
- **`scripts/setup-workspace.ts`** — Validate skill, resolve model, create workspace, print JSON config
- **`scripts/run-agent.ts`** — Run one agent, write `timing.json`
- **`scripts/run-grader.ts`** — Grade outputs against assertions, write `grading.json`
- **`scripts/aggregate-benchmark.ts`** — Scan workspace, compute stats, write `benchmark.json`
- **`scripts/orchestrate-benchmark.ts`** — Orchestrator: iterate eval entries, call the above scripts in parallel, then aggregate

Requires [Deno](https://deno.com) and the `opencode` CLI.

**Security note:** `run-agent.ts` passes `--dangerously-skip-permissions` to `opencode run` so agents don't stall waiting for approval in headless evals. Avoid using these scripts to evaluate untrusted third-party skills, as they bypass permission prompts.

## Process

### Setup

1. Run `list-skills.ts` to discover available skills:

```bash
deno run --allow-all scripts/list-skills.ts --dir ./skills
```

The output is a JSON array with each skill's `name`, `dir`, and whether it has evals (`hasEvals`).

2. Present the list to the user and ask which one to test. If the chosen skill has `hasEvals: false`, tell the user that `evals/evals.json` is missing and stop. Otherwise, record the answers as `SKILL_NAME` and `SKILL_DIR`.

3. Run `setup-workspace.ts` to validate the skill, resolve the model, and create the workspace:

```bash
deno run --allow-all scripts/setup-workspace.ts \
  --skill-dir "${SKILL_DIR}"
```

The script prints a JSON config to stdout with `skill`, `skillDir`, `model`, and `workspaceDir`. It also writes a human-readable summary to stderr.

The model is auto-detected from (in order): `--model` flag → `OPENCODE_MODEL` env var → `opencode config get model`. Pass `--model` to override. Pass `--workspace-dir` to override (defaults to `${SKILL_DIR}-workspace`).

If the resolved model is unexpected or detection fails, ask the user to confirm or provide one via `--model`.

4. Record the resolved values from the JSON output as `CURRENT_MODEL` and `WORKSPACE_DIR`.

By the end of setup you should have: `SKILL_NAME`, `SKILL_DIR`, `CURRENT_MODEL`, `WORKSPACE_DIR`.

### Run

Run the orchestrator script. It reads `evals.json`, iterates entries in parallel, calls `run-agent.ts` for baseline and with-skill phases, calls `run-grader.ts` for grading, and finally calls `aggregate-benchmark.ts` to produce the summary:

```bash
deno run --allow-all scripts/orchestrate-benchmark.ts \
  --skill "${SKILL_NAME}" \
  --skill-dir "${SKILL_DIR}" \
  --model "${CURRENT_MODEL}" \
  --workspace-dir "${WORKSPACE_DIR}" \
  --parallel 4
```

(The default concurrency is 2; increase to 4 for faster runs, reduce if API rate limits are an issue.)

The script logs structured progress to stderr so the agent can track each entry through baseline, with-skill, and grading phases. The final lines show how many entries passed and the benchmark output file path.

### Report

When the orchestrator finishes, read the generated benchmark JSON and present the summary to the user. The orchestrator's stderr includes per-entry pass rates and a final pass/fail summary. The last line prints the output file path (e.g. `Benchmark written to: .../benchmark.{slug}.{datetime}.json`). Surface the results to the user — which entries passed/failed, the pass rates, and where to find the full data.

## Further Reading

If the `evals.json` schema or structure is unclear, fetch the [spec](https://agentskills.io/skill-creation/evaluating-skills) for examples.
