# skill-eval-run

Run the prompts defined in your skills `evals.json` and compare outputs between `baseline` and `with-skill`.

Supports multiple agent harnesses: **OpenCode**, **Cursor Agent CLI**, **Claude Code**, and **Codex**.

Scripts use Deno with inline `jsr:` imports ([agentskills Deno guide](https://agentskills.io/skill-creation/using-scripts#deno)) — no `deno.json` required.

## Installation

```sh
npx skills add lotap/skills --skill skill-eval-run
```

Or copy-paste `SKILL.md` wherever you need it

## Usage

### Run in Cursor (copy-paste)

If the skill is not installed via `npx skills`, paste this into the chat (adjust the path if your repo layout differs):

```
Read ./skills/skill-eval-run/SKILL.md and do what it instructs
```

### CLI

From the skill directory root:

```sh
deno run --allow-all scripts/setup-workspace.ts --skill-dir ./skills/cli-guidelines
```

### Harness selection

Harness is auto-detected when possible (CLIs on PATH). Override with `SKILL_EVAL_HARNESS` or `--harness`.

```sh
deno run --allow-all scripts/setup-workspace.ts --skill-dir ./skills/cli-guidelines
```

### Cursor Agent CLI

Install and log in (one-time):

```sh
curl https://cursor.com/install -fsS | bash
agent login
```

Optional `.env`:

```sh
CURSOR_MODEL=auto
SKILL_EVAL_HARNESS=cursor
```

Scripts walk up from the cwd to find `.env`. Override with `--env-file` or `SKILL_EVAL_ENV_FILE`.

See `SKILL.md` for the full workflow, harness table, and `timing.json` (`tokens_source`) semantics.
