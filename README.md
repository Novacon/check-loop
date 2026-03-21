# claude-check-loop

Adversarial plan refinement and supervised execution for Claude Code. Uses Codex as a real-time reviewer to battle-test plans and oversee implementation.

## Skills

### `/check-loop` — Plan Refinement

Automates the cycle of sending your plan to Codex for review, defending or updating it, and repeating until both models reach consensus.

1. Reads your plan file
2. Sends it to Codex with instructions to perform a critical review
3. Analyzes each piece of Codex's feedback — accepts what's valid, fights back on what's overkill or wrong
4. Updates the plan and sends it back to Codex
5. Repeats until both models agree (or max 20 rounds)
6. Presents a summary of what changed, what was defended, and any unresolved disagreements

### `/check-loop:execute` — Supervised Execution

Executes an approved plan step-by-step with Codex reviewing each step against the locked plan. Designed to run after `/check-loop` has refined a plan, or on any plan you want to execute with review guardrails.

1. Locks the plan as read-only and captures a git baseline
2. For each step: implements the code, runs validation gates (tests, TypeScript, lint), sends the diff to Codex for review
3. User can steer between steps — deviations from the locked plan are tracked and passed to verification
4. After all steps: a fresh Codex session verifies the full diff against the original plan
5. Presents a summary of steps completed, fixes applied, and any unresolved disagreements

**Features:**
- **Steering**: User can inject constraints between steps without restarting
- **Validation gates**: Tests, TypeScript, lint run after each step before Codex review
- **Severity tagging**: [minor] concerns auto-resolve after 3 rounds; [critical] always escalate to user
- **Secret filtering**: `.env`, credentials, and secrets are never sent to Codex
- **Watchdog**: 120s timeout on Codex calls with retry-then-ask-user fallback
- **Stash safety**: Dirty working trees are stashed and restored with conflict handling

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

If you already use [claude-co-commands](https://github.com/SnakeO/claude-co-commands), you're all set — skip this step.

Otherwise, connect the Codex MCP server to Claude Code. Pick one method:

**Option A: CLI (Recommended)**

```bash
claude mcp add validate-plans-and-brainstorm-ideas -- npx -y @openai/codex mcp-server
```

**Option B: Manual config**

Add this to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "validate-plans-and-brainstorm-ideas": {
      "command": "npx",
      "args": ["-y", "@openai/codex", "mcp-server"]
    }
  }
}
```

> **Note:** The server name must be exactly `validate-plans-and-brainstorm-ideas`. The skills reference this name when calling MCP tools.

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
**Rounds**: 3 of 20 max
**Status**: Consensus reached
...
```

### Example Output (Supervised Execution)

```
═══ check-loop:execute ═══

Plan: plans/my-feature.md (locked)
Baseline: abc1234
Steps: 3 identified

Step 1 of 3: Add database migration
  Any steering? (Enter to skip)
  Implementing...
  Validation: tests ✓ | tsc ✓
  Codex review: STEP APPROVED
  ✓ Step 1 complete

Step 2 of 3: Create lib module
  Any steering? (Enter to skip)
  > User: "use the existing Result<T> pattern"
  Implementing with steering applied...
  Validation: tests ✓ | tsc ✓
  Codex review: 1 concern raised
    C1 [critical]: ACCEPTED — fixed missing null check
  ✓ Step 2 complete (1 fix applied)

Step 3 of 3: Add API endpoint
  Any steering? (Enter to skip)
  Implementing...
  Validation: tests ✓ | tsc ✓
  Codex review: STEP APPROVED
  ✓ Step 3 complete

Verification: VERIFIED — All changes align with the plan.

## Execution Complete
**Steps**: 3/3 completed
**Status**: VERIFIED
```

## How It Works

- **Claude** is the plan author, defender, and executor
- **Codex** is the adversarial reviewer (plan refinement) and implementation supervisor (execution)
- The goal isn't unanimous agreement at any cost — it's a genuinely better plan and correct implementation through honest debate

## License

MIT
