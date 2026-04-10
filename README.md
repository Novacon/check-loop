```
 ▄███▄   ██   ██  ██████   ▄███▄   ██  ▄█  ██       ▄███▄    ▄███▄   █████▄
██   ▀▀  ██   ██  ██      ██   ▀▀  ██▄█▀   ██      ██   ██  ██   ██  ██  ▐██
██       ███████  █████   ██       ████    ██      ██   ██  ██   ██  █████▀
██   ▄▄  ██   ██  ██      ██   ▄▄  ██▀█▄   ██      ██   ██  ██   ██  ██
 ▀███▀   ██   ██  ██████   ▀███▀   ██  ▀█  ██████   ▀███▀    ▀███▀   ██
```

# claude-check-loop

Adversarial plan refinement and supervised execution for Claude Code. Uses OpenAI Codex CLI (xhigh reasoning) as a real-time reviewer to battle-test plans and oversee implementation.

## Skills

### `/check-loop` -- Plan Refinement

Automates the cycle of sending your plan to Codex for review, defending or updating it, and repeating until both models reach consensus.

1. Reads your plan file
2. Sends it to Codex via the official App Server transport (broker connection sharing, proper streaming)
3. Analyzes each piece of Codex's feedback -- accepts what's valid, fights back on what's overkill or wrong
4. Updates the plan and sends it back to Codex
5. Repeats until both models agree (or max 40 rounds)
6. Presents a summary of what changed, what was defended, and any unresolved disagreements

### `/check-loop:execute` -- Supervised Execution with Subagent Implementation

Executes an approved plan continuously using fresh subagents per step, with three review layers before committing. Designed to run after `/check-loop` has refined a plan, or on any plan you want to execute with review guardrails.

1. Locks the plan as read-only and captures a git baseline
2. For each step: dispatches a fresh implementer subagent (opus by default, sonnet for pure frontend presentation tasks)
3. Runs validation gates (tests, TypeScript, lint) on the subagent's work
4. Dispatches a spec compliance reviewer subagent to verify the implementation matches requirements -- nothing more, nothing less
5. Dispatches a code quality reviewer subagent to check desloppify standards and general quality
6. Sends the diff to Codex for final review against the plan
7. After all steps: native Codex code review or custom verification prompt verifies the full diff
8. Presents a complete summary and waits for user approval before pushing

**Features:**
- **Official OpenAI transport**: Uses the same transport layer as the official Codex plugin -- broker connection sharing, streaming notifications, proper thread management
- **Codex CLI auth**: Uses your Codex CLI session directly -- no API keys, no config drift
- **Subagent implementation**: Fresh implementer subagent per step with isolated context -- no confusion from prior steps, no context pollution
- **Three review layers**: Spec compliance (subagent) -> code quality (subagent) -> Codex (external). Each catches different classes of issues.
- **Native code review**: Final verification can use Codex's built-in `review/start` which auto-collects git context efficiently
- **Continuous execution**: Runs through all steps without stopping -- only pauses at the end for approval
- **Desloppify enforcement**: Code quality reviewer and Codex both enforce project standards (thin routes, business logic in lib/, Result<T> returns, outer try/catch, tests for new modules)
- **Implementer escalation**: Subagents can report DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED -- blocked steps get re-dispatched with more context or a more capable model before escalating to user
- **Validation gates**: Tests, TypeScript, lint run after each step before reviews begin
- **Severity tagging**: [minor] concerns auto-resolve after 3 rounds; [critical] always escalate to user
- **Secret filtering**: `.env`, credentials, and secrets are never sent to Codex
- **Stash safety**: Dirty working trees are stashed and restored with conflict handling
- **Final approval gate**: All commits stay local until user explicitly approves the push
- **Superpowers-aware**: Automatically ignores superpowers framework directives in plans so Codex reviews only the actual implementation steps

## Prerequisites

### 1. Node.js

The transport layer requires Node.js v18+.

### 2. Codex CLI

Install and authenticate with the Codex CLI:

```bash
npm install -g @openai/codex
codex login
```

This opens your browser -- sign in to your OpenAI/ChatGPT account and authorize. Your session is stored locally at `~/.codex/auth.json`.

For headless/remote machines (no browser):

```bash
codex login --device-auth
```

To verify everything is ready:

```
/check-loop:setup
```

Or from the command line:

```bash
node scripts/codex-invoke.mjs setup
```

## Installation

### Option 1: Plugin Marketplace (Recommended)

```bash
/plugin marketplace add lordknows13/claude-check-loop
/plugin install check-loop@lordknows13-check-loop
```

### Option 2: Git Clone

```bash
git clone https://github.com/lordknows13/claude-check-loop.git
cp -r claude-check-loop/plugins/check-loop/skills/* ~/.claude/skills/
cp -r claude-check-loop/plugins/check-loop/scripts/* ~/.claude/scripts/
```

