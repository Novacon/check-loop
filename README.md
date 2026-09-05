```
 ▄███▄   ██   ██  ██████   ▄███▄   ██  ▄█  ██       ▄███▄    ▄███▄   █████▄
██   ▀▀  ██   ██  ██      ██   ▀▀  ██▄█▀   ██      ██   ██  ██   ██  ██  ▐██
██       ███████  █████   ██       ████    ██      ██   ██  ██   ██  █████▀
██   ▄▄  ██   ██  ██      ██   ▄▄  ██▀█▄   ██      ██   ██  ██   ██  ██
 ▀███▀   ██   ██  ██████   ▀███▀   ██  ▀█  ██████   ▀███▀    ▀███▀   ██
```

# claude-check-loop

Version 4.0.0 provides adversarial plan refinement, peer-reviewed research, and supervised plan execution for Claude Code.

The fixed model contract is:

- **Fable** owns plans, research, orchestration, validation, and review decisions.
- A fresh **Opus** subagent implements each bounded step or accepted fix.
- **GPT-5.6 Sol** reviews plans, completed research drafts, every implementation step, and the final working-tree diff at `xhigh` reasoning effort.

## Why the evidence gate exists

Multiple reviewers can agree on an invented fact. Agreement and confidence are not proof.

**No evidence, no blocking finding.**

Every plan, research, and step concern must identify its evidence and status:

```text
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:
```

- `VERIFIED`: the cited source directly supports the claim.
- `INFERENCE`: cited facts support a conclusion that has not been reproduced.
- `UNVERIFIED`: evidence is missing or inaccessible.

Only verified critical or important findings may block. Fable independently verifies every citation before accepting, rejecting, or countering a concern. Inferences, unverified claims, and minor findings remain nonblocking.

## Skills

### `/check-loop` — plan refinement

Fable and Sol challenge an implementation plan for up to 40 rounds:

1. Fable reads the complete plan, original request, and relevant repository context.
2. Sol reviews the plan using the evidence contract.
3. Fable checks every cited source and records `ACCEPT`, `REJECT`, or `COUNTER`.
4. Fable updates the plan only for verified accepted or countered findings.
5. The loop ends at `PLAN APPROVED -- No remaining concerns.` or the round limit.

The result includes verified changes, defended decisions, unresolved verified disagreements, unverified questions, and an original-to-final diff.

### `/check-loop:research` — peer-reviewed research

Fable researches the requested question and writes one final Markdown report:

1. Fable gathers current evidence, preferring primary sources.
2. The draft separates source facts, inference, counterevidence, and unknowns.
3. Sol reviews factual support, source quality, missing evidence, and conclusions in one persistent thread.
4. Fable independently opens every cited source and records `ACCEPT`, `REJECT`, or `COUNTER`.
5. Fable revises only for verified accepted or countered findings.
6. The loop ends on `RESEARCH APPROVED`, no verified blocker after adjudication, or 40 rounds.

The report includes sources, unresolved questions, and an auditable peer-review record. It produces no code or implementation plan.

### `/check-loop:execute` — supervised execution

Fable executes an approved plan without surrendering repository or git ownership:

1. Locks the plan and records the current commit and working-tree state.
2. Asks before isolating or including existing user changes; never hides them.
3. Defines one bounded step contract.
4. Dispatches a fresh Opus implementer that does not stage or commit.
5. Inspects the change and runs repository-native validation.
6. Sends a secret-filtered, step-scoped diff and observed validation output to the persistent Sol thread.
7. Independently verifies and adjudicates every Sol finding.
8. Uses a fresh Opus fixer only for an accepted or countered blocking finding.
9. Runs final project verification and a native Sol full working-tree review.
10. Asks before any commit or push.

There are no duplicate model reviewers and no project-specific coding rules. The current repository's instructions and conventions control.

## Prerequisites

- Claude Code 2.1.255 or later. This version introduced the `fable` model alias used by the skill frontmatter.
- Node.js 18 or later.
- An authenticated Codex CLI installation.

Install and authenticate Codex:

```bash
npm install -g @openai/codex
codex login
```

For headless machines:

```bash
codex login --device-auth
```

Verify the transport from the repository root:

```bash
node plugins/check-loop/scripts/codex-invoke.mjs setup
```

The result must report:

```text
Model: gpt-5.6-sol
Reasoning effort: xhigh
Status: ready
```

Fable and Opus are Claude Code aliases and therefore follow Anthropic's current alias targets. GPT-5.6 Sol is pinned in `codex-invoke.mjs`.

## Installation

### Plugin marketplace

```text
/plugin marketplace add lordknows13/claude-check-loop
/plugin install check-loop@lordknows13-check-loop
```

### Git clone

```bash
git clone https://github.com/lordknows13/claude-check-loop.git
cp -r claude-check-loop/plugins/check-loop/skills/* ~/.claude/skills/
cp -r claude-check-loop/plugins/check-loop/scripts/* ~/.claude/scripts/
```

## Usage

Refine a plan:

```text
/check-loop path/to/plan.md
```

Research a question:

```text
/check-loop:research "Compare SQLite and PostgreSQL for this offline-first application"
```

Execute the approved plan:

```text
/check-loop:execute path/to/plan.md
```

If the current conversation identifies exactly one plan or research request, its argument may be omitted.

### Refinement output

```text
Round 2: 2 concerns
- Accepted: F3
- Rejected: F4
- Countered: none
- Unverified questions: F5

PLAN APPROVED -- No remaining concerns.
```

### Execution output

```text
Step 2: COMPLETE
Implementation: Opus
Validation: node --test — pass
Sol: STEP APPROVED after 1 fix round
Adjudication: accepted F3 | rejected F4 | countered none
Unverified questions: F5

Execution complete — awaiting approval
Final verification: pass
Final Sol review: no verified blocking findings
Working tree: reviewed and uncommitted
```

## Transport

`plugins/check-loop/scripts/codex-invoke.mjs` talks to the official Codex App Server protocol over JSON-RPC. It reuses a broker connection, streams notifications, manages thread IDs, and uses the local Codex OAuth session. No runtime npm dependency or API key is required.

Commands:

```bash
# Check authentication and the pinned model contract
node plugins/check-loop/scripts/codex-invoke.mjs setup

# Start a review thread
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" \
  --prompt "PROMPT"

# Continue that thread
node plugins/check-loop/scripts/codex-invoke.mjs turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --prompt "PROMPT"

# Final native working-tree review
node plugins/check-loop/scripts/codex-invoke.mjs review \
  --cwd "$(pwd)" \
  --scope working-tree
```

## Architecture

```text
plugins/check-loop/
  plugin.json
  scripts/
    codex-invoke.mjs
    app-server-broker.mjs
    lib/
  skills/
    check-loop/
      SKILL.md
    research/
      SKILL.md
    execute/
      SKILL.md
      implementer-prompt.md
```

The three skill names are `check-loop`, `research`, and `execute`.

## Safety boundaries

- Existing work is never hidden, discarded, staged, or silently included.
- Implementers never stage or commit.
- Research produces one Markdown report and no implementation changes.
- Secret and credential content is excluded from review prompts.
- Required model substitution stops execution.
- Validation failures and verified blocking findings stop after three unsuccessful fix cycles.
- Commit and push require explicit user approval.

## License

MIT
