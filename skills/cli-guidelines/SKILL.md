---
name: cli-guidelines
description: Build delightful, composable, human-first CLIs with the clig.dev guidelines. Use when writing, reviewing, or refactoring command-line interface tools, commands, subcommands, flags, help text, prompts, or stdout/stderr routing, or when the user mentions clig, CLI guidelines, or terminal UX. Do NOT use on commands that launch full-screen TUIs.
license: CC-BY-SA-4.0
---

# CLI Guidelines (derived from clig.dev)

## Glossary

Use these terms precisely as they are defined here. They are often conflated, do not use them interchangeably.

- **Arguments**, or **args** - positional parameters to a command. For example, the file paths provided to `cp` are args. The order of args is often important: `cp foo bar` means something different from `cp bar foo`.
- **Flags** - named parameters, denoted with either a hyphen and a single-letter name (`-r`) or a double hyphen and a multiple-letter name (`--recursive`). They may or may not also include a user-specified value (`--file foo.txt`, or `--file=foo.txt`). The order of flags, generally speaking, does not affect program semantics.

## Process

### When Reviewing

1. Explore the project's files and architecture
2. Compare the code to the philosophy and guidelines checklist defined in this document
3. If a binary exists and accepts `-n` or `--dry-run`, test the relevant branches for output
4. Identify, report, and strategize a way to fix any areas of divergence

### When Generating

1. Make sure the requirements are clear - explore the codebase for context and prompt the user with targeted questions for missing implementation details
2. If this is a new project, add a way to build/export to a binary
3. Create a scaffold using a mature arg-parsing library, returning `0` on success and non-zero on failure and outputs sent to `stdout` and logs, errors, and prompts to `stderr`
4. Implement related help commands
5. Validate the generated code conforms with the guidelines checklist
6. Verify any links to web documentation, github, discord, or other external resources exist and are accurate

### Always

- Assume the CLI will be piped, scripted, and run in CI. Gate interactivity, color, animations, and pagers behind TTY checks and provide machine-readable fallbacks
- Refer to the [full guide](references/clig.md) for detailed information or examples

## Philosophy

- **Human-first design** - expect and prepare for interaction, confusion, and abuse
- **Simple parts that work together** - design for composability, simple programs modular enough to be recombined as needed
- **Consistency across programs** - follow patterns that already exist unless they are harmful to productivity or user-satisfaction
- **Saying (just) enough** - keep the user informed at all times, but without overloading them with noise
- **Ease of discovery** - provide comprehensive help texts, examples, and suggestions for what command to run next
- **Conversation as the norm** - structure user input and command output as a continuous back-and-forth
- **Robustness** - reduce edge-cases by keeping programs simple. Prioritize responsiveness, even on failures
- **Empathy** - the path to a successful response should be obvious and easy
- **Chaos** - do not constrain or inhibit the power of the program just to adhere to a rule

## Guidelines Checklist

### Essential (The Basics)

- does not implement custom argument parsing. Uses the language's built-in library or a mature framework
- returns `0` on success
- returns non-zero on failure
- maps non-zero exit codes to important failure modes
- sends primary/machine output and to `stdout`
- sends logs/errors to `stderr`

### Recommendations

#### Help

- displays extensive help page when passed `-h` or `--help` flags
- displays concise help and examples on no args
- `-h` and `--help` flags work anywhere in the arg list, ignores other flags
- provides website/github/discord links for feedback/issues
- website links are specific to subcommands and arguments, not general/catch-all
- help page contains 1-3 example usages
- flag order in help text is ordered by expected usage, most frequently used flags go first
- help page is formatted with spacing and headers for human-readability, but minimizes emitted escape characters
- asks "Did you mean" with correct command when the user makes guessable syntax mistakes. MUST NOT automatically run suggested command
- does not hang on malformed input, quits immediately and displays help text or pipes to `stderr`

#### Documentation

- provides links to website/github/discord documentation when full/contextual details are desired
- provides an output to the `man` interface (can be the same response as the help page)

#### Output

- outputs lines of text that could be piped to another program
- if default output is not machine-readable, uses `--plain` flag to output plain tabular text format
- displays output as formatted JSON if `--json` is passed
- displays text output on success unless `-q` is passed
- explicitly prints a summary of changes made to any state or resources
- provides a clear, separate read command to inspect current state, rather than forcing the user to rely on creation/mutation logs
- suggests the next logical command or workflow step at the end of successful output
- prints explicit confirmations before performing actions on external or remote resources
- uses ascii art and spacing to format output to make information-dense human-readable output
- uses color to highlight important information, not decoration
- disables color if `stdout` is not a TTY, if `NO_COLOR` is set, if `TERM=dumb`, or if `--no-color` is passed
- disables animations if the terminal is non-interactive
- uses emojis and symbols sparingly, ensuring they improve structure, draw attention, or add information, not clutter
- suppresses extraneous chatter and informational logs unless in verbose mode
- only prints log level labels (`ERR`, `WARN`, etc.) to `stderr` in verbose mode
- pipes large bodies of text into a pager (like `less`)
- skips the pager if the terminal is non-interactive

#### Errors

- catches errors and rewrites them in plain English (avoids passing raw language panics, stack traces, or unhandled exceptions to the terminal by default)
- groups errors of the same type in a singular header
- puts important/actionable/copy-pasteable information at the end of the output
- if an error is unexpected or unexplainable, provides detailed traceback information and interface or website/github/discord link to submit bugs
- automatically populates bug reports with as much information as possible

