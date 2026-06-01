---
name: skill-eval-run
description: Run evals for a skill and grade the outputs. Use when the user wants to test a skill, run benchmarks, evaluate skill performance, or compare with-skill vs baseline outputs.
---

# Skill Eval Run

## Available scripts

- **`scripts/list-skills.ts`** — Discover available skills
- **`scripts/setup-workspace.ts`** — Validate skill, resolve harness and model, create workspace
- **`scripts/run-agent.ts`** — Run one agent via a harness, write `timing.json`
- **`scripts/run-grader.ts`** — Grade outputs against assertions, write `grading.json`
- **`scripts/grade-benchmark.ts`** — Iterate entries and call `run-grader.ts` in parallel
- **`scripts/aggregate-benchmark.ts`** — Scan workspace, compute stats, write `benchmark.json`
- **`scripts/orchestrate-benchmark.ts`** — Iterate eval entries, call the above scripts in parallel, then aggregate

All scripts run with `deno run --allow-all` from the skill directory root.

Scripts that run an agent subprocess require `--harness` or `SKILL_EVAL_HARNESS`. This is **required** — the tool never auto-selects.

Built-in IDs to suggest: `opencode`, `cursor`, `claude-code`, `codex`. Any binary on PATH also works (e.g. `--harness foo`), but there are not built-in adapters.

## Process

### Setup

1. Run `list-skills.ts --dir ./skills` to discover available skills. Output is JSON array of `{name, dir, hasEvals}`.

2. Present the list to the user and ask which to test. If `hasEvals` is false, tell the user the skill is missing `evals/evals.json` and stop. Otherwise record `SKILL_NAME` and `SKILL_DIR`.

3. Ask which harness to use — suggest built-in IDs (`opencode`, `cursor`, `claude-code`, `codex`) or custom binary name. Record as `CURRENT_HARNESS`. Warn the user that headless mode skips permission prompts (`opencode --dangerously-skip-permissions`, `claude --dangerously-skip-permissions`, `codex --full-auto`, etc.) — only evaluate skills you trust.

4. Run `setup-workspace.ts` to validate, resolve model, and create workspace:

```bash
deno run --allow-all scripts/setup-workspace.ts \
  --skill-dir "${SKILL_DIR}" \
  --harness "${CURRENT_HARNESS}"
```

The script prints JSON to stdout with `skill`, `skillDir`, `harness`, `model`, and `workspaceDir`. Pass `--model` or `--workspace-dir` to override.

5. Record `CURRENT_MODEL`, `WORKSPACE_DIR`, `CURRENT_HARNESS` from the JSON output. Use these values for subsequent steps — the script may have resolved or normalized the harness ID (e.g. validated a built-in name or accepted a custom binary).

6. Read `${SKILL_DIR}/evals/evals.json` and show the user the available entries (their IDs and truncated prompts). Ask which to run. Record the answer as `ENTRY_IDS` — comma-separated IDs. If the user says 'all', map `ENTRY_IDS` to the full comma-separated list of discovered IDs.

By the end of setup you should have: `SKILL_NAME`, `SKILL_DIR`, `CURRENT_HARNESS`, `CURRENT_MODEL`, `WORKSPACE_DIR`, `ENTRY_IDS`.

### Run

Iterates eval entries in parallel, running baseline and with-skill phases. Baseline is skipped automatically if it has already run.

```bash
deno run --allow-all scripts/orchestrate-benchmark.ts \
  --skill "${SKILL_NAME}" \
  --skill-dir "${SKILL_DIR}" \
  --harness "${CURRENT_HARNESS}" \
  --model "${CURRENT_MODEL}" \
  --workspace-dir "${WORKSPACE_DIR}" \
  --parallel 4 \
  --entries "${ENTRY_IDS}"
```

Use `--skip-baseline` or `--skip-with-skill` to re-run only one phase.

### Review

Grades completed runs against their `evals.json` assertions. Each entry's baseline and with-skill outputs are graded independently, producing `grading.json` alongside the agent outputs.

Re-running Review **overwrites** existing `grading.json` files for the selected entries — safe to redo without re-running agents. Use `--skip-baseline` or `--skip-with-skill` to grade only one phase.

By default grading uses the same harness as the eval runs. Pass `--grader-harness` to use a different tool (e.g. eval with `cursor`, grade with `opencode`). This lets you change the grader model mid-benchmark without re-running agents.

```bash
deno run --allow-all scripts/grade-benchmark.ts \
  --skill-dir "${SKILL_DIR}" \
  --workspace-dir "${WORKSPACE_DIR}" \
  --harness "${CURRENT_HARNESS}" \
  --model "${CURRENT_MODEL}" \
  --parallel 4 \
  --entries "${ENTRY_IDS}"
```

### Report

#### Aggregate

Writes `benchmark.json` with per-phase pass rates (mean, stddev), timing, token counts, and deltas.

```bash
deno run --allow-all scripts/aggregate-benchmark.ts \
  --workspace-dir "${WORKSPACE_DIR}" \
  --benchmark-file "${WORKSPACE_DIR}/benchmark.json" \
  --entries "${ENTRY_IDS}"
```

#### Interpret

Read `benchmark.json` and present the summary to the user.

Inspect the `grading.json` files (found in `${entryId}/${harness}-${modelSlug}/${phase}/grading.json`) for information about which assertions failed and why. 

Highlight regressions where:
- baseline passes and with-skill fails
- pass rate decreases
- latency or token cost increases substantially without improving pass rate

Suggest the smallest changes to the evaluated skill that would likely address the identified regressions. Read the target skill's `SKILL.md` first, and only make specific, localized suggestions when directly supported by failing assertions or benchmark results.

## Further Reading

If the `evals.json` schema or structure is unclear, fetch the [spec](https://agentskills.io/skill-creation/evaluating-skills) for examples.
