```
 ▄███▄   ██   ██  ██████   ▄███▄   ██  ▄█  ██       ▄███▄    ▄███▄   █████▄
██   ▀▀  ██   ██  ██      ██   ▀▀  ██▄█▀   ██      ██   ██  ██   ██  ██  ▐██
██       ███████  █████   ██       ████    ██      ██   ██  ██   ██  █████▀
██   ▄▄  ██   ██  ██      ██   ▄▄  ██▀█▄   ██      ██   ██  ██   ██  ██
 ▀███▀   ██   ██  ██████   ▀███▀   ██  ▀█  ██████   ▀███▀    ▀███▀   ██
```

# claude-check-loop

Version 4.1.0 provides adversarial plan refinement, peer-reviewed research, and supervised plan execution for Claude Code.

The model roles are:

- **Fable** owns plans, research, orchestration, validation, and review decisions.
- A fresh **Opus** subagent implements each bounded step or accepted fix.
- **Codex** reviews plans, research drafts, implementation steps, and final execution packets. Its model and reasoning effort are configurable; by default they inherit your Codex settings rather than requiring a particular model.

## Why the evidence gate exists

Multiple reviewers can agree on an invented fact. Agreement and confidence are not proof.

**No evidence, no blocking finding.**

Every plan, research, and step concern must identify its evidence and status:

```text
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:
```

- `VERIFIED`: the cited source directly supports the claim.
- `INFERENCE`: cited facts support a conclusion that has not been reproduced.
- `UNVERIFIED`: evidence is missing or inaccessible.

Only verified critical or important findings may block. Fable independently verifies every citation before accepting, rejecting, or countering a concern. Inferences, unverified claims, and minor findings remain nonblocking.

## Skills

### `/check-loop` — plan refinement

Fable and the configured Codex reviewer challenge an implementation plan for up to six rounds by default:

1. Fable reads the complete plan, original request, and relevant repository context.
2. Codex reviews the plan using the evidence contract.
3. Fable checks every cited source and records `ACCEPT`, `REJECT`, or `COUNTER`.
4. Fable updates the plan only for verified accepted or countered findings.
5. The loop ends at `PLAN APPROVED -- No remaining concerns.` or when no independently verified blocker remains. At the configured limit, a verified blocker stops for user input.

Each round checks all applicable risks, with extra emphasis on architecture/correctness in round 1, security/data integrity in round 2, and operations/recovery in later rounds. Rotation never forces unnecessary rounds after a clean review. The round limit is configurable from 1 to 40 and is frozen for each run.

The result includes verified changes, defended decisions, unresolved verified disagreements, unverified questions, and an original-to-final diff.

### `/check-loop:research` — peer-reviewed research

Fable researches the requested question and writes one final Markdown report:

1. Fable gathers current evidence, preferring primary sources.
2. The draft separates source facts, inference, counterevidence, and unknowns.
3. Codex reviews factual support, source quality, missing evidence, and conclusions in one persistent thread.
4. Fable independently opens every cited source and records `ACCEPT`, `REJECT`, or `COUNTER`.
5. Fable revises only for verified accepted or countered findings.
6. The loop ends on `RESEARCH APPROVED` or when no independently verified blocker remains. At the configured round limit, a verified blocker preserves the draft and stops for user input.

The report includes sources, unresolved questions, and an auditable peer-review record. It produces no code or implementation plan.

### `/check-loop:execute` — supervised execution

Fable executes an approved plan without surrendering repository or git ownership:

1. Locks the plan and records the current commit and working-tree state.
2. Asks before isolating or including any existing user changes; never hides them.
3. Defines one bounded step contract.
4. Dispatches a fresh Opus implementer that does not stage or commit.
5. Inspects the change and runs repository-native validation.
6. Sends a secret-filtered, step-scoped diff and observed validation output to the persistent Codex thread.
7. Independently verifies and adjudicates every Codex finding.
8. Uses a fresh Opus fixer only for an accepted or countered blocking finding.
9. Runs final project verification and sends a sanitized final review packet to the persistent Codex thread.
10. Asks before any commit or push.

