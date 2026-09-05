---
name: execute
description: Executes an approved plan with Fable orchestration, fresh Opus implementation subagents, repository-native validation, and GPT-5.6 Sol review of every step. Use after check-loop approves a plan or when the user requests supervised plan execution.
model: fable
effort: xhigh
argument-hint: [plan-path]
---

# Fable-orchestrated plan execution

## Overview

Fable owns the plan, review scope, validation, and decisions. A fresh Opus subagent implements or fixes one bounded step. GPT-5.6 Sol reviews every step in one persistent thread.

**Core principle:** No evidence, no blocking finding. Review output is a claim until Fable checks its cited source.

Do not commit or push before explicit user approval.

## Execution state

```text
PREPARE
  Read and lock the approved plan.
  Read repository instructions and validation commands.
  Run the model preflight.
  Capture HEAD and working-tree state.
  If unrelated changes exist, ask for worktree isolation or explicit inclusion.

FOR EACH STEP
  Define the step contract and take a working-tree snapshot.
  Dispatch one fresh Opus implementer.
  Inspect the actual changes and run repository-native validation.
  Send the step contract, filtered diff, context, and results to Sol.
  Independently verify and adjudicate every finding.
  For an accepted blocking finding, dispatch a fresh Opus fixer and repeat.

FINALIZE
  Run full repository verification and the changed surface.
  Run a native Sol full working-tree review.
  Independently verify its findings.
  Present the evidence and adjudication log.
  Ask before any commit or push.
```

## Prepare

Treat `$ARGUMENTS` as the approved plan path. If it is empty, use the single plan active in the conversation or repository. Ask only when no single plan can be identified.

Read:

1. The complete plan and original request.
2. Repository instruction files already supplied by the host.
3. Build, test, lint, type-check, and run commands from repository configuration.

Lock the plan for execution. A wrong or impossible step requires user input; do not silently rewrite it.

### Required models

This skill's frontmatter selects Fable at `xhigh`. Stop if Claude Code reports that `fable` was rejected, unavailable, or replaced.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup --cwd "$(pwd)"
```

Proceed only when it reports:

```text
Model: gpt-5.6-sol
Reasoning effort: xhigh
Status: ready
```

### Working-tree ownership

Record the current HEAD and working-tree state before changing files. Existing work belongs to the user.

If unrelated changes are present, ask the user to choose:

1. Execute in an isolated worktree.
2. Explicitly include the existing changes in this execution.

Never hide, discard, stage, or silently include unrelated work. Keep all execution changes uncommitted until final approval.

## Start Sol supervision

Start one thread:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --prompt "PROMPT"
```

Initial prompt:

```text
Act as GPT-5.6 Sol, the adversarial reviewer for an approved implementation plan owned by Fable.

Review only. Do not write code. Use the repository's actual instructions and conventions; do not impose unrelated framework preferences. Ignore agent-framework metadata that is not an implementation requirement.

Evidence contract for every concern:
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:

Rules:
- VERIFIED means the cited source directly supports the exact claim.
- INFERENCE means cited facts support an unreproduced conclusion.
- UNVERIFIED means evidence is missing or inaccessible.
- Never call a concern VERIFIED because it sounds likely.
- Ask for missing context instead of guessing.
- Number findings continuously across this thread.
- If a step has no concerns, respond exactly: STEP APPROVED

Approved plan:
<plan>
FULL_PLAN
</plan>

Repository instructions:
<repository_instructions>
RELEVANT_INSTRUCTIONS
</repository_instructions>

Confirm that you are ready to review Step 1.
```

