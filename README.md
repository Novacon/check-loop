# check-loop

check-loop is a Claude Code plugin that asks Codex to review a plan before you build it, check a research draft, or review code as you work through an approved plan.

Your session model runs the workflow and checks the review findings. A fresh subagent implements each step, using your session model unless you set an implementer model. Codex reviews the work using your chosen model and reasoning effort, or your existing Codex defaults.

A review finding needs evidence before it can block progress. The orchestrator checks the cited source instead of accepting a concern just because another model raised it.

Current version: 5.1.0.

## Install

You need Claude Code 2.1.257 or later, Node.js 18 or later, and an authenticated Codex CLI. The skills run on your session's current model, and execution's implementers inherit it unless you choose another.

Install Codex and sign in from your terminal:

```bash
npm install -g @openai/codex
codex login
```

On a headless machine, use `codex login --device-auth`.

Run these commands inside Claude Code:

```text
/plugin marketplace add Novacon/check-loop
/plugin install check-loop@lordknows13-check-loop
/reload-plugins
```

The skills do not switch models. Pick the model and effort you want for the session (for example `claude --model fable`) before invoking them.

### Update

```text
/plugin marketplace update lordknows13-check-loop
/plugin update check-loop@lordknows13-check-loop
/reload-plugins
```

Restart Claude Code if the update requests it. Your reviewer settings live outside the plugin cache and survive updates.

## Use it

### Review a plan

```text
/check-loop path/to/plan.md
/check-loop --quick path/to/plan.md
```

The orchestrator reads the plan and relevant repository files, then sends the plan to Codex. The first round is the one broad review. The orchestrator checks each finding, fixes the plan where the evidence supports a change, and later rounds only confirm those fixes and check the changed text. They don't reopen parts of the plan that didn't change.

You see one line per round. The loop stops when no verified blocking concern remains, after up to six rounds by default. `--quick` runs a single review pass. If the same blockers keep coming back, or the limit is reached with fixes Codex hasn't confirmed yet, the orchestrator asks you what to do: keep fixing, waive the named risks, run one confirmation round, or stop. The result lists what changed, what the orchestrator rejected and why, and any open questions.

An interrupted review resumes where it stopped the next time you run the command on the same plan.

### Research a question

```text
/check-loop:research "Compare SQLite and PostgreSQL for this offline-first application"
```

The orchestrator gathers sources and writes a draft. Codex checks the facts, sources, gaps, and conclusions. The orchestrator verifies the findings and revises the draft through the same review loop.

You get one Markdown report with sources, remaining questions, and a record of the review. This command does not implement code or write an implementation plan.

### Execute a plan

```text
/check-loop:execute path/to/plan.md
```

The orchestrator records the approved plan and the repository's starting state. For each step, it gives a fresh subagent a bounded task, runs the project's checks, and sends the relevant diff and results to Codex.

If the orchestrator verifies a blocking finding, a fresh subagent fixes it. Execution stops after three unsuccessful fix cycles. The orchestrator runs final checks and requests a final Codex review before handing the work back to you.

Existing uncommitted work requires your decision before execution starts. Implementers do not stage or commit. Committing and pushing also require your approval.

You can omit the plan path or research question when the conversation already identifies exactly one.

## Choose the reviewer

```text
/check-loop:settings
```

You can change the Codex model, reasoning effort, and plan or research round limit. For example:

```text
/check-loop:settings Use the Codex default model, high effort, and six review rounds for my user settings.
```

| Setting | Default | Options |
|---|---|---|
| Model | Your Codex configuration | An exact model ID your account supports, or `default` |
| Reasoning effort | Your Codex configuration | An effort the selected model supports, or `default` |
| Maximum review rounds | 6 | An integer from 1 to 40 |
| Implementer model | Your session model | A model your host accepts for subagents (for example `opus` or `sonnet` in Claude Code, `provider/id` in pi), or `default` |

