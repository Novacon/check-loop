# CLAUDE.md

## What This Is

A Claude Code plugin (`lordknows13-check-loop`) providing adversarial plan refinement and supervised plan execution skills powered by the official OpenAI Codex App Server transport. No compiled code, no build steps, no npm dependencies.

## Architecture

```
.claude-plugin/marketplace.json   <- marketplace registration
plugins/check-loop/
  plugin.json                     <- plugin definition (auto-discovers skills via glob)
  scripts/
    codex-invoke.mjs              <- CLI wrapper: turn, review, setup subcommands
    app-server-broker.mjs         <- shared Codex app-server connection broker
    lib/
      app-server.mjs              <- JSON-RPC client (spawned + broker transports)
      codex.mjs                   <- Codex interaction (review/start, turn/start, threads)
      git.mjs                     <- git operations and review scope detection
      args.mjs                    <- argument parsing
      broker-endpoint.mjs         <- cross-platform socket endpoint config
      broker-lifecycle.mjs        <- broker session management
      process.mjs                 <- child process management
      fs.mjs                      <- file system utilities
      state.mjs                   <- persistent state management
      workspace.mjs               <- workspace root resolution
      render.mjs                  <- output formatting
      job-control.mjs             <- job status management
      tracked-jobs.mjs            <- job lifecycle tracking
      prompts.mjs                 <- template loading
  skills/
    check-loop/SKILL.md           <- adversarial refinement loop (/check-loop)
    execute/SKILL.md              <- supervised execution with Codex oversight (/check-loop:execute)
    execute/implementer-prompt.md <- subagent prompt template for implementers
    execute/spec-reviewer-prompt.md <- subagent prompt template for spec review
    execute/code-quality-reviewer-prompt.md <- subagent prompt template for quality review
```

**Skill discovery:** `plugin.json` uses `"skills": ["./skills/*"]` -- any subdirectory with a `SKILL.md` is auto-registered.

## Model Configuration

Set in `codex-invoke.mjs`:
- **Model**: `null` (uses Codex CLI default -- whatever model your session is configured for)
- **Reasoning effort**: `xhigh`

No API keys needed. Authentication is handled by the Codex CLI OAuth session (`codex login`).

## Transport Layer

Uses the **official OpenAI Codex App Server protocol** (from `openai/codex-plugin-cc`):

- **Broker connection sharing**: Reuses a single `codex app-server` process across calls via Unix sockets
- **Direct fallback**: If broker is unavailable, spawns a direct subprocess
- **Proper streaming**: Handles notifications, subagent turns, and completion detection
- **Thread management**: start, resume, naming, listing via JSON-RPC

### CLI Interface

```bash
# New thread (turn/start)
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd /path --prompt "text"

# Continue thread (turn/start with resume)
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd /path --thread-id ID --prompt "text"

# Native code review (review/start -- auto-detects git scope)
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" review --cwd /path [--scope auto|working-tree|branch] [--base REF]

# Setup check
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup [--cwd /path]
```

Returns JSON: `{"threadId": "...", "response": "..."}`

## Skills

### check-loop (Plan Refinement)

Sequential adversarial loop for plan refinement:

1. Send plan to Codex for review via `turn` subcommand
2. Analyze feedback -- accept valid points, fight back on overkill/incorrect ones
3. Update plan, send back via `turn` continuing the same thread
4. Repeat until Codex responds with "PLAN APPROVED" or max rounds (40) reached

### execute (Supervised Execution)

Continuous plan execution with Codex reviewing each step:

1. Lock the plan as read-only, capture git baseline
2. For each step: implement via subagent, run validation gates (tests/tsc/lint), send diff to Codex via `turn`
3. Commits each step as it completes -- no stopping between steps
4. After all steps: uses `review` subcommand (native code review) or `turn` for full verification
5. Presents complete summary and waits for user approval before pushing
6. Severity-tagged concerns: [minor] auto-resolve after 3 rounds, [critical] always escalate to user

## Versioning

Version must be updated in three places and kept in sync:

1. `.claude-plugin/marketplace.json` -> `metadata.version`
2. `.claude-plugin/marketplace.json` -> `plugins[0].version`
3. `plugins/check-loop/plugin.json` -> `version`

Current version: **3.1.0**
