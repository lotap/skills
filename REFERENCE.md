# Command Line Interface Guidelines

Source: https://clig.dev

## Philosophy

### Human-first design
UNIX commands were traditionally machine-first. Today's CLIs are human-first. If a command is used primarily by humans, design it for humans.

### Simple parts that work together
Small, simple programs with clean interfaces can be combined to build larger systems. Std in/out/err, signals, exit codes ensure programs compose. Plain text is easy to pipe. JSON provides structure when needed.

### Consistency across programs
Follow existing patterns. That's what makes CLIs intuitive and guessable. But when consistency conflicts with usability, break with care.

### Saying (just) enough
Information is the interface. Too little: user wonders if it's broken. Too much: important info is drowned. Balance is crucial.

### Ease of discovery
Comprehensive help, examples, suggestions for next commands. Steal ideas from GUIs.

### Conversation as the norm
Running a program is a conversation - trial and error, setup then execution, exploration. Suggest corrections, show intermediate state, confirm before scary actions.

### Robustness
Be robust and feel robust. Handle unexpected input gracefully. Idempotent operations. Keep informed, explain errors, don't print scary stack traces.

### Empathy
Tools should be enjoyable. Exceed expectations. Show the user you're on their side.

### Chaos
Inconsistencies exist everywhere. Sometimes break rules - do so with intention and clarity.

---

## Guidelines

### The Basics

**Use a command-line argument parsing library.** Recommended:
- Multi-platform: docopt
- Bash: argbash
- Go: Cobra, urfave/cli
- Haskell: optparse-applicative
- Java: picocli
- Julia: ArgParse.jl, Comonicon.jl
- Kotlin: clikt
- Node: oclif
- Deno: parseArgs
- Perl: Getopt::Long
- PHP: Symfony Console, CLImate
- Python: Argparse, Click, Typer
- Ruby: TTY
- Rust: clap
- Swift: swift-argument-parser

**Return zero exit code on success, non-zero on failure.** Map non-zero codes to failure modes.

**Send output to stdout.** Primary output and machine-readable data goes to stdout.

**Send messaging to stderr.** Logs, errors go to stderr so piping doesn't capture them.

### Help

**Display extensive help when asked.** Show help on `-h` and `--help`. Subcommands should have their own help.

**Display concise help by default** when run with no arguments (unless interactive by default). Include: description, 1-2 examples, flag descriptions (unless many), instruction to pass `--help`.

**Show full help when `-h` and `--help` are passed.** Ignore other flags when help is requested. Don't overload `-h`. For git-like CLIs: `help`, `help subcommand`, `subcommand --help`, `subcommand -h`.

**Provide a support path** - website or GitHub link in top-level help.

**Link to web documentation** in help text. Link directly to subcommand anchors.

**Lead with examples.** Users prefer examples. Show actual output if helpful.

**If you have many examples, put them elsewhere** - cheat sheet command or web page.

**Display most common flags/commands first** in help text.

**Use formatting in help text** (bold headings) in a terminal-independent way.

**Suggest corrections when user makes a mistake.** E.g., "Did you mean ps?" Ask before running corrected command.