Ask for user-wide settings or project-only settings. Model, effort, and round limit affect Codex. Implementer model affects only the subagents `execute` dispatches. The round limit applies to plans and research. It does not change execution's three-fix limit.

Each plan or research run keeps the round limit and reviewer it started with. Reviews stop early when no verified blocker remains.

### Settings files and CLI

Each setting uses the first value defined in this order:

1. Command-line override.
2. `.claude/check-loop.json` in the working directory selected by `--cwd`.
3. `~/.claude/check-loop/config.json`.
4. The plugin default.

`CLAUDE_CONFIG_DIR` changes the user configuration directory. An omitted key inherits the next level. A `null` model or effort selects Codex's own setting, even when a lower level specifies a different value.

From a clone of this repository, you can inspect or change settings directly:

```bash
# Show the effective settings without starting Codex.
node plugins/check-loop/scripts/codex-invoke.mjs config

# Save user-wide settings.
node plugins/check-loop/scripts/codex-invoke.mjs config \
  --model YOUR_CODEX_MODEL_ID --effort high --max-rounds 6

# Change only the current project's effort.
node plugins/check-loop/scripts/codex-invoke.mjs config --project --effort medium

# Use Codex defaults for this project instead of user-level model and effort overrides.
node plugins/check-loop/scripts/codex-invoke.mjs config \
  --project --model default --effort default
```

Setters preserve the other saved keys. They write user-wide settings unless you pass `--project`. The `setup`, `turn`, and `review` commands also accept temporary `--model` and `--effort` overrides.

## How reviews work

Codex must cite a plan passage, source file, command result, or research source for each finding. Findings carry one of these evidence labels:

- `VERIFIED` means the cited source supports the claim.
- `INFERENCE` means the source suggests a conclusion that has not been reproduced.
- `UNVERIFIED` means the evidence is missing or inaccessible.

Only verified critical or important findings can block progress. The orchestrator checks the citation and records whether it accepts, rejects, or counters the finding. Minor findings, inferences, and unanswered questions remain in the report without blocking the work.

After the first round, a new finding can block only if the revision introduced it or it is a verified critical defect the first round missed. A rejected finding can be disputed once, with new evidence. Repeats of findings that are already decided are dropped.

The reviewer runs in a read-only sandbox. Credential-shaped values are redacted from every payload and from saved run state. A failed, empty, malformed, or timed-out response (20 minutes by default) is retried once and then stops the workflow. It never counts as approval.

## Check your setup

From the repository root:

```bash
node plugins/check-loop/scripts/codex-invoke.mjs setup
```

`Status: ready` means the Codex CLI is installed and authenticated. It does not confirm access to a particular model. The first review checks the effective model and effort. Unsupported choices and explicit setting mismatches fail instead of silently selecting a different reviewer.

## Local development

```bash
git clone https://github.com/Novacon/check-loop.git
claude --plugin-dir ./check-loop/plugins/check-loop
```

When working in another project, pass the absolute path to the clone's `plugins/check-loop` directory. Keep the whole plugin directory together. The skills need the scripts alongside them.

The skills live in `plugins/check-loop/skills/`. `scripts/codex-invoke.mjs` handles settings and talks to the Codex App Server over JSON-RPC. It reuses a broker connection and your local Codex login. The plugin has no runtime npm dependencies and needs no separate API key when you use Codex login.

### Call the reviewer directly

```bash
# Run one plan review round. The first call needs the original request.
node plugins/check-loop/scripts/codex-invoke.mjs round \
  --cwd "$(pwd)" --kind plan --artifact plan.md --request-file request.md

# After editing the plan, record decisions and run the next round.
node plugins/check-loop/scripts/codex-invoke.mjs round \
  --cwd "$(pwd)" --artifact plan.md --adjudication-file decisions.json

# Summarize a review.
node plugins/check-loop/scripts/codex-invoke.mjs report --cwd "$(pwd)" --artifact plan.md

# Free-form turns, used by execution.
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" --prompt-file prompt.md [--thread-id THREAD_ID]
```

