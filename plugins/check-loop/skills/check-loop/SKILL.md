---
name: check-loop
description: Refines implementation plans when they need adversarial architecture review, assumption checking, simplification, or evidence-backed consensus before implementation.
model: fable
effort: xhigh
argument-hint: [plan-path]
---

# Fable-Sol plan refinement

## Overview

Use Fable as plan owner and GPT-5.6 Sol as an adversarial peer. Improve the plan rather than maximizing agreement.

**Core principle:** No evidence, no blocking finding. A confident reviewer statement is still only a claim until Fable checks its source.

## Input

Treat `$ARGUMENTS` as the plan path. If it is empty, use the plan active in the conversation or locate one in the working directory. Ask for the path only when no single plan can be identified.

Read:

1. The complete plan.
2. The original user request.
3. Repository instructions and files needed to verify claims.

Keep the original plan content for the final comparison.

## Required models

This skill's frontmatter selects Fable at `xhigh` for the current turn. Stop if Claude Code reports that `fable` was rejected, unavailable, or replaced.

Run the transport preflight:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup --cwd "$(pwd)"
```

Proceed only when it reports:

```text
Model: gpt-5.6-sol
Reasoning effort: xhigh
Status: ready
```

## Sol transport

Start the first review:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --prompt "PROMPT"
```

Continue every later round with the returned thread ID:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --prompt "PROMPT"
```

The command prints JSON:

```json
{"threadId":"...","response":"..."}
```

Keep one thread for the entire refinement loop.

## Evidence contract

Require every concern to use all fields:

```text
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:
```

Interpret verification status strictly:

| Status | Meaning | Blocking |
|---|---|---|
| `VERIFIED` | The cited source directly supports the claim. | Only critical or important findings may block. |
| `INFERENCE` | Cited facts support a conclusion that has not been reproduced. | No. Ask what would verify it. |
| `UNVERIFIED` | Evidence is missing or inaccessible. | No. Supply context or record a question. |

Only VERIFIED critical or important findings may block or change the plan, and Fable must independently verify the cited source first. Model agreement, confident wording, severity labels, and repeated assertions are not evidence.

Reject invented, stale, mismatched, or inaccessible citations. Supply missing context and request a new review instead of guessing.

## Initial Sol prompt

Send the original request and full plan using this contract:

```text
Act as GPT-5.6 Sol, the adversarial peer reviewing an implementation plan owned by Fable.

Review only the implementation plan. Find genuine correctness risks, unsupported assumptions, missing edge cases, unnecessary complexity, and simpler approaches. Do not implement code. Do not invent repository facts.

Evidence rules:
- Every concern must use the complete finding format below.
- Cite an exact plan quote, a file:line you actually inspected, or command output you actually observed.
- Mark a supported but unreproduced conclusion INFERENCE.
- Mark missing or inaccessible evidence UNVERIFIED.
- Never label a claim VERIFIED because it sounds likely.
- If context is missing, ask for it instead of guessing.
- Ignore toolchain markers and agent-framework metadata that are not implementation requirements.

Finding format:
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:

Number findings continuously across rounds. End with "X concerns raised."

If there are zero concerns, respond exactly:
PLAN APPROVED -- No remaining concerns.

Original request:
<original_request>
ORIGINAL_REQUEST
</original_request>

Plan:
<plan>
FULL_PLAN
</plan>
```

## Fable adjudication

For every finding:

1. Open the cited plan section or repository location. Re-run a cited command when safe and necessary.
2. Check that the evidence exists, is current, and supports the exact claim and failure condition.
3. Assign one decision:
   - `ACCEPT`: verified and the correction improves the plan.
   - `REJECT`: contradicted, unsupported, irrelevant, or preference-only.
   - `COUNTER`: verified concern, but a different correction is safer or simpler.
4. Change the plan only for accepted findings. Incorporate counters only after stating Fable's alternative.
5. Keep inferences and unverified items outside the defect list until evidence promotes them to verified.

### Complete example

Sol reports:

```text
F4 [critical] [VERIFIED]
Claim: The plan can double-charge customers.
Evidence: src/billing/charge.ts:88 retries after a successful charge.
Impact: A retry can create a second payment.
Failure condition: The response is lost after the provider captures payment.
Recommended correction: Add an idempotency key.
```

The repository has no `src/billing/charge.ts`. Fable must respond:

```text
F4: REJECTED. The cited file does not exist, so the evidence cannot support the claim. The plan remains unchanged. Re-submit as UNVERIFIED with the actual payment path if this concern still applies.
```

The `critical` label does not override missing evidence.

## Continuation prompt

After adjudication, update the plan and continue the same thread:

```text
Fable independently checked every cited source.

Adjudication:
- F1: ACCEPTED -- verified evidence and reason
- F2: REJECTED -- contradictory or missing evidence and reason
- F3: COUNTERED -- verified concern, safer alternative and reason

Unverified questions:
- List every INFERENCE or UNVERIFIED item that still needs evidence.

Revised plan:
<plan>
FULL_REVISED_PLAN
</plan>

Review the adjudication and revised plan.
- Do not repeat an addressed concern without new evidence.
- Continue finding numbers for genuinely new concerns.
- Use the complete evidence contract for every concern.
- If Fable rejected evidence incorrectly, cite the exact missed source.
- If no verified concern remains, respond exactly:
PLAN APPROVED -- No remaining concerns.
```

## Loop and stopping rules

Conclude refinement when Sol approves, when no independently verified critical or important finding remains after adjudication, or when 40 rounds complete. A rejected, minor, inferred, or unverified item does not block convergence; retain it in the appropriate final-report category.

After each round, report:

```text
Round N: X concerns
- Accepted: F...
- Rejected: F...
- Countered: F...
- Unverified questions: F...
```

At the round limit, stop and list unresolved verified disagreements separately from unverified hypotheses. Do not turn unresolved uncertainty into a defect.

## Final report

Report:

- Rounds completed and convergence status.
- Verified changes made to the plan.
- Decisions Fable defended successfully.
- Unresolved verified disagreements.
- Unverified questions that never obtained evidence.
- A concise original-to-final plan diff.

The updated plan file is the source of truth.

## Common mistakes

| Mistake | Correct action |
|---|---|
| Accepting a finding because it is critical | Verify its evidence first. |
| Treating two-model agreement as proof | Inspect the cited source. |
| Blocking on a plausible race or edge case | Mark it inference until reproduced or directly supported. |
| Trusting a file:line without opening it | Read the current file and confirm line drift. |
| Asking Sol to rewrite the plan | Fable owns plan decisions and edits. |

## Red flags

Stop adjudication when reasoning includes:

- "Sol probably checked it."
- "Better safe than sorry."
- "Both models agree."
- "The deadline means we should accept it."
- "The citation looks plausible."

Each phrase substitutes confidence or pressure for evidence. Verify before proceeding.
