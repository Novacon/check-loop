# check-loop

check-loop is a Claude Code plugin that asks Codex to review a plan before you build it, check a research draft, or review code as you work through an approved plan.

Fable runs the workflow and checks the review findings. Opus implements each step in a fresh subagent. Codex reviews the work using your chosen model and reasoning effort, or your existing Codex defaults.

A review finding needs evidence before it can block progress. Fable checks the cited source instead of accepting a concern just because another model raised it.

Current version: 4.1.0.

## Install

You need Claude Code 2.1.257 or later, Node.js 18 or later, and an authenticated Codex CLI. The skills use Claude Code's `fable` and `opus` model aliases, so your account must have access to them.

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

The skills select Fable for the session turn. If your host does not apply that selection, start the session with `claude --model fable`.

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
```

Fable reads the plan and relevant repository files, then sends the plan to Codex. It checks each finding, revises the plan where the evidence supports a change, and asks Codex to review again.

The loop stops when no verified blocking concern remains. It runs for up to six rounds by default. If a blocker remains at the limit, it stops and asks you what to do. The result includes the changes, rejected findings, unresolved questions, and a diff of the plan.

### Research a question

```text
/check-loop:research "Compare SQLite and PostgreSQL for this offline-first application"
```

Fable gathers sources and writes a draft. Codex checks the facts, sources, gaps, and conclusions. Fable verifies the findings and revises the draft through the same review loop.

You get one Markdown report with sources, remaining questions, and a record of the review. This command does not implement code or write an implementation plan.

### Execute a plan

```text
/check-loop:execute path/to/plan.md
```

Fable records the approved plan and the repository's starting state. For each step, it gives a fresh Opus subagent a bounded task, runs the project's checks, and sends the relevant diff and results to Codex.

If Fable verifies a blocking finding, a fresh Opus subagent fixes it. Execution stops after three unsuccessful fix cycles. Fable runs final checks and requests a final Codex review before handing the work back to you.

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

Ask for user-wide settings or project-only settings. These choices affect Codex, not Fable or Opus. The round limit applies to plans and research. It does not change execution's three-fix limit.

Each plan or research run keeps the round limit it started with. Reviews stop early when no verified blocker remains. Later rounds add emphasis on security, data integrity, and recovery without skipping other relevant risks.

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

Only verified critical or important findings can block progress. Fable checks the citation and records whether it accepts, rejects, or counters the finding. Minor findings, inferences, and unanswered questions remain in the report without blocking the work.

The reviewer runs in a read-only sandbox. The workflows require secret filtering before sending prompts or diffs to Codex. A failed, empty, or malformed response stops the workflow. It does not count as approval.

## Check your setup

From the repository root:

```bash
node plugins/check-loop/scripts/codex-invoke.mjs setup
```

`Status: ready` means the Codex CLI is installed and authenticated. It does not confirm access to a particular model. The first review checks the effective model and effort. Unsupported choices and explicit setting mismatches fail instead of silently selecting a different reviewer.

## Local development

```bash
git clone https://github.com/Novacon/check-loop.git
claude --model fable --plugin-dir ./check-loop/plugins/check-loop
```

When working in another project, pass the absolute path to the clone's `plugins/check-loop` directory. Keep the whole plugin directory together. The skills need the scripts alongside them.

The skills live in `plugins/check-loop/skills/`. `scripts/codex-invoke.mjs` handles settings and talks to the Codex App Server over JSON-RPC. It reuses a broker connection and your local Codex login. The plugin has no runtime npm dependencies and needs no separate API key when you use Codex login.

### Call the reviewer directly

```bash
# Start a review thread.
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" --prompt "Review this plan: ..."

# Continue the same thread.
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" --thread-id THREAD_ID --prompt "Review the revised plan: ..."
```

Results include `threadId`, `response`, `model`, `effort`, `status`, and `error`. A status of `0` means the call succeeded, not that the reviewer approved the work. A status of `1` signals a failure.

Successful turns report their effective model and effort. The skills retain those settings for later rounds. Native review can use a separate Codex `review_model`. If you did not request a model explicitly, native review reports `model: null` rather than guessing which model ran.

### Run the checks

```bash
node --test tests/orchestration-contract.test.mjs
claude plugin validate ./plugins/check-loop
claude plugin validate ./.claude-plugin/marketplace.json
```

The tests cover settings precedence, persistence, invalid configuration, reviewer setting mismatches, and failed or empty responses. They do not need model access. For a live check, use an authenticated Codex CLI and a disposable repository to exercise a new turn, a resumed turn, and native review.

## Changes in 4.1.0

- Choose the reviewer model and effort, or inherit your Codex settings. Astra is no longer required.
- Set the plan and research round limit. Later rounds check additional risks, with the review rotation inspired by [Claudex](https://github.com/promptadvisers/claudex). Check-loop keeps its independent evidence checks and read-only reviewer.
- Treat missing or failed reviews as errors. The response handling draws on the [official Codex plugin's guidance](https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/skills/codex-result-handling/SKILL.md).
- Fix ignored reviewer flags, missing effort on the initial thread, and truncated prompts containing `=`.

## License

[MIT](LICENSE).
