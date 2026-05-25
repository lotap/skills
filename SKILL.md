---
name: clig
description: Build delightful, composable, human-first CLIs with the clig.dev guidelines. Use when writing, reviewing, or refactoring command-line interface tools, commands, subcommands, flags, help text, prompts, or stdout/stderr routing, or when the user mentions clig, CLI guidelines, or terminal UX. Do NOT use on commands that launch full-screen TUIs.
license: CC-BY-SA-4.0
---

# CLI Guidelines (derived from clig.dev)

## Process

### When Reviewing

1. Explore the project's files and architecture
2. Compare the code to the philosophy and guidelines defined in this document
3. If a binary exists and accepts `-n` or `--dry-run`, test the relevant branches for output
4. Identify, report, and strategize a way to fix any areas of divergence

### When Generating

1. Make sure the requirements are clear - explore the codebase for context and grill the user for missing implementation details
2. Create a scaffold using a mature arg-parsing library, returning `0` on success and non-zero on failure and outputs sent to `stdout` and logs, errors, and prompts to `stderr`
3. Verify any links to web documentation, github, discord, or other external resources are accurate

### Always

- Assume the CLI will be piped, scripted, and run in CI. Gate interactivity, color, animations, and pagers behind TTY checks and provide machine-readable fallbacks
- Refer to the [full guide](references/clig.md) for detailed information or examples

## Philosophy

- **Human-first design** - expect and prepare for interaction, confusion, and abuse
- **Simple parts that work together** - design for composability, simple programs modular enough to be recombined as needed
- **Consistency across programs** - follow patterns that already exist unless they are harmful to productivity or satisfaction
- **Saying (just) enough** - keep the user informed at all times, but without overloading them with noise
- **Ease of discovery** - provide comprehensive help texts, examples, and suggestions for what command to run next
- **Conversation as the norm** - structure user input and command output are a continuous back-and-forth
- **Robustness** - reduce edge-cases by keeping programs simple. Prioritize responsiveness, even on failures
- **Empathy** - the path to a successful response should be obvious and easy
- **Chaos** - do not constrain or inhibit the power of the program just to adhere to a rule

## Guidelines

### The Basics (ESSENTIAL)

- **Use an arg-parsing library** - Avoid rolling custom flag parsing. Use the language's built-in, or a mature framework
- **Return accurate error codes** - Use `0` on success, non-zero on failure. Map codes to important failure modes
- **Route I/O** - Send primary/machine output to `stdout`. Send logs/errors/prompts to `stderr`. Support `-` for stdin/stdout file args

### Help

**Display extensive help text when asked.** - when passed `-h` or `--help` flags, also applies to subcommands
**Display concise help text by default.** - when there are no arguments or flags, output brief description and examples
**Show full help when `-h` and `--help` are passed.** - also ignore any other flags when help args/flags are present
**Provide a support path for feedback and issues.** - website/github/discord links
**In help text, link to the web version of the documentation.** - use specific links to subcommands/arguments when possible
**Lead with examples.** - show example usage first on help page
**If you’ve got loads of examples, put them somewhere else,** - such as non-help subcommand or web docs
**Display the most common flags and commands at the start of the help text.** - after examples
**Use formatting in your help text.** - use bold headers if they can written portably
**If the user did something wrong and you can guess what they meant, suggest it.** - ask "did you mean" but don't run automatically
**If your command is expecting to have something piped to it and `stdin` is an interactive terminal, display help immediately and quit.** - do not hang

### Documentation

**Consider providing man pages.** - provide an output to the `man` interface, can be the same response as the help text

### Output

**Human-readable output is paramount.**
**Have machine-readable output where it does not impact usability.**
**If human-readable output breaks machine-readable output, use `--plain` to display output in plain, tabular text format for integration with tools like `grep` or `awk`.**
**Display output as formatted JSON if `--json` is passed.**
**Display output on success, but keep it brief.**
**If you change state, tell the user.**
**Make it easy to see the current state of the system.**
**Suggest commands the user should run.**
**Actions crossing the boundary of the program’s internal world should usually be explicit.**
**Increase information density—with ASCII art!**
**Use color with intention.**
**Disable color if your program is not in a terminal or the user requested it.**
**If `stdout` is not an interactive terminal, don’t display any animations.**
**Use symbols and emoji where it makes things clearer.**
**By default, don’t output information that’s only understandable by the creators of the software.**
**Don’t treat `stderr` like a log file, at least not by default.**
**Use a pager (e.g. `less`) if you are outputting a lot of text.**

### Errors

**Catch errors and rewrite them for humans.**
**Signal-to-noise ratio is crucial.**
**Consider where the user will look first.**
**If there is an unexpected or unexplainable error, provide debug and traceback information, and instructions on how to submit a bug.**
**Make it effortless to submit bug reports.**

### Arguments and flags

**Prefer flags to args.**
**Have full-length versions of all flags.**
**Only use one-letter flags for commonly used flags,**
**Multiple arguments are fine for simple actions against multiple files.**
**If you’ve got two or more arguments for different things, you’re probably doing something wrong.**
**Use standard names for flags, if there is a standard.**
**Make the default the right thing for most users.**
**Prompt for user input.**
**Never _require_ a prompt.**
**Confirm before doing anything dangerous.**
**If input or output is a file, support `-` to read from `stdin` or write to `stdout`.**
**If a flag can accept an optional value, allow a special word like “none”.**
**If possible, make arguments, flags and subcommands order-independent.**
**Do not read secrets directly from flags.**

### Interactivity

**Only use prompts or interactive elements if `stdin` is an interactive terminal (a TTY).**
**If `--no-input` is passed, don’t prompt or do anything interactive.**
**If you’re prompting for a password, don’t print it as the user types.**
**Let the user escape.**

### Subcommands

**Be consistent across subcommands.**
**Use consistent names for multiple levels of subcommand.**
**Don’t have ambiguous or similarly-named commands.**

### Robustness

**Validate user input.**
**Responsive is more important than fast.**
**Show progress if something takes a long time.**
**Do stuff in parallel where you can, but be thoughtful about it.**
**Make things time out.**
**Make it recoverable.**
**Make it crash-only.**
**People are going to misuse your program.**

### Future-proofing

**Keep changes additive where you can.**
**Warn before you make a non-additive change.**
**Changing output for humans is usually OK.**
**Don’t have a catch-all subcommand.**
**Don’t allow arbitrary abbreviations of subcommands.**
**Don’t create a “time bomb.”**

### Signals and control characters

**If a user hits Ctrl-C (the INT signal), exit as soon as possible.**
**If a user hits Ctrl-C during clean-up operations that might take a long time, skip them.**

### Configuration

**Follow the XDG-spec.**
**If you automatically modify configuration that is not your program’s, ask the user for consent and tell them exactly what you’re doing.**
**Apply configuration parameters in order of precedence.**

### Environment variables

**Environment variables are for behavior that _varies with the context_ in which a command is run.**
**For maximum portability, environment variable names must only contain uppercase letters, numbers, and underscores (and mustn't start with a number).**
**Aim for single-line environment variable values.**
**Avoid commandeering widely used names.**
**Check general-purpose environment variables for configuration values when possible:**
**Read environment variables from `.env` where appropriate.**
**Don’t use `.env` as a substitute for a proper configuration file**
**Do not read secrets from environment variables.**

### Naming

**Make it a simple, memorable word.**
**Use only lowercase letters, and dashes if you really need to.**
**Keep it short.**
**Make it easy to type.**

### Distribution

**If possible, distribute as a single binary.**
**Make it easy to uninstall.**

### Analytics

**Do not phone home usage or crash data without consent.**