There are no duplicate model reviewers and no project-specific coding rules. The current repository's instructions and conventions control.

## Prerequisites

- Claude Code 2.1.257 or later. This version introduced the `fable` model alias used by the skill frontmatter.
- Node.js 18 or later.
- An authenticated Codex CLI installation.

Install and authenticate Codex:

```bash
npm install -g @openai/codex
codex login
```

For headless machines:

```bash
codex login --device-auth
```

Verify the transport from the repository root:

```bash
node plugins/check-loop/scripts/codex-invoke.mjs setup
```

Setup reports the chosen settings, CLI availability, and authentication status. `Status: ready` means the installation and login are ready; it does **not** prove access to the selected model. The first review invocation validates the effective settings and exposes unsupported-model errors.

Fable and Opus are Claude Code aliases and follow Anthropic's current alias targets. The Codex reviewer is not hardcoded.

## Installation

### Plugin marketplace

```text
/plugin marketplace add lordknows13/claude-check-loop
/plugin install check-loop@lordknows13-check-loop
/reload-plugins
```

Run plan refinement, research, and execution in a Fable session. If your host does not apply the skill's model selection automatically, start Claude Code with `claude --model fable`. Reviewer settings change Codex, not the Fable orchestrator or Opus implementers.

### Updating an existing installation

```text
/plugin marketplace update lordknows13-check-loop
/plugin update check-loop@lordknows13-check-loop
/reload-plugins
```

If the update asks for a restart, restart Claude Code before invoking the updated skills. Your reviewer settings live outside the plugin cache and survive plugin updates.

### Local development

Keep the complete plugin directory together; copying skills alone does not provide their transport scripts or plugin-root resolution.

```bash
git clone https://github.com/lordknows13/claude-check-loop.git
claude --model fable --plugin-dir ./claude-check-loop/plugins/check-loop
```

When launching from another project, pass the absolute path to the clone's `plugins/check-loop` directory. `--plugin-dir` loads that local copy for the current session without publishing it.

## Usage

Refine a plan:

```text
/check-loop path/to/plan.md
```

Research a question:

```text
/check-loop:research "Compare SQLite and PostgreSQL for this offline-first application"
```

Execute the approved plan:

```text
/check-loop:execute path/to/plan.md
```

If the current conversation identifies exactly one plan or research request, its argument may be omitted.

### Reviewer settings

Use `/check-loop:settings` to inspect or change the reviewer model, reasoning effort, and maximum plan/research rounds. Ask for user-wide settings or project-only settings. Use an exact model ID supported by your Codex account, or `default` to inherit Codex configuration; setup does not enumerate or certify model access.

For example:

```text
/check-loop:settings Use the Codex default model, high effort, and six review rounds for my user settings.
```

| Setting | Default | Behavior |
|---|---|---|
| Reviewer model | Codex default | Inherit Codex configuration or select an exact supported model ID. Astra is optional. |
| Reasoning effort | Codex default | Inherit Codex configuration or request an effort supported by the selected model. |
| Plan/research round cap | `6` | Integer from `1` through `40`; frozen for the run, with early exit when no verified blocker remains. |

Execution retains its separate three-unsuccessful-fixes limit. Changing the plan/research cap does not change that limit.

The same settings are available directly:

```bash
# Inspect effective settings without starting Codex
node plugins/check-loop/scripts/codex-invoke.mjs config

# Save a user-wide reviewer choice
node plugins/check-loop/scripts/codex-invoke.mjs config \
  --model YOUR_CODEX_MODEL_ID --effort high --max-rounds 6

# Override just effort for the current project
node plugins/check-loop/scripts/codex-invoke.mjs config --project --effort medium

# Reset project model/effort to Codex defaults, bypassing user overrides
node plugins/check-loop/scripts/codex-invoke.mjs config \
  --project --model default --effort default
```

Precedence is per setting: invocation flags → project `.claude/check-loop.json` at `--cwd` → user `~/.claude/check-loop/config.json` → defaults. `CLAUDE_CONFIG_DIR` relocates the user Claude directory. Omitted keys inherit the next layer; JSON `null` explicitly inherits Codex's own model/effort. Default settings are `{"model":null,"effort":null,"maxRounds":6}`.

