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

5. Read `evals.json` to see the available eval entries and ask which to run:

```bash
deno eval "
const e = JSON.parse(Deno.readTextFileSync('${SKILL_DIR}/evals/evals.json'));
e.evals.forEach(x => console.log(x.id, '—', (x.prompt||'').slice(0, 80)));
"
```

Present the list to the user and ask for comma-separated entry IDs (or "all"). Record the answer as `ENTRY_IDS`.

By the end of setup you should have: `SKILL_NAME`, `SKILL_DIR`, `CURRENT_MODEL`, `WORKSPACE_DIR`, `ENTRY_IDS`.

### Run

Run the agent orchestrator. It reads `evals.json` and iterates entries in parallel, calling `run-agent.ts` for baseline and with-skill phases. If `ENTRY_IDS` is "all", omit `--entries` to run every eval. The default concurrency is 2 (increase with `--parallel`; reduce if API rate limits are an issue). Use `--skip-baseline` or `--skip-with-skill` to re-run only one phase.

```bash
deno run --allow-all scripts/orchestrate-benchmark.ts \
  --skill "${SKILL_NAME}" \
  --skill-dir "${SKILL_DIR}" \
  --model "${CURRENT_MODEL}" \
  --workspace-dir "${WORKSPACE_DIR}" \
  --entries "${ENTRY_IDS}" \
  --parallel 4
```

### Review

Grade all completed agent runs in the workspace. Reads `evals.json` for assertions and calls `run-grader.ts` for each entry's baseline and with-skill outputs. Each entry's grading is written to its `grading.json` alongside the agent outputs. Use `--skip-baseline` or `--skip-with-skill` to grade only one phase. Re-run to re-grade without re-running agents.

```bash
deno run --allow-all scripts/grade-benchmark.ts \
  --skill-dir "${SKILL_DIR}" \
  --workspace-dir "${WORKSPACE_DIR}" \
  --model "${CURRENT_MODEL}" \
  --entries "${ENTRY_IDS}" \
  --parallel 4
```

### Report

Aggregate all grading results into a summary benchmark JSON. The output contains per-phase pass rates (mean and stddev), timing stats, and token counts — plus deltas between baseline and with-skill. Read the generated file and present the summary to the user: which entries passed/failed, the pass rates, timing changes, and where to find the full data.

```bash
deno run --allow-all scripts/aggregate-benchmark.ts \
  --workspace-dir "${WORKSPACE_DIR}" \
  --benchmark-file "${WORKSPACE_DIR}/benchmark.json" \
  --entries "${ENTRY_IDS}"
```

## Further Reading

If the `evals.json` schema or structure is unclear, fetch the [spec](https://agentskills.io/skill-creation/evaluating-skills) for examples.