**If stdin is interactive and command expects piped input, display help and quit** (don't hang like `cat`).

### Documentation

**Provide web-based documentation** - searchable, linkable, inclusive.

**Provide terminal-based documentation** - fast, in-sync, works offline.

**Consider man pages.** Use tools like ronn. Make accessible via `help` subcommand.

### Output

**Human-readable output is paramount.** Use TTY detection to determine if output is for human or machine.

**Have machine-readable output** where it doesn't impact usability. Users should be able to pipe to `grep`.

**Use `--plain`** if human-readable output breaks machine-readable output (e.g., multi-line cells).

**Display output as formatted JSON if `--json` is passed.**

**Display output on success, but keep it brief.** Err on the side of less. Provide `-q` to suppress all non-essential output.

**If you change state, tell the user** what happened.

**Make it easy to see current state** (like `git status`).

**Suggest commands the user should run next.**

**Actions crossing the program's boundary should usually be explicit** (reading/writing files not passed as args, talking to remote servers).

**Increase information density with ASCII art** (like `ls` permissions display).

**Use color with intention** - highlight important things, don't overuse.

**Disable color when:**
- stdout/stderr is not a TTY (check individually)
- `NO_COLOR` is set (non-empty)
- `TERM` is `dumb`
- `--no-color` is passed
- Consider `MYAPP_NO_COLOR` env var

**Don't display animations if stdout is not a TTY** (prevents progress bar noise in CI).

**Use symbols and emoji where it clarifies** - structure output, draw attention. Don't overdo it.

**Don't output info only understandable by creators** by default - use verbose mode.

**Don't treat stderr like a log file** by default - no ERR/WARN labels unless verbose.

**Use a pager** (e.g., `less -FIRX`) if outputting a lot of text. Only if stdin or stdout is a TTY.

### Errors

**Catch errors and rewrite them for humans** with guidance.

**Signal-to-noise ratio is crucial.** Group similar errors under a header.

**Consider where the user will look first.** Most important info at end of output.

**For unexpected errors, provide debug/traceback and bug submission instructions.** Consider writing debug log to a file.

**Make it effortless to submit bug reports** - pre-populated URLs.

### Arguments and Flags

**Terminology:**
- Arguments = positional parameters (order matters)
- Flags = named parameters with `-` or `--` (order-independent)

**Prefer flags to args.** More typing but clearer and more future-proof.

**Have full-length versions of all flags** (both `-h` and `--help`).

**Only use one-letter flags for commonly used flags** to avoid polluting the namespace.

**Multiple arguments are fine for simple actions against multiple files** (`rm file1 file2 file3`).

**If you have two or more args for different things, you're probably doing something wrong.** Exception: common primary action like `cp <source> <destination>`.

**Use standard flag names:**
- `-a`, `--all` - All
- `-d`, `--debug` - Debug output
- `-f`, `--force` - Force
- `--json` - JSON output
- `-h`, `--help` - Help (never mean anything else)
- `-n`, `--dry-run` - Dry run
- `--no-input` - Disable interactivity
- `-o`, `--output` - Output file
- `-p`, `--port` - Port
- `-q`, `--quiet` - Quiet
- `-u`, `--user` - User
- `--version` - Version
- `-v` - verbose or version (avoid ambiguity)

**Make the default the right thing for most users.**

**Prompt for user input** if arg/flag not passed. But never require a prompt - always provide flag/arg alternative.

**Confirm before doing anything dangerous:**
- Mild: small local change (maybe prompt)
- Moderate: directory delete, remote change, complex bulk (usually prompt, offer dry-run)
- Severe: delete remote app/server (ask to type name, offer `--confirm="name"`)

**Support `-` for stdin/stdout** when input/output is a file.

**For flags with optional values, allow a special word like "none".**

**Make arguments, flags and subcommands order-independent** if possible.

**Do not read secrets directly from flags.** Use `--password-file` or stdin. Flags leak into `ps` and shell history.

### Interactivity

**Only prompt if stdin is a TTY** (not in a pipe or script).

**If `--no-input` is passed, don't prompt.** Fail with instructions if input required.

**When prompting for a password, don't echo it.**

**Let the user escape.** Always make Ctrl-C work. For wrappers where Ctrl-C can't quit, make escape clear.

### Subcommands

**Be consistent across subcommands** - same flag names, similar output formatting.

**Use consistent names for multiple levels** - common pattern: `noun verb` (e.g., `docker container create`).

**Don't have ambiguous or similarly-named commands** (e.g., "update" vs "upgrade").

### Robustness

**Validate user input.** Check early, bail with understandable errors.

**Responsive is more important than fast.** Print something in <100ms.

**Show progress for long operations** - spinner or progress bar. Show estimated time remaining. Libraries: tqdm (Python), schollz/progressbar (Go), node-progress (Node).

**Do stuff in parallel thoughtfully** - ensure output isn't confusingly interleaved. Use libraries.

**Make things time out** - configurable network timeouts with reasonable defaults.

**Make it recoverable** - up arrow + enter should pick up where it left off.

**Make it crash-only** - avoid cleanup, defer to next run.

**Expect misuse** - scripts, bad connections, multiple instances, untested environments.

### Future-proofing

**Keep changes additive where possible.** Add new flags instead of modifying existing ones.

**Warn before non-additive changes.** Tell users what to do to be future-proof.

**Changing output for humans is usually OK.** Encourage `--plain` or `--json` for scripts.

**Don't have a catch-all subcommand** - prevents adding new subcommands later.

**Don't allow arbitrary abbreviations of subcommands** - prevents adding commands later. Use explicit aliases.

**Don't create a time bomb** - don't depend on internet services that may disappear.

### Signals and Control Characters

**Ctrl-C (INT signal):** exit as soon as possible. Say something immediately, then clean up with timeout.

**Ctrl-C during cleanup:** skip cleanup on second Ctrl-C. Tell user what will happen.

### Configuration

Types of configuration:
1. **Varies per invocation** (e.g., debug level) → use flags
2. **Stable per machine, varies per project** (e.g., paths, color) → flags and env vars
3. **Stable per project** (e.g., Makefile, package.json) → version-controlled file

**Follow XDG Base Directory spec** - use `~/.config/` to avoid dotfile proliferation.

**If modifying non-program config, ask consent** and explain. Prefer new config files over modifying existing ones.

**Apply config in order of precedence:** flags > env vars > project config > user config > system config.

### Environment Variables

**Env vars for behavior that varies with context** - the terminal session.

**Names: uppercase, numbers, underscores only** (must not start with number).

**Aim for single-line values** - multi-line breaks `env` command.

**Avoid commandeering widely used names.** Check POSIX standard list.

**Check general-purpose env vars:**
- `NO_COLOR` - disable color
- `FORCE_COLOR` - enable color regardless
- `DEBUG` - verbose output
- `EDITOR` - file editing
- `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` - proxies
- `SHELL` - interactive shell
- `TERM`, `TERMINFO`, `TERMCAP` - terminal capabilities
- `TMPDIR` - temp files
- `HOME` - config files
- `PAGER` - output paging
- `LINES`, `COLUMNS` - screen size

**Read env vars from `.env`** where appropriate for project-level config.

**Don't use `.env` as substitute for proper config file** - no history, one data type, encoding issues, often contains secrets.

**Do not read secrets from environment variables** - leak into child processes, Docker inspect, systemd, etc. Use credential files, pipes, AF_UNIX sockets, or secret management.

### Naming

**Make it a simple, memorable word** - but not too generic.

**Use only lowercase letters and dashes** if needed.

**Keep it short** but not too short (save those for common utilities).

**Make it easy to type** - flowing keystrokes, not awkward one-handed patterns.

### Distribution

**Distribute as a single binary** if possible. Use PyInstaller for Python. Otherwise use platform's native package installer.

**Make it easy to uninstall** - include instructions next to install instructions.

### Analytics

**Do not phone home without consent.** Be explicit about what, why, how anonymized, retention.

**Prefer opt-in.** If opt-out, clearly tell users on first run and make it easy to disable.

**Consider alternatives:** instrument web docs, instrument downloads, talk to users.

---

## Further Reading

- [The Unix Programming Environment](https://en.wikipedia.org/wiki/The_Unix_Programming_Environment), Kernighan and Pike
- [POSIX Utility Conventions](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html)
- [GNU Coding Standards](https://www.gnu.org/prep/standards/html_node/Program-Behavior.html)
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46), Jeff Dickey
- [CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide), Heroku
- [no-color.org](https://no-color.org/)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [The Poetics of CLI Command Names](https://smallstep.com/blog/the-poetics-of-cli-command-names/)
- [Google: Writing Helpful Error Messages](https://developers.google.com/tech-writing/error-messages)
- [Nielsen Norman Group: Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines)
