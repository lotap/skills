# cli-guidelines

Build CLIs with delightful experiences for humans (with agents)

I went through the https://clig.dev/ documentation and wrote a series of "tests" by hand

This format gives your agent real actionable items for a more thorough review than a simple summary of the documentation provides

## Installation

```sh
npx skills add lotap/skills --skill cli-guidelines
```

## Example Usage

```
Write a CLI tool that fetches the weather for a given city using a mock API. A user should be able to enter a date for weather for a particular day, defaults to today. Add a lunar subcommand that outputs the moon's phase. The mock api should require an API_KEY.
```

## Skill Structure

Follows the [Agent Skills Spec](https://agentskills.io/specification)

The bulk of the skill is a series of tests I derived from the [clig documentation](https://clig.dev/). They are worded specifically to give agents actionable instructions without bloating the context.

The entire clig guideline is available internally at [./references/clig/full.md](./references/clig/full.md)

The guideline is also broken up into individual sections in the [./references/clig](./references/clig) directory. This allows an agent to dynamically pull in sections as needed, without the overhead of the full guideline.

One significant deviation from the reference is that the skill skips over external documentation guidelines by default. The docs provides some suggestions about linking to web documentation, but that often led to agents hallucinating links. Any rules related to external documentation have been moved to [./references/docs-guide.md](./references/docs-guide.md), which the agent should only use when reviewing existing code.

## Evals

You can see the prompts and assertions tested in the [`evals.json` file](./evals/evals.json)

To run them, you can use my [skills-eval-run](https://github.com/lotap/skills/tree/trunk/skills/skill-eval-run) skill or use it as a guide

At the end of the day, there is a heavy reliance on LLM output for grading the results. So take them with a grain of salt.

### Key Findings

**The skill meaningfully and consistently improves CLI output**

Every run I've tried matches or increases the amount of tests that pass compared to the baseline

**Token count and timing _generally_ increase with correctness improvement**

I spent a lot of time reducing the token overhead of the skill itself. Ironically, as the token count of the `SKILL.md` decreased and more tests passed, the total token use went _up_. This suggests that:

1. The majority of token usage comes from _implementing_ the skill, not the `SKILL.md` itself
1. When the model writes more robust code, it requires additional time and tokens

In a testing environment, this looks like a bad thing. In the real world, it means you could _save_ on tokens and time overall because the output of your initial prompt will be much closer to "correct" than without the skill. You might not need a follow-up prompt at all.

**Consistency may sometimes be at-odds with efficiency**

Loading more information into the skill upfront can result in more consistent performance, but may be extra bloat for prompts that don't need the extra info.

Relying on linked material can save both time and tokens, but can also be less reliable for important information.

[See Comparison Section](#comparison)

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

### Comparison

While researching this skill, I found this project: https://github.com/MildTomato/agent-skills/tree/main/cli-guidelines

Based on the results of running the evals (shown below), the MildTomato skill is generally more token efficient and faster, but slightly less "correct" overall.

That makes sense thinking about the structures of the two skills:

 - This one front-loads almost all of the tests - so each run uses a sizeable amount of tokens to parse through it, but it remains consistent.

 - The MildTomato skill relies on loading additional information for rules. That optimizes the amount of tokens used, but also has higher potential for the agent to skip rules or details completely.

> Also worth noting, 2 runs each is not statistically significant. All of these data points could fall within standard variance. The above is my hypothesis, proving it would require several more runs and additional models.

#### Per-Entry Correctness

| Entry | Baseline (no skill) | w/skill lotap Run 1 | w/skill lotap Run 2 | w/skill MildTomato Run 1 | w/skill MildTomato Run 2 |
|-------|---------------------|---------------------|---------------------|--------------------------|--------------------------|
| 1 | 57.1% (8/14) | **85.7%** (12/14) | **85.7%** (12/14) | 78.6% (11/14) | **85.7%** (12/14) |
| 2 | 62.5% (10/16) | 68.8% (11/16) | **75.0%** (12/16) | 68.8% (11/16) | **75.0%** (12/16) |
| 3 | 37.5% (3/8) | 75.0% (6/8) | 87.5% (7/8) | 87.5% (7/8) | **100%** (8/8) |
| 4 | 55.6% (5/9) | 66.7% (6/9) | **88.9%** (8/9) | 66.7% (6/9) | 44.4% (4/9) |
| **Mean** | **55.3%** | **74.5%** | **83.0%** | **74.5%** | **76.3%** |

#### Understanding the failed assertions

Digging into _where_ the variance in "correctness" occurs is mostly due to entry 4. The prompt explicitly states "Treat deletion of todos as a moderately dangerous action" and tests for the existence of --dry-run commands. The MildTomato skill doesn't seem to cause the agent to register that "moderately dangerous action" → use dry-run, despite the fact that "Provide --dry-run for safety" is listed as "critical" in the skill. That causes 2 failures in the assertions. (one for enabling a dry-run mode and another to check the specific `-n`/`--dry-run` flags)

The MildTomato output also consistently missed a point in that entry because it doesn't suggest corrections to misspelled commands, something that the skill omits from its rules.

The divergence between run 1 & 2 is due to:

- the agent on the second run did not print a summary of the changes
- the `--plain` flag wasn't supported. _this may be more of an issue with the assertion being overly strict than an actual issue_

#### Per-Entry Timing & Tokens

| Entry | Metric | Baseline | w/skill lotap Run 1 | w/skill lotap Run 2 | w/skill MildTomato Run 1 | w/skill MildTomato Run 2 |
|-------|--------|----------|---------------------|---------------------|--------------------------|--------------------------|
| 1 | Time | 39.2s | 69.1s (+29.8s) | 72.1s (+32.8s) | 63.9s (+24.7s) | **57.7s** (+18.5s) |
| | Tokens | 13,875 | 25,283 (+11,408) | 21,554 (+7,679) | 20,730 (+6,855) | **19,994** (+6,119) |
| 2 | Time | 114.5s | 128.3s (+13.8s) | **86.7s** (−27.8s) | 200.1s (+85.6s) | 104.2s (−10.3s) |
| | Tokens | 27,097 | 50,947 (+23,850) | 56,296 (+29,199) | **40,189** (+13,092) | 40,505 (+13,408) |
| 3 | Time | 26.5s | 189.1s (+162.6s) | 147.5s (+121.0s) | 242.9s (+216.4s) | **127.2s** (+100.7s) |
| | Tokens | 12,630 | 32,288 (+19,658) | 50,358 (+37,728) | 47,011 (+34,381) | **29,037** (+16,407) |
| 4 | Time | 86.9s | 264.4s (+177.5s) | 318.3s (+231.4s) | **100.4s** (+13.5s) | 137.6s (+50.7s) |
| | Tokens | 23,499 | 53,326 (+29,827) | 53,924 (+30,425) | **42,252** (+18,753) | 49,295 (+25,796) |
| **Mean** | Time | 66.8s | 162.7s (+95.9s) | 156.1s (+89.3s) | 151.8s (+85.0s) | **106.7s** (+39.9s) |
| | Tokens | 19,275 | 40,461 (+21,186) | 45,533 (+26,258) | 37,546 (+18,271) | **34,708** (+15,433) |

#### Conclusion

> All of the tests were run using the relatively "dumb" DeepSeek V4 Flash model - it remains TBD if the findings are consistent between models, especially those at the frontier.

Overall, both skills are reasonable ways to improve agentic output for writing CLIs. The MildTomato skill will likely run faster and with more token efficiency but may miss some edge-cases.

On average, the MildTomato skill uses **84% of the tokens** and runs in **81% of the time** as this skill, but achieved **96% of the correctness** (71 vs 74 passing assertions). Whether that remaining 4% is worth the token/time cost is up to you.

## License

This work is derived from https://clig.dev/

In accordance with [that project's license](https://github.com/cli-guidelines/cli-guidelines?tab=CC-BY-SA-4.0-1-ov-file), this skill also uses the [Creative Commons Attribution Share Alike 4.0 International License](./LICENSE)