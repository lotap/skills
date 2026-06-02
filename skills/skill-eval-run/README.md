# skill-eval-run

Run the prompts defined in your skills `evals.json` and compare outputs between `baseline` and `with-skill`.

Harness agnostic (OpenCode, Cursor, Claude Code, Codex, etc) **ONLY TESTED IN OPENCODE. YMMV. USE AT YOUR OWN RISK**

## Installation

### Prerequisites

#### Deno

[Deno](https://docs.deno.com/runtime/getting_started/installation/) is required and must be available to your agent

Scripts use Deno with inline `jsr:` imports ([agentskills Deno guide](https://agentskills.io/skill-creation/using-scripts#deno)) — no `deno.json` required.

#### Evals

Target skill needs [evals/evals.json](https://agentskills.io/skill-creation/evaluating-skills)

### Quick setup

```sh
npx skills add lotap/skills --skill skill-eval-run
```

### With Git

Download just this skill directory (not the whole repo):

```sh
git clone --filter=blob:none --sparse https://github.com/lotap/skills.git
cd skills
git sparse-checkout set skills/skill-eval-run
```

Point your harness at `skills/skill-eval-run/SKILL.md`.

To pull updates:

```sh
git pull
```

## Usage

### Prompting

Most harnesses will have some method of loading skills automatically if they are saved in the correct location. Look at your harness's docs to determine where that is.

Use a prompt like:

```
run the evals defined in my <skill-name> skill
```

or more explicitly

```
Read ./skills/skill-eval-run/SKILL.md and do what it instructs
```

### Env Vars

`.env` files are loaded automatically (walking up from cwd). Override with `--env-file <path>` or `SKILL_EVAL_ENV_FILE`.

None of these variables are required beforehand — the skill will prompt for values as needed.

| Var | Purpose |
|---|---|
| `SKILL_EVAL_HARNESS` | Agent harness ID |
| `SKILL_EVAL_MODEL` | Fallback model for any harness |
| `SKILL_EVAL_ENV_FILE` | Override .env path |
| `OPENCODE_MODEL` | opencode model |
| `CURSOR_MODEL` | cursor model |
| `CURSOR_AGENT_CMD` | cursor binary |
| `CLAUDE_CODE_CMD` | claude-code binary |
| `ANTHROPIC_MODEL` | claude-code model |
| `CLAUDE_MODEL` | claude-code model (fallback) |
| `CODEX_CMD` | codex binary |
| `CODEX_MODEL` | codex model |
| `OPENAI_MODEL` | codex model (fallback) |

### Workflow

The skill operates in 4 segments. The Setup is interactive, but the rest should run autonomously.

1. Setup — pick a target skill and harness, resolve the model, create a workspace directory.

2. Run — iterate each eval entry, running the agent prompt twice: baseline (no skill) and with-skill. Runs in parallel across entries. Already-completed baselines are skipped.

3. Review — grade each entry's outputs against its assertions using a grading agent. Produces per-entry grading.json. Supports a different grader harness than the eval harness.

4. Report — aggregate all grading/timing data into benchmark.json with pass-rate means, stddevs, and deltas between baseline and with-skill.

## See also

`SKILL.md` — full workflow, harness table, all flags, schema reference.

[Agent Skills Spec](https://agentskills.io/specification)
