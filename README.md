# claude-check-loop

Adversarial plan refinement and supervised execution for Claude Code. Uses Codex as a real-time reviewer to battle-test plans and oversee implementation.

## Skills

### `/check-loop` — Plan Refinement

Automates the cycle of sending your plan to Codex for review, defending or updating it, and repeating until both models reach consensus.

1. Reads your plan file
2. Sends it to Codex (gpt-5.4, xhigh reasoning) with instructions to perform a critical review
3. Analyzes each piece of Codex's feedback — accepts what's valid, fights back on what's overkill or wrong
4. Updates the plan and sends it back to Codex
5. Repeats until both models agree (or max 40 rounds)
6. Presents a summary of what changed, what was defended, and any unresolved disagreements

### `/check-loop:execute` — Supervised Execution

Executes an approved plan continuously with Codex reviewing each step against the locked plan. Designed to run after `/check-loop` has refined a plan, or on any plan you want to execute with review guardrails.

1. Locks the plan as read-only and captures a git baseline
2. Executes all steps continuously — no stopping between steps
3. For each step: implements the code, runs validation gates (tests, TypeScript, lint), sends the diff to Codex for review
4. Codex reviews against both the plan and desloppify code quality standards (thin routes, Result<T>, standardized errors, tests)
5. After all steps: a fresh Codex session verifies the full diff against the original plan + desloppify standards
6. Presents a complete summary and waits for user approval before pushing

**Features:**
- **Continuous execution**: Runs through all steps without stopping — only pauses at the end for approval
- **Desloppify enforcement**: Codex reviews code against project quality standards (thin routes, business logic in lib/, Result<T> returns, outer try/catch, tests for new modules)
- **Validation gates**: Tests, TypeScript, lint run after each step before Codex review
- **Severity tagging**: [minor] concerns auto-resolve after 3 rounds; [critical] (including desloppify violations) always escalate to user
- **Secret filtering**: `.env`, credentials, and secrets are never sent to Codex
- **Stash safety**: Dirty working trees are stashed and restored with conflict handling
- **Final approval gate**: All commits stay local until user explicitly approves the push

## Prerequisites

### 1. Node.js

The Codex MCP server runs via `npx`, so you need Node.js installed (v18+).

### 2. Codex CLI Login

Authenticate with your OpenAI account (no API key required):

```bash
npx -y @openai/codex login
```

This opens your browser — sign in to your OpenAI/ChatGPT account and authorize. Your session is stored locally at `~/.codex/auth.json` and the MCP server picks it up automatically.

For headless/remote machines (no browser):

```bash
npx -y @openai/codex login --device-auth
```

To verify you're logged in:

```bash
npx -y @openai/codex login status
```

### 3. Codex MCP Server

Connect the Codex MCP server to Claude Code:

**Option A: CLI (Recommended)**

```bash
claude mcp add codex-cli -- npx -y codex-mcp-server
```

**Option B: Manual config**

Add this to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "npx",
      "args": ["-y", "codex-mcp-server"]
    }
  }
}
```

> **Note:** The server name must be `codex-cli`. The skills reference MCP tools as `mcp__codex-cli__codex`.

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
```

### Option 3: Manual

Copy the contents of `plugins/check-loop/skills/` into `~/.claude/skills/`.

## Usage

### Plan Refinement

```
/check-loop path/to/your/plan.md
```

Or just `/check-loop` if you have an active plan in your session — it will try to auto-detect it.

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

Round 3: PLAN APPROVED — No remaining concerns.

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

Executing all steps continuously...

Step 1 of 3: Add database migration
  Validation: tests pass | tsc pass
  Codex review: STEP APPROVED
  Step 1: COMPLETE [Approved]

Step 2 of 3: Create lib module
  Validation: tests pass | tsc pass
  Codex review: 1 concern raised
    C1 [critical]: ACCEPTED — fixed missing null check
  Step 2: COMPLETE [Approved with fixes]

Step 3 of 3: Add API endpoint
  Validation: tests pass | tsc pass
  Codex review: STEP APPROVED
  Step 3: COMPLETE [Approved]

Verification: VERIFIED -- All changes align with the plan.

## Execution Complete -- Awaiting Approval

**Steps**: 3/3 completed
**Verification**: VERIFIED

Push these commits to remote? (y/n)
```

## How It Works

- **Claude** is the plan author, defender, and executor
- **Codex** (gpt-5.4, xhigh reasoning) is the adversarial reviewer and implementation supervisor
- Codex enforces both plan alignment and desloppify code quality standards
- The goal isn't unanimous agreement at any cost — it's a genuinely better plan and correct implementation through honest debate

## License

MIT
