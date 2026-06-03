# cli-guidelines

Build CLIs with delightful experiences for humans (with agents)

I went through the https://clig.dev/ documentation and wrote a series of "tests" by hand

This format gives your agent real actionable items for a much more thorough review than a simple summary of the documentation

## Installation

```sh
npx skills add lotap/skills --skill cli-guidelines
```

## Example Usage

```
Write a CLI tool that fetches the weather for a given city using a mock API. A user should be able to enter a date for weather for a particular day, defaults to today. Add a lunar subcommand that outputs the moon's phase. The mock api should require an API_KEY.
```

## Evals

Follows the [Agent Skills Spec](https://agentskills.io/skill-creation/evaluating-skills)

You can see the prompts and assertions tested in the [`evals.json` file](./evals/evals.json)

To run them, you can use my [skills-eval-run](https://github.com/lotap/skills/tree/trunk/skills/skill-eval-run) skill or use it as a guide

At the end of the day, there is a heavy reliance on LLM output for grading the results. So take them with a grain of salt.

### Key Findings

**The skill meaningfully and consistently improves CLI output**

Every run I've tried matches or increases the amount of tests that pass compared to the baseline

**Token count and timing generally increase with correctness improvement**

I spent a lot of time reducing the token overhead of the skill itself. Ironically, as the token count of the `SKILL.md` decreased and more tests passed, the total token use went _up_. This suggests that:

1. The majority of token usage comes from _implementing_ the skill, not the `SKILL.md` itself
1. When the model writes more robust code, it requires additional time and tokens

In a testing environment, this looks like a bad thing. In the real world, it means you could _save_ on tokens and time overall because the output of your initial prompt will be much closer to "correct" than without the skill. You might not need a follow-up prompt at all.

### Sample Results

[OpenCode](https://opencode.ai/) with DeepSeek V4 Flash (max) across 4 eval entries (2 with-skill runs).

#### Correctness

| Entry | Baseline | Run 1 | Run 2 | With-skill Δ |
|-------|----------|-------|-------|--------------|
| 1 | 57% | 86% | 86% | +29% |
| 2 | 63% | 69% | 75% | +9% |
| 3 | 38% | 75% | 88% | +44% |
| 4 | 56% | 67% | 89% | +22% |
| **Mean** | **53%** | **74%** | **84%** | **+26%** |

#### Timing

| Entry | Baseline | Run 1 | Run 2 | With-skill Δ |
|-------|----------|-------|-------|--------------|
| 1 | 39.2s | 69.1s | 72.1s | +31.4s (+80%) |
| 2 | 114.5s | 128.3s | 86.7s | −7.0s (−6%) |
| 3 | 26.5s | 189.1s | 147.5s | +142.0s (+536%) |
| 4 | 86.9s | 264.4s | 318.3s | +204.5s (+235%) |
| **Mean** | **66.8s** | **162.7s** | **156.1s** | **+92.7s (+139%)** |

#### Tokens

| Entry | Baseline | Run 1 | Run 2 | With-skill Δ |
|-------|----------|-------|-------|--------------|
| 1 | 13,875 | 25,283 | 21,554 | +9,544 (+69%) |
| 2 | 27,097 | 50,947 | 56,296 | +26,525 (+98%) |
| 3 | 12,630 | 32,288 | 50,358 | +28,693 (+227%) |
| 4 | 23,499 | 53,326 | 53,924 | +30,126 (+128%) |
| **Mean** | **19,275** | **40,461** | **45,533** | **+23,722 (+123%)** |

## License

This work is derived from https://clig.dev/

In accordance with [that project's license](https://github.com/cli-guidelines/cli-guidelines?tab=CC-BY-SA-4.0-1-ov-file), this skill also uses the [Creative Commons Attribution Share Alike 4.0 International License](./LICENSE)