# CLAUDE.md

## What This Is

A Claude Code plugin (`lordknows13-check-loop`) providing adversarial plan refinement and supervised plan execution skills that use OpenAI's Codex MCP server. No compiled code, no build steps -- purely Markdown skill definitions and JSON config.

## Architecture

```
.claude-plugin/marketplace.json   <- marketplace registration
plugins/check-loop/
  plugin.json                     <- plugin definition (auto-discovers skills via glob)
  skills/
    check-loop/SKILL.md           <- adversarial refinement loop (/check-loop)
    execute/SKILL.md              <- supervised execution with Codex oversight (/check-loop:execute)
```

**Skill discovery:** `plugin.json` uses `"skills": ["./skills/*"]` -- any subdirectory with a `SKILL.md` is auto-registered.

**SKILL.md format:** YAML frontmatter (`name`, `description`) followed by Markdown instructions that Claude Code follows when the skill is invoked.

## Skills

### check-loop (Plan Refinement)

Sequential adversarial loop for plan refinement:

1. Send plan to Codex for review via `mcp__codex-cli__codex`
2. Analyze feedback -- accept valid points, fight back on overkill/incorrect ones
3. Update plan, send back via `mcp__codex-cli__codex` with `sessionId`
4. Repeat until Codex responds with "PLAN APPROVED" or max rounds (20) reached

### execute (Supervised Execution)

Continuous plan execution with Codex reviewing each step:

1. Lock the plan as read-only, capture git baseline
2. For each step: implement, run validation gates (tests/tsc/lint), send diff to Codex for review
3. Commits each step as it completes -- no stopping between steps
4. After all steps: fresh Codex session does full verification of all changes against original plan
5. Presents complete summary and waits for user approval before pushing
6. Severity-tagged concerns: [minor] auto-resolve after 3 rounds, [critical] always escalate to user

## MCP Integration

Uses the `codex-cli` MCP server (`@openai/codex mcp-server`):

- `mcp__codex-cli__codex` -- start a new session or continue via `sessionId`
- Always uses `model: gpt-5.4` and `reasoningEffort: xhigh`

## Versioning

Version must be updated in three places and kept in sync:

1. `.claude-plugin/marketplace.json` -> `metadata.version`
2. `.claude-plugin/marketplace.json` -> `plugins[0].version`
3. `plugins/check-loop/plugin.json` -> `version`

Current version: **1.2.0**
