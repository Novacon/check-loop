# CLAUDE.md

## What This Is

A Claude Code plugin (`lordknows13-check-loop`) providing an adversarial plan refinement skill that uses OpenAI's Codex MCP server as an iterative reviewer. No compiled code, no build steps — purely Markdown skill definitions and JSON config.

## Architecture

```
.claude-plugin/marketplace.json   <- marketplace registration
plugins/check-loop/
  plugin.json                     <- plugin definition (auto-discovers skills via glob)
  skills/
    co-refine/SKILL.md            <- adversarial refinement loop
```

**Skill discovery:** `plugin.json` uses `"skills": ["./skills/*"]` — any subdirectory with a `SKILL.md` is auto-registered.

**SKILL.md format:** YAML frontmatter (`name`, `description`) followed by Markdown instructions that Claude Code follows when the skill is invoked.

## Core Design Pattern: Adversarial Convergence Loop

Unlike the anti-bias pattern in co-commands (parallel independent work, then compare), this plugin uses a sequential adversarial loop:

1. Send plan to Codex for review via `mcp__validate-plans-and-brainstorm-ideas__codex`
2. Analyze feedback — accept valid points, fight back on overkill/incorrect ones
3. Update plan, send back via `mcp__validate-plans-and-brainstorm-ideas__codex-reply`
4. Repeat until Codex responds with "PLAN APPROVED" or max rounds (7) reached

## MCP Integration

Uses the same two MCP tools from the `validate-plans-and-brainstorm-ideas` server (wraps `@openai/codex mcp-server`):

- `mcp__validate-plans-and-brainstorm-ideas__codex` — start a new session
- `mcp__validate-plans-and-brainstorm-ideas__codex-reply` — continue via `threadId`

## Versioning

Version must be updated in three places and kept in sync:

1. `.claude-plugin/marketplace.json` -> `metadata.version`
2. `.claude-plugin/marketplace.json` -> `plugins[0].version`
3. `plugins/check-loop/plugin.json` -> `version`

Current version: **1.0.0**