#### Arguments and flags

- prefers flags to args unless the argument is obvious/unambiguous
- provides full-length long versions for all flags (prefixed with `--`)
- only uses single-letter short flags (prefixed with `-`) for the most commonly used flags
- does not use more than 2 args unless for variable-length lists with a single action (for example, `rm file1 file2 file3`)
- uses [common existing patterns](#common-flags) for flag names
- the most common operations do not require flags
- every value can be provided through args or flags, without prompting
- if an arg or flag is missing, prompt for user input
- requires explicit confirmation before moderately dangerous or destructive actions (user must type `y` or `yes` or provide the `-f` or `--force` flags)
- supports `-` as an argument representing `stdin`/`stdout` for reading/outputting files without a temporary file (for example, `curl https://example.com/something.tar.gz | tar xvf -`)
- if a value is truly optional but the flag has a set default value, accept a special value (such as `none`) that overrides fallback behavior and sets the value as empty
- args, flags, and subcommands can be passed in any order to the extent the argument parser allows (`mycmd --foo=1 subcmd` and `mycmd subcmd --foo=1` should both work the same)
- does not accept secrets or sensitive data directly as a plaintext value passed to a flag, uses `--password-file` flag or `stdin` instead

##### Common Flags

| short | full | meaning |
| --- | --- | --- |
| `-a` | `--all` | All |
| `-d` | `--debug` | Show debugging output. May also turn on verbose mode |
| `-f` | `--force` | Force |
| | `--json` | Display JSON output |
| `-h` | `--help` | Display help page |
| `-n` | `--dry-run` | Do not run the command, but describe the changes that would occur if it were run |
|  | `--no-input` | Disable all prompting and fail if a required flag is missing |
| `-o` | `--output` | Output file |
|  | `--password-file` | Path of file to read sensitive data from |
| `-p` | `--port` | Port |
| `-q` | `--quiet` | Display less output |
| `-u` | `--user` | User |
| | `--verbose` | Display more output |
| | `--version` | Version |
| `-v` | | Sometimes used for `--version`, sometimes for `--verbose` |

#### Interactivity

- only uses prompts or interactivity if `stdin` is a TTY
- if `--no-input` is passed, bypasses all prompting and fails if a required flag is missing
- masks or suppresses printing passwords and sensitive data
- can be exited with Ctrl-C or by another method communicated to the user

#### Subcommands

- uses consistent flag names and output structures across different subcommands
- uses consistent action names across subcommands, for example `foo bar create` and `foo baz create` both use `create`
- multi-level subcommands consistently follow a single chosen pattern (either noun-verb or verb-noun) across the entire program
- does not use subcommands that are similar in function or spelling to one another

#### Robustness

- validates all user input and exits on bad data
- responds in under 100ms
- prints a message before making network requests
- displays a progress bar or loading animation for long processes
- runs long processes in parallel with a mature library
- network requests have a defined timeout and do not hang indefinitely
- stateful operations "continue" instead of fully restarting on a retry after an early exit
- stateful operations check if cleanup functions need to be run when the program starts

#### Future-proofing

- new changes do not modify existing behavior
- if changes modify existing behavior, outputs in interactive sessions include a notice of the change
- subcommand names are explicitly required, not inferred (never implements catch-all fallback behavior if the first argument doesn't match a subcommand)
- subcommand names must match exactly (do not allow arbitrary abbreviations like `inst` for `install`)
- does not rely on external resources

#### Signals and control characters

- ctrl-c outputs a response immediately and exits as soon as possible
- clean-up operations use a timeout and do not hang
- ctrl-c can exit during clean-up operations to skip any remaining

#### Configuration

- follows the XDG-spec for config file location
- requires confirmation before modifying external configs
- adds a dated comment when modifying external configs
- applies configuration parameters in order of precedence: flags, the shell's env vars, project-level config (`.env`), user-level config, system wide config

#### Environment Variables

- env var names only contain uppercase letters, numbers, and underscores and must not start with a number
- env var values are not multi-line
- does not overwrite or modify any [POSIX standard env vars](references/posix-standard-env-vars.md)
- checks relevant [common env vars](#common-env-vars)
- checks for and reads from local `.env` file if it exists
- does not read secrets or sensitive data from environment variables (uses credential files, pipes, `AF_UNIX` sockets, secret management services, or another IPC mechanism)

##### Common env vars

| name | use |
| --- | --- |
| `NO_COLOR` | disables color |
| `FORCE_COLOR` | enables color |
| `DEBUG` | enables more verbose outpur |
| `EDITOR` | if you need to prompt the user to edit a file or input more than a single line |
| `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` & `NO_PROXY` | if you’re going to perform network operations |
| `SHELL` | if you need to open up an interactive session of the user's preferred shell |
| `TERM`, `TERMINFO` & `TERMCAP` | if you’re going to use terminal-specific escape sequences |
| `TMPDIR` | if you’re going to create temporary files |
| `HOME` | for locating configuration files |
| `PAGER` | if you want to automatically page output |
| `LINES` &  `COLUMNS` | for output that’s dependent on screen size (e.g. tables) |

#### Naming

- use only lowercase letters, and dashes
- program name, commands, and subcommands are each 3-12 characters
- long names use letters that are distributed across a QWERTY keyboard

#### Distribution

- compiles to a single binary
- is packaged for system or language package manager
- is uninstallable

#### Analytics

- requires consent (opt-in) before data collection
- discloses any data collection on first run
