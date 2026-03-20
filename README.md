# claude-check-loop

Adversarial plan refinement loop for Claude Code. Automates the cycle of sending your plan to Codex for review, defending or updating it, and repeating until both models reach consensus.

## What It Does

When you invoke `/co-refine`, it:

1. Reads your plan file
2. Sends it to Codex with instructions to perform a critical review
3. Analyzes each piece of Codex's feedback — accepts what's valid, fights back on what's overkill or wrong
4. Updates the plan and sends it back to Codex
5. Repeats until both models agree (or max 20 rounds)
6. Presents a summary of what changed, what was defended, and any unresolved disagreements

No more manually copying plans between Claude and Codex.

## Prerequisites

You need the Codex MCP server configured. If you already use [claude-co-commands](https://github.com/SnakeO/claude-co-commands), you're all set.

If not, add it:

```bash
claude mcp add validate-plans-and-brainstorm-ideas -- npx -y @openai/codex mcp-server
```

This requires an OpenAI API key configured for Codex.

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

```
/co-refine path/to/your/plan.md
```

Or just `/co-refine` if you have an active plan in your session — it will try to auto-detect it.

### Example Output

```
Starting adversarial refinement loop. Sending plan to Codex for review...

Round 1: Codex raised 4 concerns.
  - Accepted: 2 (F1, F3)
  - Rejected: 1 (F2)
  - Countered: 1 (F4)
Updating plan and sending back to Codex...

Round 2: Codex raised 1 new concern, accepted pushback on F2.
  - Accepted: 1 (F5)
  - Rejected: 0
  - Countered: 0
Updating plan and sending back to Codex...

Round 3: PLAN APPROVED — No remaining concerns.

## Refinement Complete
**Rounds**: 3 of 7 max
**Status**: Consensus reached
...
```

## How It Works

Unlike `/co-validate` (which does one-shot parallel review), `/co-refine` runs a sequential adversarial loop:

- **Claude** is the plan author and defender
- **Codex** is the adversarial reviewer
- Each round, Claude genuinely evaluates feedback — accepts valid points, pushes back on overkill
- The loop continues until Codex has no remaining concerns or the round limit is hit

The goal isn't unanimous agreement at any cost — it's a genuinely better plan through honest debate.

## License

MIT
