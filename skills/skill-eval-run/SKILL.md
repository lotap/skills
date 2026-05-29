---
name: skill-eval-run
description: Run evals for a skill and grade the outputs. Use when the user wants to test a skill, run benchmarks, evaluate skill performance, or compare with-skill vs baseline outputs.
---

# Skill Eval Run

## Structures

Inject these templates into the subagents for the files they will create:

`timing.json`

```json
{
  "total_tokens": number,
  "duration_ms": number
}
```

`grading.json`

```json
{
  "assertion_results": [
    {
      "text": string,
      "passed": boolean,
      "evidence": string
    }
  ],
  "summary": {
    "passed": number,
    "failed": number,
    "total": number,
    "pass_rate": number
  }
}
```

`benchmark.json`

```json
{
  "run_summary": {
    "baseline": {
      "pass_rate": { "mean": number, "stddev": number },
      "time_seconds": { "mean": number, "stddev": number },
      "tokens": { "mean": number, "stddev": number }
    },
    "with_skill": {
      "pass_rate": { "mean": number, "stddev": number },
      "time_seconds": { "mean": number, "stddev": number },
      "tokens": { "mean": number, "stddev": number }
    },
    "delta": {
      "pass_rate": number,
      "time_seconds": number,
      "tokens": number
    }
  }
}
```

## Process

### Setup

1. Search for `SKILL.md` files and ask the user which one they would like to test

2. Record the selected skill as `SKILL_NAME`

3. Ask the user what model they would like to associate with the test. Suggest the currently running model if it can be detected

4. Record the selected model in kebab-case as `CURRENT_MODEL`

5. Search for `${SKILL_NAME}/evals/evals.json`. If the evals file doesn't exist, tell the user to create an evals file. Then stop processing

6. Look for a directory named `${SKILL_NAME}-workspace` that is a sibling to the `${SKILL_NAME}` directory. Create it if it doesn't exist

7. Record the current date and time in the format: `YYYY-MM-DD-HH-MM-SS` as `CURRENT_DATE_TIME`

8. For each entry in the `evals` of the evals file:
  - use the entry's id to derive a slug in the format: `${SKILL_NAME}-workspace/${EVAL_ENTRY_ID}/${CURRENT_MODEL}/` and record it as RUN_PATH
  - create `baseline/outputs/` and `with-skill/${CURRENT_DATE_TIME}/outputs/` subdirectories inside each RUN_PATH

### Run

For each entry in the `evals` of the evals file, execute the following. Run all entries in parallel using subagents if available; otherwise run them sequentially

#### Baseline

Check if the `baseline/outputs` directory in the RUN_PATH contains files. If it does, skip the rest of this step.

Spawn the following subagent:

<subagent>
Execute the following task without consulting any skill. Use only your default behavior.

Task: ${EVAL_ENTRY_PROMPT}

Save output files to: ${RUN_PATH}/baseline/outputs/

When you finish the task, record the tokens used and the duration of the task in a `${RUN_PATH}/baseline/timing.json` file  
</subagent>

#### With-skill

Spawn the following subagent:

<subagent>
Read the `${SKILL_NAME}/SKILL.md` skill and use it to complete the following task.

Task: ${EVAL_ENTRY_PROMPT}

Use your file system tools to write the output to: ${RUN_PATH}/with-skill/${CURRENT_DATE_TIME}/outputs/

When you finish the task, record the tokens used and the duration of the task in a `${RUN_PATH}/with-skill/${CURRENT_DATE_TIME}/timing.json` file  
</subagent>

### Review

Record GRADING_PATH as:
  - for baseline runs: `${RUN_PATH}/baseline/`
  - for with-skill runs: `${RUN_PATH}/with-skill/${CURRENT_DATE_TIME}/`

Spawn a subagent with these instructions:

<subagent>
You are a grader. Evaluate whether the outputs satisfy the following assertions.

Assertions:
${EVAL_ENTRY_ASSERTIONS}

outputs: ${RUN_PATH}/${RUN_TYPE}/outputs/

write a `grading.json` file in ${GRADING_PATH}

PASS only when you find clear, specific evidence. Fail when evidence is absent, superficial, or contradicts the assertion.
</subagent>

### Report

When all runs and reviews are complete, summarize the results in `${SKILL_NAME}-workspace/benchmark.${CURRENT_MODEL}.${CURRENT_DATE_TIME}.json` and print them to the user

## Further Reading

When in doubt, fetch and read the [spec](https://agentskills.io/skill-creation/evaluating-skills)
