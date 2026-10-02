---
name: check-loop
description: Refines implementation plans when they need adversarial architecture review, assumption checking, simplification, or evidence-backed consensus before implementation.
model: fable
effort: xhigh
argument-hint: [plan-path]
---

# Fable-Codex plan refinement

## Overview

Use Fable as plan owner and the configured Codex reviewer as an adversarial peer. Improve the plan rather than maximizing agreement.

**Core principle:** No evidence, no blocking finding. A confident reviewer statement is still only a claim until Fable checks its source.

## Input

Treat `$ARGUMENTS` as the plan path. If it is empty, use the plan active in the conversation or locate one in the working directory. Ask for the path only when no single plan can be identified.

Read:

1. The complete plan.
2. The original user request.
3. Repository instructions and files needed to verify claims.

Keep the original plan content for the final comparison.

## Reviewer configuration and preflight

This skill's frontmatter selects Fable at `xhigh` for the current turn. Stop if Claude Code reports that `fable` was rejected, unavailable, or replaced. Reviewer settings do not change Fable's role.

Before starting review, resolve settings for the current working directory:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" config --cwd "$(pwd)"
```

The command prints one JSON object:

```json
{"model":null,"effort":null,"maxRounds":6}
```

`null` means inherit the corresponding Codex default. `maxRounds` is already resolved from CLI/project/user/default precedence and must be between 1 and 40. Freeze all three values for this invocation; do not re-resolve them between rounds. Use the literal `default` for a null model or effort when constructing CLI calls.

Run the transport preflight with the frozen settings:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup \
  --cwd "$(pwd)" \
  --model "MODEL_SETTING_OR_default" \
  --effort "EFFORT_SETTING_OR_default" \
  --max-rounds MAX_ROUNDS
```

Proceed only when setup reports the Codex CLI installed, authentication ready, and the chosen model, effort, and maximum review rounds correctly. Setup does not test model availability; the first review turn does. If an explicit model or effort is unavailable, rejected, or silently substituted, stop rather than changing reviewers.

## Codex transport

Start round 1 with the frozen setting values:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --model "MODEL_SETTING_OR_default" \
  --effort "EFFORT_SETTING_OR_default" \
  --prompt "PROMPT"
```

The command prints JSON:

```json
{"threadId":"...","response":"...","model":"...","effort":"...","status":0,"error":null}
```

Record the returned `model` and `effort` as the actual reviewer settings. Show them with every round result. Continue every later round with the returned thread ID and the same explicit actual values when non-null; if a returned value is null, continue with literal `default` and report it as `Codex default (not reported)` rather than inventing a value:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --model "ACTUAL_MODEL_OR_default" \
  --effort "ACTUAL_EFFORT_OR_default" \
  --prompt "PROMPT"
```

Keep one read-only thread for the entire refinement loop. A continuation that reports a different non-null model or effort is a configuration failure, not a valid review round.

### Review-result gate

Before adjudication, require a zero command exit, `status: 0`, `error: null`, and a substantive response that follows the requested finding or approval format. A failed command, empty or malformed response, or authentication error is an incomplete review, not "no findings." Preserve the plan, report the actionable error, and stop; do not manufacture a substitute Codex verdict.

Preserve Codex's exact citations and uncertainty labels when reporting findings, then record Fable's independent adjudication separately. A completed transport is not itself plan approval.

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

## Secret handling

Before sending any payload to Codex, inspect it and redact secret or credential values. Omit contents from `*.env*`, `*.secret*`, `*credentials*`, `**/secrets/**`, ignored environment files, binary payloads, and dependency caches. Name an omitted path only when Codex needs the omission context; never include its content.

## Review focus by round

Every review round must check all applicable core risks: architecture and correctness, security and data integrity, operations and recovery, scope, evidence quality, edge cases, and unnecessary complexity. The rotating perspective is an additional focus, never permission to skip another applicable risk:

