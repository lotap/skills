---
name: clig
description: Write and analyze command-line interfaces against the clig.dev Command Line Interface Guidelines. Use when working on CLI tools, reviewing CLI design, or when user mentions CLI guidelines, clig.dev, or command-line interface design.
---

# CLI Guidelines (clig.dev)

Write and review CLIs against the [Command Line Interface Guidelines](https://clig.dev). Full reference in [REFERENCE.md](REFERENCE.md).

## Quick reference

**Core principles:** human-first design, simple composable parts, consistency, saying enough, discoverability, conversation-as-norm, robustness, empathy.

**Critical rules (The Basics):**
- Use an argument parsing library
- Return 0 on success, non-zero on failure
- Output to stdout, messaging to stderr

## Workflow: Analyze a CLI for compliance

1. **Read the CLI source code** - entry point, arg parsing, output, errors, subcommands, config
2. **Check each guideline section** against the code:

   - [ ] **Basics** - exit codes, stdout/stderr discipline
   - [ ] **Help** - `-h`/`--help`, subsections, examples, suggestions
   - [ ] **Documentation** - man pages, web docs
   - [ ] **Output** - TTY detection, `--json`, `--plain`, `--quiet`, color rules
   - [ ] **Errors** - human-readable, signal-to-noise, suggestions
   - [ ] **Args & flags** - prefer flags, standard names, `--dry-run`, `--force`
   - [ ] **Interactivity** - TTY-only prompts, `--no-input`, Ctrl-C
   - [ ] **Subcommands** - noun-verb, consistency, no ambiguous names
   - [ ] **Robustness** - validation, progress, timeouts, parallel output
   - [ ] **Configuration** - XDG spec, precedence, `.env` limits
   - [ ] **Environment vars** - `NO_COLOR`, `DEBUG`, `EDITOR`, `PAGER`
   - [ ] **Naming** - lowercase, short, typable
   - [ ] **Security** - no secrets in flags or env vars, use `--password-file` or stdin
   - [ ] **Distribution** - single binary when possible, easy uninstall
   - [ ] **Analytics** - opt-in only, document collection

3. **Report findings** - list conformances and violations with code references and suggested fixes

## Workflow: Write a new CLI

1. Choose a recommended argument parsing library for your language
2. Implement `--help` / `-h` with examples-first formatting
3. Add `--version`
4. Set up stdout/stderr discipline (output to stdout, messaging to stderr)
5. Add TTY detection for color, animations, prompts
6. Implement `--json` and `--plain` for machine-readable output
7. Add standard flags: `--quiet`, `--no-input`, `--dry-run`, `--force`
8. Write human-readable errors with suggestions
9. Follow naming conventions - lowercase, dashes, typable
10. Set up configuration following XDG spec

## Standard flags

| Short | Long | Purpose |
|-------|------|---------|
| `-h` | `--help` | Help text (never overload) |
| | `--version` | Version info |
| `-d` | `--debug` | Debug output |
| `-q` | `--quiet` | Suppress non-essential output |
| `-f` | `--force` | Skip confirmations |
| `-n` | `--dry-run` | Describe changes without making them |
| | `--json` | Machine-readable JSON output |
| | `--plain` | Plain tabular output for scripts |
| | `--no-color` | Disable color |
| | `--no-input` | Disable interactive prompts |
| `-o` | `--output` | Output file |
| `-a` | `--all` | All items |

## Recommended libraries by language

- **Python:** Click, Typer, Argparse
- **Go:** Cobra, urfave/cli
- **Rust:** clap
- **Node:** oclif
- **Ruby:** TTY
- **Swift:** swift-argument-parser
- **Java:** picocli
- **Bash:** argbash

See [REFERENCE.md](REFERENCE.md) for the complete guidelines and all library options.