`config` setters preserve other saved keys and write user-wide settings unless `--project` is supplied. `setup`, `turn`, and `review` accept nonpersistent `--model` and `--effort` overrides. Unknown flags and malformed settings fail rather than silently selecting another reviewer.

Each successful turn returns its actual model/effort, which the skills pin for later rounds. Native review may inherit a separate Codex `review_model`; if no explicit reviewer model was requested, its result reports `model: null` rather than claiming to know that separate model.


### Refinement output

```text
Round 2/6 — Codex model: <actual model>; effort: <actual effort>
Concerns: 2
- Accepted: F3
- Rejected: F4
- Countered: none
- Unverified questions: F5

PLAN APPROVED -- No remaining concerns.
```

### Execution output

```text
Step 2: COMPLETE
Implementation: Opus
Validation: node --test — pass
Codex: STEP APPROVED after 1 fix round (actual model/effort shown)
Adjudication: accepted F3 | rejected F4 | countered none
Unverified questions: F5

Execution complete — awaiting approval
Final verification: pass
Final Codex review: no verified blocking findings
Working tree: reviewed and uncommitted
```

## Transport

`plugins/check-loop/scripts/codex-invoke.mjs` talks to the official Codex App Server protocol over JSON-RPC. It reuses a broker connection, streams notifications, manages thread IDs, and uses the local Codex OAuth session. Explicit model/effort mismatches fail; turn reviews also reject unexpected rerouting away from the effective model. No runtime npm dependency or API key is required when using Codex login.

Commands:

```bash
# Check installation/authentication and display reviewer settings
node plugins/check-loop/scripts/codex-invoke.mjs setup

# Start a review thread
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" \
  --prompt "PROMPT"

# Continue that thread
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --prompt "PROMPT"

```

Results contain `threadId`, `response`, `model`, `effort`, numeric `status` (0 or 1), and `error`. A zero transport status is not an approval verdict: the orchestrator must still adjudicate the response. Failed, empty, or malformed responses stop the workflow instead of becoming "no findings." Authentication and startup errors exit nonzero with actionable stderr.


## Architecture

```text
plugins/check-loop/
  plugin.json
  scripts/
    codex-invoke.mjs
    app-server-broker.mjs
    lib/
  skills/
    check-loop/
      SKILL.md
    research/
      SKILL.md
    execute/
      SKILL.md
      implementer-prompt.md
    settings/
      SKILL.md
```

The skill names are `check-loop`, `research`, `execute`, and `settings`.

## Safety boundaries

- Existing work is never hidden, discarded, staged, or silently included.
- Implementers never stage or commit.
- Research produces one Markdown report and no implementation changes.
- Secret and credential content is excluded from review prompts.
- Explicit model/effort substitution and incomplete review output stop execution.
- During execution, validation failures and verified blocking findings stop after three unsuccessful fix cycles.
- Commit and push require explicit user approval.

## Changes in 4.1.0

- Configurable reviewer model/effort with Codex-default inheritance; removed mandatory Astra selection.
- Bounded plan/research rounds and rotating additional review perspectives, inspired by [Claudex](https://github.com/promptadvisers/claudex). Preserved check-loop's stronger independent-evidence gate and read-only sandbox; did not copy unrestricted execution or Stop-hook machinery.
- Explicit review outcome/error handling, informed by the [official Codex plugin's result-handling guidance](https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/skills/codex-result-handling/SKILL.md). Failed or missing reviews never become a substitute verdict.
- Fixed ignored reviewer flags, missing initial thread effort, and truncation of inline prompts containing `=`.

## Development checks

Run from the repository root:

```bash
node --test tests/orchestration-contract.test.mjs
claude plugin validate ./plugins/check-loop
claude plugin validate ./.claude-plugin/marketplace.json
```

The regression suite covers settings precedence and persistence, invalid configuration, model/effort substitution, and failed or empty review results. It does not require model access. For live integration checks, use an authenticated Codex CLI and an isolated repository; exercise a new turn, a resumed turn, and native review without changing real project files.


## License

MIT