| Round | Additional focus |
|---|---|
| 1 | Architecture and correctness: design flaws, broken assumptions, ambiguous requirements, stress cases, and whether the plan solves the requested problem simply. |
| 2 | Security and data integrity: authorization, validation, injection, concurrency, idempotency, partial failure, secrets, auditability, and data loss. |
| 3+ | Operations and recovery: rollback, observability, rollout safety, version skew, compatibility, capacity, blast radius, and recovery. Deepen these angles on later rounds rather than becoming generic. |

Rotation does not require an extra round. Stop as soon as the stopping rules are met.

## Initial Codex prompt

Send the original request and full plan using this contract:

```text
Act as Codex, the adversarial peer reviewing an implementation plan owned by Fable.

This is Round 1 of MAX_ROUNDS.
Configured reviewer setting: model MODEL_SETTING_OR_DEFAULT; effort EFFORT_SETTING_OR_DEFAULT.

Review only the implementation plan. Do not implement code or invent repository facts.

Mandatory in every round: check all applicable architecture and correctness, security and data-integrity, operations and recovery, scope, evidence quality, edge cases, and unnecessary-complexity risks.

Additional focus for Round 1 -- architecture and correctness:
Hunt for design flaws, broken assumptions, ambiguous requirements, hand-waved hard parts, stress failures, and plans that solve the wrong problem or use needless complexity. This focus does not narrow the mandatory checks above.

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

Codex reports:

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

Continue only when the stopping rules require another review. Select and insert the complete additional-focus stanza for the current round; do not merely report its label:

- Round 2: `Focus especially on authentication and authorization gaps, validation and injection, race conditions and concurrent writes, idempotency, partial-failure recovery, secret handling, audit trails, and data-loss scenarios under crash or retry. Look for issues that pass functional review but fail under adversarial or unlucky conditions.`
- Round 3+: `Focus especially on rollback safety, observability and metrics, gradual rollout, version skew, backwards compatibility, capacity and blast radius, on-call diagnosis, and recovery after failure. On later rounds, deepen these operations and recovery angles rather than becoming generic.`

The continuation sent to Codex must therefore contain substantive focus text in this template:

```text
Fable independently checked every cited source.

This is Round N of MAX_ROUNDS.
Frozen reviewer: model ACTUAL_MODEL_OR_DEFAULT; effort ACTUAL_EFFORT_OR_DEFAULT.

Mandatory in every round: check all applicable architecture and correctness, security and data-integrity, operations and recovery, scope, evidence quality, edge cases, and unnecessary-complexity risks.

Additional focus for Round N -- FOCUS_LABEL:
FULL_FOCUS_TEXT_FOR_THIS_ROUND
This focus does not narrow the mandatory checks above.

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

Count each completed Codex response as one review round. Conclude refinement immediately when Codex approves or when no independently verified critical or important finding remains after adjudication. A rejected, minor, inferred, or unverified item does not block convergence; retain it in the appropriate final-report category. Never run another round only to reach a different focus, and never waive a verified blocker because the frozen limit was reached.

After each round, report:

```text
Round N/MAX_ROUNDS — Codex model: ACTUAL_MODEL; effort: ACTUAL_EFFORT
Concerns: X
- Accepted: F...
- Rejected: F...
- Countered: F...
- Unverified questions: F...
```

Do not begin a round beyond the frozen `maxRounds`. At the cap, conclude only if no independently verified critical or important finding remains. Otherwise preserve the current plan and adjudication record, mark refinement `BLOCKED AT ROUND LIMIT`, list unresolved verified disagreements separately from unverified hypotheses, and ask the user how to resolve the verified blocker. Never describe a capped result with blockers as approved.

If the user cancels, stop the current invocation, leave the plan and adjudication record in their present state, and report `CANCELLED — NOT APPROVED`. Cancellation creates no durable resume state and is not convergence.

## Final report

Report:

- Rounds completed and convergence status.
- Frozen round limit and actual Codex model and effort.
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
| Asking Codex to rewrite the plan | Fable owns plan decisions and edits. |

## Red flags

Stop adjudication when reasoning includes:

- "Codex probably checked it."
- "Better safe than sorry."
- "Both models agree."
- "The deadline means we should accept it."
- "The citation looks plausible."

Each phrase substitutes confidence or pressure for evidence. Verify before proceeding.