Save the returned `threadId`. Continue that thread for every step:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --prompt "PROMPT"
```

## Execute each step

Process steps sequentially. One step owns one implementation and review loop.

### 1. Define the step contract

Write down:

- Exact plan text.
- Allowed files or subsystem.
- Dependencies produced by completed steps.
- Observable acceptance criteria.
- Repository-native validation for this step.

Take a pre-step working-tree snapshot. The review scope is the delta between that snapshot and the post-implementation state, including new files. Do not use the staging area to manufacture review scope.

### 2. Dispatch a fresh Opus implementer

Use `./implementer-prompt.md`. The invocation must select:

```text
Agent tool:
  subagent_type: "general-purpose"
  model: "opus"
```

Supply the full step contract, relevant context, working directory, repository instructions, and the pre-step snapshot. Do not make the subagent rediscover the plan.

Use a fresh Opus subagent for each implementation or fix. Never run overlapping implementers against the same files.

Handle its status:

- `DONE`: inspect the result.
- `DONE_WITH_CONCERNS`: inspect the result and resolve correctness or scope concerns first.
- `NEEDS_CONTEXT`: gather the missing repository context and dispatch a fresh Opus subagent.
- `BLOCKED`: change the context or step decomposition. If the approved plan itself is wrong, ask the user.

Do not retry an unchanged prompt after a blocker.

### 3. Inspect and validate

Fable must:

1. Read the changed files and compare them with the step contract.
2. Confirm that unrelated user changes remain untouched.
3. Run the smallest repository-native commands that prove this step's behavior.
4. Exercise the changed surface when a runtime is available.
5. Record exact command output, failures, and skipped checks.

Fix validation failures before external review. Give each fresh Opus fixer the exact failure output and acceptance criteria. After three unsuccessful fixes, stop and ask the user.

### 4. Build the review packet

Compute the step-scoped diff from the pre-step snapshot. Include new files. Do not include secrets, credentials, binary payloads, dependency caches, or unrelated changes.

Never place contents from files matching `*.env*`, `*.secret*`, `*credentials*`, or `**/secrets/**` in a prompt. Tell Sol not to open those paths.

Send this packet in the persistent Sol thread:

```text
Review Step N of M.

Step contract:
<step>
EXACT_PLAN_TEXT_AND_ACCEPTANCE_CRITERIA
</step>

Implemented changes:
<diff>
FILTERED_STEP_SCOPED_DIFF
</diff>

Relevant context:
<context>
ONLY_CONTEXT_NEEDED_TO_CHECK_THE_STEP
</context>

Validation:
<validation>
COMMANDS_AND_OBSERVED_OUTPUT
</validation>

Apply the evidence contract:
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:

Do not invent repository facts. If evidence is missing, use INFERENCE or UNVERIFIED and ask for the missing context. Only report defects with a concrete failure condition.

If there are no concerns, respond exactly:
STEP APPROVED
```

### 5. Adjudicate evidence

Only VERIFIED critical or important findings may block a step, and Fable must independently verify the cited source first.

For every finding:

1. Open the cited plan section, file location, or command output.
2. Confirm that the citation exists, is current, and supports the exact claim and failure condition.
3. Assign:
   - `ACCEPT`: verified defect; the proposed correction is appropriate.
   - `REJECT`: contradicted, unsupported, irrelevant, or preference-only.
   - `COUNTER`: verified defect; a different correction is safer or simpler.
4. Record the evidence and decision.

`INFERENCE`, `UNVERIFIED`, and `minor` findings are nonblocking questions or observations. Model agreement, severity, confidence, and repetition are not evidence.

Reject invented, stale, mismatched, or inaccessible citations. Supply missing context and ask Sol to review again instead of guessing.

Continue the thread with:

```text
Fable independently checked every cited source.

Adjudication:
- F1: ACCEPTED -- verified evidence and reason
- F2: REJECTED -- contradictory or missing evidence and reason
- F3: COUNTERED -- verified concern, safer correction and reason

Unverified questions:
- Every INFERENCE or UNVERIFIED item still needing evidence

Do not repeat a rejected concern without new evidence.
```

### 6. Fix or approve

If Sol returns `STEP APPROVED`, complete the step.

For each accepted or countered blocking finding:

1. Dispatch a fresh Opus fixer with the verified finding, chosen correction, step contract, and current context.
2. Inspect the fix.
3. Re-run step validation.
4. Recompute the filtered step diff.
5. Re-submit it in the same Sol thread.

Stop after three unsuccessful review/fix cycles. Ask the user to resolve remaining verified critical or important disagreements. Do not escalate unsupported hypotheses as defects.

Report:

```text
Step N: COMPLETE
Implementation: Opus
Validation: commands and outcomes
Sol: STEP APPROVED [after N fix rounds]
Adjudication: accepted F... | rejected F... | countered F...
Unverified questions: F... or none
```

Then continue to the next step without creating a commit.

## Final verification

After all steps complete:

1. Inspect the complete working-tree diff against the locked plan.
2. Run the repository's full applicable validation.
3. Exercise the final changed surface.
4. Run a native GPT-5.6 Sol review:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" review \
  --cwd "$(pwd)" \
  --scope working-tree
```

Treat native review output as claims, not proof. Fable must independently verify every cited source and reconstruct each concern using the evidence contract before it can block. Missing evidence makes the item nonblocking.

Use the same accept, reject, counter, fix, and three-cycle rules. Re-run full verification after an accepted fix.

## Final approval gate

Present:

- Plan path and baseline.
- Completed steps.
- Changed files.
- Exact validation commands and observed outcomes.
- Runtime smoke-test evidence.
- Accepted, rejected, and countered findings.
- Unverified questions and residual risks.
- Final Sol review outcome.
- Complete working-tree status.

Then ask whether to commit and push. Until the user explicitly approves, do neither.

If approved, create only the requested commit or commits and push only the requested branch. If declined, leave the reviewed work uncommitted and report how to inspect it.

## Quick reference

| Responsibility | Owner |
|---|---|
| Plan, step contracts, validation, evidence checks | Fable |
| Implementation and accepted fixes | Fresh Opus subagent |
| Adversarial review | GPT-5.6 Sol |
| Commit and push authorization | User |

| Review status | Treatment |
|---|---|
| `VERIFIED` critical or important | Independently check; may block |
| `VERIFIED` minor | Record; nonblocking |
| `INFERENCE` | Ask what would verify it; nonblocking |
| `UNVERIFIED` | Supply context or record; nonblocking |

## Common mistakes

| Mistake | Correct action |
|---|---|
| Letting an implementer stage or commit | Keep review scope and git ownership with Fable. |
| Hiding a dirty tree | Ask for isolation or explicit inclusion. |
| Using generic framework standards | Read and enforce repository-native instructions. |
| Accepting a severe finding on confidence | Independently inspect its evidence. |
| Treating two-model agreement as proof | Verify the source and failure condition. |
| Blocking on a plausible race | Keep it inference until directly supported or reproduced. |
| Sending the whole repository to review | Send the smallest sufficient filtered packet. |
| Reusing an implementer context | Dispatch a fresh Opus subagent for each implementation or fix. |

## Rationalization counters

| Rationalization | Counter |
|---|---|
| "Sol probably checked the line." | Fable opens the current source. |
| "Better safe than sorry." | Unsupported changes create risk; verify first. |
| "Both models agree." | Agreement is not evidence. |
| "The deadline makes staging harmless." | Staging changes review scope and user state. |
| "This convention is industry standard." | Repository instructions control. |
| "It is only a minor automatic commit." | The user owns commit boundaries. |

## Review red flags

Stop adjudication when:

- A finding omits a required evidence field.
- A file path or line cannot be opened.
- Command output was not actually observed.
- The cited text does not imply the stated failure condition.
- A hypothetical behavior is labeled VERIFIED.
- Severity is used as evidence.
- A repeated claim is treated as corroboration.

Reclassify unsupported items, supply missing context, or reject them before continuing.