`round` prints the next action (`adjudicate`, `stalled`, `cap`, `done`, or `retry`), the blocking findings, and a one-line summary. Run state lives in `~/.claude/check-loop/runs/`. `turn` results include `threadId`, `response`, `model`, `effort`, `status`, and `error`. A status of `0` means the call succeeded, not that the reviewer approved the work.

Successful turns report their effective model and effort, and later rounds reuse them. Native review can use a separate Codex `review_model`. If you did not request a model explicitly, native review reports `model: null` rather than guessing which model ran.

### Run the checks

```bash
node --test tests/
claude plugin validate ./plugins/check-loop
claude plugin validate ./.claude-plugin/marketplace.json
```

The tests cover settings precedence, invalid configuration, reviewer setting mismatches, failed or empty responses, and the review loop's rules: diff-only later rounds, closure gating, repeat suppression, one-time disputes, stall detection, the round limit and closeout, retries, and secret redaction. They do not need model access. For a live check, use an authenticated Codex CLI and a disposable repository.

## Changes in 5.1.0

- **Uses your session model.** The skills no longer switch to Fable; they run on whatever model and effort the session uses.
- **Configurable implementer model.** `execute`'s implementer and fixer subagents inherit the session model by default. Set `--implementer-model ID` in settings to choose another, or `default` to go back.
- **Works in [pi](https://pi.dev).** The repository is also a pi package. Install it with `pi install git:github.com/Novacon/check-loop` (or a local clone path) and run the skills with `/skill:check-loop`, `/skill:research`, `/skill:execute`, and `/skill:settings`.

## Changes in 5.0.0

Reviews were slow and kept finding new problems in text the loop itself had just added. This release changes how rounds work, using ideas from other review tools:

- **Later rounds only check the fixes.** Round 1 is the full review. Later rounds confirm each fix and report only regressions in the changed text or a missed critical defect, following the fix re-review in [Superpowers](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/re-review-prompt.md). The rotating focus areas from 4.1 are gone, because they reopened text that hadn't changed.
- **Diffs instead of the whole plan.** The full plan or report is sent once; later rounds send only the diff since the last review.
- **The loop runs in code.** A new `round` command builds prompts, requests structured findings, numbers them, keeps the decision ledger, and decides when to stop. Stalls (the same blockers twice, or a fixed finding coming back) are detected the way [Plan Tango](https://github.com/egsok/plan-tango) does. Repeats are dropped, and a rejection can be disputed once, as in [Comfy's review ledger](https://github.com/Comfy-Org/github-workflows/tree/main/.github/cursor-review).
- **No cliff at the round limit.** If the limit is reached with unconfirmed fixes, you can run one confirmation-only round instead of starting over.
- **Resume.** Run state is saved after each round, so an interrupted review continues where it stopped.
- **Less noise.** One line per round and a short final report, with the full ledger in a file, as in [PGHQ second-opinion](https://github.com/PGHQdev/second-opinion).
- **`--quick`** runs a single review pass.
- **Execution** fix re-reviews send only the fix and the findings being fixed.
- **Reliability.** Reviewer turns time out and are interrupted after 20 minutes, `turn` accepts `--prompt-file`, and credential-shaped values are redacted automatically.

## Changes in 4.1.0

- Choose the reviewer model and effort, or inherit your Codex settings. Astra is no longer required.
- Set the plan and research round limit. Later rounds checked additional risks, with the review rotation inspired by [Claudex](https://github.com/promptadvisers/claudex) (replaced in 5.0.0).
- Treat missing or failed reviews as errors. The response handling draws on the [official Codex plugin's guidance](https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/skills/codex-result-handling/SKILL.md).
- Fix ignored reviewer flags, missing effort on the initial thread, and truncated prompts containing `=`.

## License

[MIT](LICENSE).
