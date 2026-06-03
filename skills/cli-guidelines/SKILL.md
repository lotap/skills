---
name: cli-guidelines
description: Build delightful, composable, human-first CLIs with the clig.dev guidelines. Use when writing, reviewing, or refactoring command-line interface tools, commands, subcommands, flags, help text, prompts, or stdout/stderr routing, or when the user mentions clig, CLI guidelines, or terminal UX. Do NOT use on commands that launch full-screen TUIs.
license: CC-BY-SA-4.0
---

# CLI Guidelines (derived from clig.dev)

## Process

### Always
- Explore the project's files and architecture for context
- Assume the CLI will be piped, scripted, and run in CI. Gate interactive prompts, color, animations, and pagers behind TTY checks
- Read the [full guide](references/clig.md) for rich context, or use the guide link on each checklist section below

### When Reviewing
1. Compare the code to the guidelines checklist below
2. If a binary exists and accepts `-n` or `--dry-run`, test the relevant branches for output
3. Identify and strategize fixes for any divergences
4. Verify any links to web docs/github/discord follow the [docs guide](references/docs-guide.md)

### When Generating
1. Make sure the requirements are clear; prompt the user with targeted questions for missing details
2. In new projects, add a way to build/export to a standalone binary
3. Scaffold with a mature arg-parsing library; exit `0` on success, non-zero on failure; output→`stdout`, logs/errors→`stderr`
4. Implement related help commands
5. Validate the generated code against the guidelines checklist

## Guidelines Checklist

### Essential (The Basics) ([guide](references/clig/basics.md))
- does not implement custom arg-parsing. Uses language's built-in lib or a mature framework
- exits `0` on success; non-zero on failure
- maps non-zero exit codes to important failure modes
- sends primary/machine output and to `stdout`
- sends logs/errors to `stderr`

### Recommendations

#### Help ([guide](references/clig/help.md))
- displays extensive help page when passed `-h`/`--help`
- displays concise help and examples on no args
- `-h`/`--help` work anywhere in the arg list, ignores other flags
- help page contains 1-3 example usages
- flag order on help page is ordered by expected usage frequency
- formats help page with spacing for readability with minimal amount of escape characters
- asks "Did you mean" on syntax mistakes. MUST NOT auto-run suggested command
- quits immediately on malformed input and displays help or pipes to `stderr`

#### Output ([guide](references/clig/output.md))
- outputs lines of text that are pipeable to another program
- uses `--plain` for plain tabular text if default isn't machine-readable
- displays JSON for `--json`
- passing `-q`/`--quiet` prevents output on success
- prints a summary of changes made
- provides a read command for current state (no defacto reliance on creation/mutation logs)
- suggests the next logical command or workflow at end of a success output
- confirms before acting on external/remote resources
- uses ascii art/spacing for info-dense human-readable output
- uses color for emphasis, not decoration
- disables color if: not a TTY, `NO_COLOR` set, `TERM=dumb`, or `--no-color`
- disables animations if non-interactive
- uses emojis/symbols sparingly; they should improve structure, draw attention, or add info, not clutter
- suppresses chatter and info logs unless verbose requested
- only prints log level labels (`ERR`, `WARN`, etc.) to `stderr` in verbose mode
- pipes large bodies of text into a pager (like `less`)
- skips pager if non-interactive

#### Errors ([guide](references/clig/errors.md))
- catches errors and rewrites them in plain English (no raw panics, stack traces, or unhandled exceptions)
- groups same-type errors under a singular header
- puts important/actionable/copy-pasteable information at the end of output
- unexpected errors provide detailed traceback information