### Option 3: Manual

Copy the contents of `plugins/check-loop/skills/` and `plugins/check-loop/scripts/` into your Claude Code config.

## Usage

### Plan Refinement

```
/check-loop path/to/your/plan.md
```

Or just `/check-loop` if you have an active plan in your session -- it will try to auto-detect it.

### Supervised Execution

```
/check-loop:execute path/to/your/plan.md
```

Typical workflow:

```
/check-loop plans/my-feature.md          # Refine the plan with Codex
/check-loop:execute plans/my-feature.md  # Execute with Codex oversight
```

### Example Output (Plan Refinement)

```
Starting adversarial refinement loop. Sending plan to Codex for review...

Round 1: Codex raised 4 concerns.
  - Accepted: 2 (F1, F3)
  - Rejected: 1 (F2)
  - Countered: 1 (F4)
Updating plan and sending back to Codex...

Round 2: Codex raised 1 new concern, accepted pushback on F2.
  - Accepted: 1 (F5)
Updating plan and sending back to Codex...

Round 3: PLAN APPROVED -- No remaining concerns.

## Refinement Complete
**Rounds**: 3 of 40 max
**Status**: Consensus reached
...
```

### Example Output (Supervised Execution)

```
--- check-loop:execute ---

Plan: plans/my-feature.md (locked)
Baseline: abc1234
Steps: 3 identified

1. Add database migration (opus)
2. Create lib module (opus)
3. Update button styles (sonnet)

Executing all steps continuously...

Step 1 of 3: Add database migration (model: opus)
  Implementer: DONE
  Validation: tests pass | tsc pass
  Spec review: SPEC_COMPLIANT
  Quality review: QUALITY_APPROVED
  Codex review: STEP APPROVED
  Step 1: COMPLETE [Approved]

Step 2 of 3: Create lib module (model: opus)
  Implementer: DONE_WITH_CONCERNS (noted large existing file)
  Validation: tests pass | tsc pass
  Spec review: SPEC_ISSUES -- missing error case
    Fix subagent dispatched, re-review: SPEC_COMPLIANT
  Quality review: QUALITY_APPROVED
  Codex review: STEP APPROVED
  Step 2: COMPLETE [Approved with fixes]

Step 3 of 3: Update button styles (model: sonnet)
  Implementer: DONE
  Validation: tests pass | tsc pass
  Spec review: SPEC_COMPLIANT
  Quality review: QUALITY_APPROVED
  Codex review: STEP APPROVED
  Step 3: COMPLETE [Approved]

Verification: VERIFIED -- All changes align with the plan.

## Execution Complete -- Awaiting Approval

**Steps**: 3/3 completed
**Reviews**: 3 spec + 3 quality + 3 Codex + 1 verification
**Verification**: VERIFIED

Push these commits to remote? (y/n)
```

## Architecture

```
plugins/check-loop/
  scripts/
    codex-invoke.mjs              # CLI: turn, review, setup subcommands
    app-server-broker.mjs         # Shared Codex app-server connection broker
    lib/
      app-server.mjs              # JSON-RPC client (broker + direct transports)
      codex.mjs                   # Codex interaction (review/start, turn/start)
      git.mjs                     # Git operations and review scope detection
      broker-lifecycle.mjs        # Broker session management
      broker-endpoint.mjs         # Cross-platform socket config
      args.mjs                    # Argument parsing
      process.mjs                 # Child process management
      fs.mjs                      # File system utilities
      state.mjs                   # Persistent state management
      workspace.mjs               # Workspace root resolution
      render.mjs                  # Output formatting
      job-control.mjs             # Job status management
      tracked-jobs.mjs            # Job lifecycle tracking
      prompts.mjs                 # Template loading
  skills/
    check-loop/SKILL.md           # Adversarial refinement loop
    execute/SKILL.md              # Supervised execution with Codex oversight
    execute/implementer-prompt.md
    execute/spec-reviewer-prompt.md
    execute/code-quality-reviewer-prompt.md
```

The transport layer uses the official OpenAI Codex App Server protocol -- JSON-RPC over stdio with broker connection sharing. No MCP server, no npm dependencies at runtime. Uses your Codex CLI session directly with xhigh reasoning effort.

## How It Works

- **Claude** is the plan author, defender, and orchestrator
- **Claude subagents** (opus/sonnet) handle implementation and two-stage review (spec compliance + code quality) with fresh context per step
- **Codex** (xhigh reasoning) is the adversarial reviewer providing final per-step and full-diff verification
- The goal isn't unanimous agreement at any cost -- it's a genuinely better plan and correct implementation through honest debate and layered review

## License

MIT
