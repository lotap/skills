---
name: skill-eval-run
description: Run evals for a skill and grade the outputs. Use when the user wants to test a skill, run benchmarks, evaluate skill performance, or compare with-skill vs baseline outputs.
---

# Skill Eval Run

## Available scripts

- **`scripts/run-agent.ts`** — Run one agent, write `timing.json`
- **`scripts/run-grader.ts`** — Grade outputs against assertions, write `grading.json`
- **`scripts/aggregate-benchmark.ts`** — Scan workspace, compute stats, write `benchmark.json`
- **`scripts/orchestrate-benchmark.ts`** — Orchestrator: iterate eval entries, call the above scripts in parallel, then aggregate

Requires [Deno](https://deno.com) and the `opencode` CLI.

## Process

### Setup

1. Search for `SKILL.md` files and ask the user which one they would like to test

2. Record the selected skill as `SKILL_NAME`

3. Ask the user which model to use. If you can identify your own model ID from context, suggest it as the default

4. Record the selected model as `CURRENT_MODEL` (full ID, e.g. `opencode/deepseek-v4-flash-free`)

5. Search for `${SKILL_NAME}/evals/evals.json`. If it doesn't exist, the orchestrator will exit with an error — tell the user to create an evals file and re-run

### Run

Run the orchestrator script. It reads `evals.json`, iterates entries in parallel, calls `run-agent.ts` for baseline and with-skill phases, calls `run-grader.ts` for grading, and finally calls `aggregate-benchmark.ts` to produce the summary:

The model slug (used in output filenames) is derived from the model ID by stripping non-alphanumeric characters — e.g. `opencode/deepseek-v4-flash-free` → `deepseek-v4-flash-free`. If the default isn't right, pass `--model-slug` explicitly.

```bash
deno run --allow-all scripts/orchestrate-benchmark.ts \
  --skill "${SKILL_NAME}" \
  --skill-dir "./${SKILL_NAME}" \
  --model "${CURRENT_MODEL}" \
  --workspace-dir "./${SKILL_NAME}-workspace" \
  --parallel 4
```

(The default concurrency is 2; increase to 4 for faster runs, reduce if API rate limits are an issue.)

### Report

When the script finishes, read the generated benchmark JSON and present the summary to the user. The output file is named `benchmark.${MODEL_SLUG}.${DATETIME}.json` in the workspace directory (the slug is the model ID with non-alphanumeric characters stripped; the datetime is `YYYY-MM-DD-HH-MM-SS` of the run).

## Further Reading

If the `evals.json` schema or structure is unclear, fetch the [spec](https://agentskills.io/skill-creation/evaluating-skills) for examples.