#### Arguments and flags ([guide](references/clig/arguments-and-flags.md))
- prefers flags to args unless arg is obvious/unambiguous
- provides full-length names for all flags (prefixed with `--`)
- only uses single-letter short names (prefixed with `-`) for most frequently used flags
- uses less than 3 args except for variable-length lists with a single action (ex: `rm file1 file2 file3`)
- follows established flag naming conventions: `-h`/`--help`, `-n`/`--dry-run`, `-f`/`--force`, `-v`/`--verbose` or `--version`, `--json`, `--no-color`, `--no-input`, `-q`/`--quiet`, `-d`/`--debug`, `-o`/`--output`, `-p`/`--port`, `-u`/`--user`, `--all`, `--password-file`; [flag definitions](references/flag-definitions.md)
- the most frequent operations need no flags
- all values providable via args or flags without prompting
- prompts for any missing arg/flag
- requires confirmation with `y`/`yes` prompt or `-f`/`--force` flag for mildly dangerous actions
- accepts `-n`/`--dry-run` for deletion/modification actions that can’t be easily undone
- requires explicit confirmation (like `--confirm=name-of-thing`) for severely dangerous/complex actions 
- supports `-` as a `stdin`/`stdout` arg for file I/O (ex: `curl ... | tar xvf -`)
- interprets a special value (like `none`) as an empty string that overrides default values
- args, flags, and subcommands are allowed in any order (parser permitting)
- uses `--password-file` or `stdin` for secrets, not plaintext flag values

#### Interactivity ([guide](references/clig/interactivity.md))
- only uses prompts/interactivity if `stdin` is TTY
- `--no-input` bypasses all prompting; fails if a required flag is missing
- masks/suppresses passwords and sensitive data
- exits with Ctrl-C or as communicated

#### Subcommands ([guide](references/clig/subcommands.md))
- uses consistent flag names/output format across subcommands
- uses consistent action names across subcommands (ex: `foo bar create` & `foo baz create` both use `create`)
- multi-level subcommands follow either a noun-verb or verb-noun pattern across the entire program
- does not use subcommands similar in function or spelling to one another

#### Robustness ([guide](references/clig/robustness.md))
- validates all input; exits on bad data
- responds in under 100ms
- prints a message before network requests
- displays a progress bar or loading animation on long processes
- parallelizes long processes with a mature library
- network requests use timeouts; no indefinite hanging
- stateful ops "continue" (do not require a full restart) on retries after an early exit
- stateful ops can run cleanup functions when the program starts

#### Future-proofing ([guide](references/clig/future-proofing.md))
- does not modify existing behavior
- if behavior changes, outputs notice of change in interactive sessions
- explicitly requires subcommand names (never implements catch-all fallback behavior)
- subcommand names must match exactly (no arbitrary abbreviations like `inst` for `install`)
- minimizes reliance on external resources

#### Signals and control characters ([guide](references/clig/signals.md))
- ctrl-c responds immediately and exits asap
- cleanup ops use a timeout and do not hang
- ctrl-c during cleanup ops exits and skips any remaining

#### Configuration ([guide](references/clig/configuration.md))
- follows XDG-spec for config file location
- confirms before modifying external configs
- adds a dated comment when modifying external configs
- applies config params in precedence order: flags → env vars → project config (`.env`) → user config → system config

#### Environment Variables ([guide](references/clig/environment-variables.md))
- env var names only contain uppercase letters, numbers, and underscores and must not start with a number
- env var values are single-line
- does not overwrite/modify any [POSIX standard env vars](references/posix-standard-env-vars.md)
- checks relevant [common env vars](references/common-env-vars.md)
- checks/reads local `.env` file if it exists
- does not read secrets from env vars; uses files, pipes, `AF_UNIX` sockets, secret managers, or other IPC mechanisms)

#### Naming ([guide](references/clig/naming.md))
- uses only lowercase letters & dashes
- program name, commands, and subcommands are each at least 3 characters but only as long as necessary
- long names use letters that are distributed across a QWERTY keyboard

#### Distribution ([guide](references/clig/distribution.md))
- compiles to a single binary
- is packaged for system/language package manager
- is uninstallable

#### Analytics ([guide](references/clig/analytics.md))
- requires consent (opt-in) before data collection
- discloses any data collection on first run
