# CLAUDE.md

## Repository

Claude Code plugin `lordknows13-check-loop`. It provides adversarial plan refinement and supervised execution over the official Codex App Server transport. No compiled code or runtime npm dependencies.

## Architecture

```text
.claude-plugin/marketplace.json
plugins/check-loop/
  plugin.json
  scripts/
    codex-invoke.mjs
    app-server-broker.mjs
    lib/
  skills/
    check-loop/SKILL.md
    research/SKILL.md
    execute/SKILL.md
    execute/implementer-prompt.md
```

`plugin.json` discovers skills through `./skills/*`. Preserve the public skill names `check-loop`, `research`, and `execute`.

## Model contract

- Fable at `xhigh` owns plan refinement, research, execution orchestration, repository validation, and review adjudication.
- Fresh Opus subagents implement bounded steps and accepted fixes.
- GPT-5.6 Sol at `xhigh` is the adversarial reviewer.

`plugins/check-loop/scripts/codex-invoke.mjs` pins:

```text
Model: gpt-5.6-sol
Reasoning effort: xhigh
```

Every Sol path is read-only. `turn/start` receives `model` and `effort`; native `review/start` inherits both from its `thread/start` configuration.

## Review policy

Every concern must contain a severity, evidence status, claim, exact evidence, impact, failure condition, and recommended correction.

Evidence statuses:

- `VERIFIED`: the cited source directly supports the claim.
- `INFERENCE`: cited facts support an unreproduced conclusion.
- `UNVERIFIED`: evidence is missing or inaccessible.

Only independently checked `VERIFIED` critical or important findings may block. Fable records `ACCEPT`, `REJECT`, or `COUNTER`. Reviewer agreement, confidence, severity, and repetition are not evidence.

## Skills

### `check-loop`

Fable owns the plan and debates GPT-5.6 Sol in one persistent thread. Fable independently checks cited plan text, repository locations, and command output before changing the plan. Refinement ends when Sol approves, no verified blocker remains after adjudication, or 40 rounds complete.

### `research`

Fable researches the user's question and writes one Markdown report with current primary-source citations, explicit inferences, counterevidence, and unresolved gaps. GPT-5.6 Sol reviews the completed draft in one persistent thread. Fable independently checks every source before revising. The skill produces no code or implementation plan.

### `execute`

1. Fable locks the approved plan and records the working-tree state.
2. Existing changes require worktree isolation or explicit user inclusion.
3. A fresh Opus subagent implements one bounded step without staging or committing.
4. Fable inspects the changes and runs repository-native validation.
5. Sol reviews the step-scoped, secret-filtered diff and observed validation.
6. Fable independently verifies and adjudicates every finding.
7. A fresh Opus fixer handles only accepted or countered blocking findings.
8. Final repository verification and native Sol review run before user approval.

Never hide, discard, stage, commit, or push user work automatically. Commit and push require explicit user approval.

## Transport

```bash
# New review thread
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd /path --prompt "text"

# Continue a review thread
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd /path --thread-id ID --prompt "text"

# Native review
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" review --cwd /path [--scope auto|working-tree|branch] [--base REF]

# Authentication and model preflight
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup [--cwd /path]
```

The transport uses JSON-RPC over the Codex App Server protocol, broker reuse with direct fallback, streaming notifications, and the local Codex OAuth session.

## Validation

```bash
node --test tests/orchestration-contract.test.mjs
claude plugin validate ./plugins/check-loop
claude plugin validate ./.claude-plugin/marketplace.json
```

Also syntax-check changed `.mjs` files and run `git diff --check`.

## Versioning

Keep these values synchronized:

1. `.claude-plugin/marketplace.json` → `metadata.version`
2. `.claude-plugin/marketplace.json` → `plugins[0].version`
3. `plugins/check-loop/plugin.json` → `version`

Current version: **4.0.0**
