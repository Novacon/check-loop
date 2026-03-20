---
name: check-loop
description: Adversarial plan refinement loop between Claude and Codex. Automates the cycle of Codex reviewing a plan, Claude defending or updating it, and repeating until both models reach consensus. Use when you have a plan that needs battle-testing. Pass the path to the plan file as the argument, or omit to auto-detect.
---

# Co-Refine: Adversarial Plan Refinement Loop

Automates iterative plan refinement between Claude (plan author/defender) and Codex (adversarial reviewer). Runs the review-defend-update loop until both models agree or the maximum round limit is reached.

## Arguments

`$ARGUMENTS` should be the path to the plan file. If not provided, look for a plan file in the current session context (e.g., recently written plan files, `.claude/` directory, or the working directory). If you cannot find a plan file, ask the user.

## Configuration

- **Maximum rounds**: 20 (safety limit — large plans can take 10+ rounds to converge)
- **Convergence signal**: Codex responds with "PLAN APPROVED" when it has no remaining concerns

## Step 1: Read the Plan and Gather Context

1. Read the plan file at the path provided in `$ARGUMENTS`.
2. Find the original user prompt/request that triggered the plan from the conversation history.
3. Store the original plan content — you will need to compare against it at the end.
4. Tell the user: "Starting adversarial refinement loop. Sending plan to Codex for review..."

## Step 2: Send Plan to Codex for Initial Review

Call `mcp__validate-plans-and-brainstorm-ideas__codex` with:

- `model`: `gpt-5.4`
- `config`: `{"model_reasoning_effort": "xhigh"}`
- `sandbox`: `read-only`
- `approval-policy`: `never`
- `cwd`: (use the current working directory)
- `prompt`: construct exactly as shown below

### Initial Review Prompt

```text
You are a senior staff engineer performing an adversarial review of an implementation plan. Your role is to find genuine problems — not to nitpick or rubber-stamp.

Rules:
- DO NOT implement or write any code. Review ONLY.
- DO NOT suggest changes just for the sake of suggesting changes.
- Focus on: critical flaws, over-engineering, missing edge cases, simpler approaches, incorrect assumptions, unnecessary complexity.
- Be specific and direct — cite the exact part of the plan you're critiquing.
- If something is genuinely good, say so briefly and move on.
- Number each piece of feedback (F1, F2, F3...) so we can reference them in discussion.
- After presenting feedback, end with a summary line: "X concerns raised."

If you have ZERO concerns and believe the plan is solid as-is, respond with exactly:
"PLAN APPROVED — No remaining concerns."

Original request from the user:
<original_request>
{paste the user's original prompt/request that triggered the plan}
</original_request>

Plan to review:
<plan>
{paste the full contents of the plan file}
</plan>
```

Save the `threadId` from the response — you will need it for all subsequent rounds.

## Step 3: The Refinement Loop

After receiving Codex's initial review, enter the refinement loop. Each iteration is one "round."

### For Each Round:

#### 3a. Check for Convergence

If Codex's response contains "PLAN APPROVED", the loop is complete. Skip to Step 4.

#### 3b. Analyze Each Piece of Feedback

For EVERY numbered feedback point from Codex, make a judgment:

1. **ACCEPT** — The feedback is valid and improves the plan. Update the plan accordingly.
   - Note: "Accepted F1 — [one-line reason]"

2. **REJECT** — The feedback is overkill, premature optimization, based on incorrect assumptions, or unnecessary. **Push back with specific reasoning.** Do not be polite about it — be direct about why this feedback is wrong.
   - Note: "Rejected F3 — [one-line reason why it's wrong or overkill]"

3. **COUNTER** — The feedback raises a valid concern but the suggested fix is wrong. Propose a better alternative.
   - Note: "Counter F2 — [your alternative approach]"

**IMPORTANT: Fight back on anything that is overkill or not correct.** The goal is NOT to make Codex happy. The goal is to make the plan better. Only change what genuinely needs changing. Defend the plan where it is right.

#### 3c. Update the Plan File

Write the updated plan to the same file path, incorporating only the ACCEPTED changes.

#### 3d. Report Round Status to the User

Print a brief status update:

```
Round N: Codex raised X concerns.
  - Accepted: [count] ([list F-numbers])
  - Rejected: [count] ([list F-numbers])
  - Countered: [count] ([list F-numbers])
Updating plan and sending back to Codex...
```

#### 3e. Send Updated Plan and Response to Codex

Use `mcp__validate-plans-and-brainstorm-ideas__codex-reply` with:

- `threadId`: (from the Codex session)
- `prompt`: construct as shown below

```text
Here is my response to your review:

{For each feedback point:}
- F1: ACCEPTED — [reasoning]
- F2: COUNTERED — [your alternative + reasoning]
- F3: REJECTED — [why it's wrong/overkill]
{...continue for all points}

Here is the updated plan with accepted changes incorporated:

<plan>
{paste the full updated plan}
</plan>

Review the updated plan and my responses. Rules for this round:
- If you disagree with any of my rejections, argue back with specific reasoning. Do not just repeat the same point — explain what I'm missing.
- If you have NEW concerns about the updated plan, raise them with new F-numbers (continue numbering from where you left off).
- If you accept my rejections and have no new concerns, respond with exactly: "PLAN APPROVED — No remaining concerns."
- Do NOT re-raise concerns that you've already accepted or that I've addressed.
```

#### 3f. Loop or Exit

- If Codex responds with "PLAN APPROVED" → proceed to Step 4.
- If Codex raises new or continued concerns → go back to 3b for the next round.
- If you have reached the maximum round limit (20) → proceed to Step 4 with unresolved items noted.

## Step 4: Present Final Results

After the loop completes (by convergence or round limit), present a summary to the user:

### Summary Format

```
## Refinement Complete

**Rounds**: [N] of 20 max
**Status**: [Consensus reached / Ended with unresolved items]

### Changes Made
- [Bullet list of meaningful changes from the original plan]

### Defended Successfully
- [Bullet list of pushback that Codex accepted]

### Unresolved Disagreements (if any)
- [Points where models still disagree, with both perspectives]

### Plan Diff
[Brief description of what changed from the original to the final version]
```

The updated plan file is the source of truth. The user can review the file directly.

## How To Treat Codex Responses

- Codex is a **peer reviewer**, not an authority. You are the plan author — you know the context better.
- Fight for your decisions when they're right. Do not capitulate just because Codex pushed back twice.
- If Codex keeps re-raising the same rejected point without new reasoning, say "Already addressed — moving on" and treat it as an unresolved disagreement.
- The goal is a genuinely better plan through honest debate, not unanimous agreement at any cost.
- If Codex raises something you hadn't considered and it's clearly right, accept it immediately and gracefully. Good engineers change their minds when presented with better arguments.
