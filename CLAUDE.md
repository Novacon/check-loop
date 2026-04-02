# CLAUDE.md

## What This Is

A Claude Code plugin (`lordknows13-check-loop`) providing adversarial plan refinement and supervised plan execution skills powered by OpenAI's Codex App Server protocol. No compiled code, no build steps, no npm dependencies -- Node.js scripts and Markdown skill definitions.

## Architecture

```
.claude-plugin/marketplace.json   <- marketplace registration
plugins/check-loop/
  plugin.json                     <- plugin definition (auto-discovers skills via glob)
  scripts/
    codex-invoke.mjs              <- transport layer: JSON-RPC client to codex app-server
  skills/
    check-loop/SKILL.md           <- adversarial refinement loop (/check-loop)
    execute/SKILL.md              <- supervised execution with Codex oversight (/check-loop:execute)
    execute/implementer-prompt.md <- subagent prompt template for implementers
    execute/spec-reviewer-prompt.md <- subagent prompt template for spec review
    execute/code-quality-reviewer-prompt.md <- subagent prompt template for quality review
```

**Skill discovery:** `plugin.json` uses `"skills": ["./skills/*"]` -- any subdirectory with a `SKILL.md` is auto-registered.

**SKILL.md format:** YAML frontmatter (`name`, `description`) followed by Markdown instructions that Claude Code follows when the skill is invoked.

## Skills

### check-loop (Plan Refinement)

Sequential adversarial loop for plan refinement:

1. Send plan to Codex for review via `codex-invoke.mjs`
2. Analyze feedback -- accept valid points, fight back on overkill/incorrect ones
3. Update plan, send back via `codex-invoke.mjs` continuing the same thread
4. Repeat until Codex responds with "PLAN APPROVED" or max rounds (40) reached

### execute (Supervised Execution)

Continuous plan execution with Codex reviewing each step:

1. Lock the plan as read-only, capture git baseline
2. For each step: implement via subagent, run validation gates (tests/tsc/lint), send diff to Codex for review
3. Commits each step as it completes -- no stopping between steps
4. After all steps: fresh Codex thread does full verification of all changes against original plan
5. Presents complete summary and waits for user approval before pushing
6. Severity-tagged concerns: [minor] auto-resolve after 3 rounds, [critical] always escalate to user

## Codex Transport

Uses the **Codex App Server protocol** -- a JSON-RPC connection over stdio to `codex app-server`:

- `codex-invoke.mjs` -- start a new thread or continue via `--thread-id`
- Model and reasoning effort come from `~/.codex/config.toml` (no hardcoded defaults)
- Zero npm dependencies -- uses only Node.js builtins

### Usage

```bash
# New thread
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd /path --prompt "text"

# Continue thread
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd /path --thread-id ID --prompt "text"
```

Returns JSON: `{"threadId": "...", "response": "..."}`

## Versioning

Version must be updated in three places and kept in sync:

1. `.claude-plugin/marketplace.json` -> `metadata.version`
2. `.claude-plugin/marketplace.json` -> `plugins[0].version`
3. `plugins/check-loop/plugin.json` -> `version`

Current version: **2.0.0**
