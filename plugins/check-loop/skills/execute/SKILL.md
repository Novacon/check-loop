---
name: execute
description: Executes approved multi-step plans when they need isolated implementation workers, repository-native validation, and adversarial review before commit or push.
model: fable
effort: xhigh
argument-hint: [plan-path]
---

# Fable-orchestrated plan execution

## Overview

Fable owns the plan, review scope, validation, and decisions. A fresh Opus subagent implements or fixes one bounded step. The configured Codex reviewer reviews every step in one persistent read-only thread.

**Core principle:** No evidence, no blocking finding. Review output is a claim until Fable checks its cited source.

Do not commit or push before explicit user approval.

## Execution state

```text
PREPARE
  Read and lock the approved plan.
  Read repository instructions and validation commands.
  Run the model preflight.
  Capture HEAD and working-tree state.
  If any working-tree changes exist, ask for worktree isolation or explicit inclusion.

FOR EACH STEP
  Define the step contract and take a working-tree snapshot.
  Dispatch one fresh Opus implementer.
  Inspect the actual changes and run repository-native validation.
  Send the step contract, filtered diff, context, and results to Codex.
  Independently verify and adjudicate every finding.
  For an accepted blocking finding, dispatch a fresh Opus fixer and repeat.

FINALIZE
  Run full repository verification and the changed surface.
  Send a sanitized final review packet in the persistent Codex thread.
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

### Required models and reviewer configuration

This skill's frontmatter selects Fable at `xhigh`. Stop if Claude Code reports that `fable` was rejected, unavailable, or replaced. Reviewer settings do not change Fable or Opus.

Resolve reviewer settings for the current working directory:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" config --cwd "$(pwd)"
```

The JSON result contains `model`, `effort`, and `maxRounds`. Freeze the model and effort for this execution. Use literal `default` for a null value. `maxRounds` governs plan and research review loops; report that execution instead keeps its fixed cap of three reviewer-driven fix attempts so the setting is not silently misapplied.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup \
  --cwd "$(pwd)" \
  --model "MODEL_SETTING_OR_default" \
  --effort "EFFORT_SETTING_OR_default" \
  --max-rounds CONFIGURED_MAX_ROUNDS
```

Proceed only when setup reports the Codex CLI installed, authentication ready, and the chosen settings correctly. Setup does not test model availability; the first review turn does. If an explicit model or effort is unavailable, rejected, or silently substituted, stop rather than changing reviewers.

### Working-tree ownership

Record the current HEAD and working-tree state before changing files. Existing work belongs to the user.

If any working-tree changes are present, ask the user to choose:

1. Execute in an isolated worktree created from the recorded HEAD, leaving the original dirty tree untouched.
2. Explicitly include the named existing changes in this execution.

Keep the baseline paths and diff separate from execution-produced changes, even when the user authorizes inclusion. Never present baseline work as Opus output or include it in a commit unless the user's choice explicitly covers it. Never hide, discard, stage, or silently include existing work. Keep all execution changes uncommitted until final approval.

Before sending any plan, instruction, diff, validation output, or follow-up to Codex, inspect it and redact secret or credential values. Omit contents from `*.env*`, `*.secret*`, `*credentials*`, `**/secrets/**`, ignored environment files, binary payloads, and dependency caches. Name an omitted path only when Codex needs the omission context; never include its content.

## Start Codex supervision

Start one thread with the frozen configured values:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --model "MODEL_SETTING_OR_default" \
  --effort "EFFORT_SETTING_OR_default" \
  --prompt-file PROMPT_FILE
```

Initial prompt:

```text
Act as Codex, the adversarial reviewer for an approved implementation plan owned by Fable.

Configured reviewer setting: model MODEL_SETTING_OR_DEFAULT; effort EFFORT_SETTING_OR_DEFAULT.

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

The command prints JSON:

```json
{"threadId":"...","response":"...","model":"...","effort":"...","status":0,"error":null}
```

For the initial acknowledgment and every step, fix, or final review, require a zero command exit, `status: 0`, `error: null`, and substantive output appropriate to that phase. A failed, empty, or malformed review is incomplete—not approval or "no findings." Preserve the working tree, report the actionable error, and stop; do not substitute Fable's own review for missing Codex output. Preserve the reviewer's citations and uncertainty labels, keeping Fable's adjudication separate.

Save the returned `threadId`, `model`, and `effort`. The returned model and effort are the actual settings: show them in step and final reports. Continue the same thread for every step, passing those actual values explicitly when non-null. If a returned value is null, use literal `default` and report `Codex default (not reported)` rather than inventing a value:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --model "ACTUAL_MODEL_OR_default" \
  --effort "ACTUAL_EFFORT_OR_default" \
  --prompt-file PROMPT_FILE
```

Write each prompt to a temporary file and pass it with `--prompt-file`; large diffs do not fit safely in a shell argument. A continuation that reports a different non-null model or effort is a configuration failure, not a valid review. Reviewer turns time out after 20 minutes (`--timeout-minutes` to change) and are interrupted; a timeout or other transport failure records nothing, so rerun the same turn once before stopping.

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

Fix validation failures before external review. Give each fresh Opus fixer the exact failure output and acceptance criteria. After three unsuccessful validation-fix attempts, stop and ask the user.

### 4. Build the review packet

Compute the step-scoped diff from the pre-step snapshot. Include new files. Do not include secrets, credentials, binary payloads, dependency caches, or unrelated changes.

Never place contents from files matching `*.env*`, `*.secret*`, `*credentials*`, or `**/secrets/**` in a prompt. Tell Codex not to open those paths.

Send this packet in the persistent Codex thread:

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

Reject invented, stale, mismatched, or inaccessible citations. Supply missing context and ask Codex to review again instead of guessing.

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

Complete the step when Codex returns `STEP APPROVED` or when no independently verified critical or important finding remains after adjudication. Codex refusing to approve because of a rejected, minor, inferred, or unverified item does not block completion; record the item in its nonblocking category.

For each accepted or countered blocking finding:

1. Before dispatching, snapshot the working tree (the fix base).
2. Dispatch a fresh Opus fixer with the verified finding, chosen correction, step contract, and current context.
3. Inspect the fix.
4. Re-run step validation.
5. Send a fix re-review in the same Codex thread. Do not resend the step diff: the reviewer has already reviewed everything outside the fix.

Fix re-review packet:

```text
Re-review the fix for Step N. Review only the fix delta below; do not re-review code outside it.

Findings being fixed:
- F3 [important] TITLE -- Fable's chosen correction

For each listed finding, answer ADDRESSED or NOT ADDRESSED with evidence from the fix delta. Report a new finding only if the fix delta itself introduces it, using the evidence contract.

Fix delta (fix base to now):
<diff>
FILTERED_FIX_DELTA
</diff>

Validation after the fix:
<validation>
COMMANDS_AND_OBSERVED_OUTPUT
</validation>

If every listed finding is addressed and the delta adds no concern, respond exactly:
STEP APPROVED
```

Dispatch at most three reviewer-driven Opus fixers for a step. If verified critical or important findings remain after the third fix attempt, stop and ask the user to resolve them. Do not escalate unsupported hypotheses as defects.

Report:

```text
Step N: COMPLETE
Implementation: Opus
Validation: commands and outcomes
Codex (model ACTUAL_MODEL; effort ACTUAL_EFFORT): STEP APPROVED [after N fix attempts] | no verified blockers after adjudication
Adjudication: accepted F... | rejected F... | countered F...
Unverified questions: F... or none
```

Then continue to the next step without creating a commit.

## Final verification

After all steps complete:

1. Inspect the complete execution-scoped diff from the recorded baseline against the locked plan.
2. Run the repository's full applicable validation.
3. Exercise the final changed surface.
4. Send a sanitized final review packet in the same persistent Codex thread. Include the execution-scoped diff from the recorded baseline, changed-path list, exact validation output, and runtime evidence. Exclude unrelated baseline changes and all protected content listed above.

Require the evidence contract for every concern and this exact response when no concerns remain:

```text
FINAL APPROVED -- No verified blocking findings.
```

Treat the final review output as claims, not proof. Fable must independently verify every cited source and reconstruct each concern using the evidence contract before it can block. Missing evidence makes the item nonblocking.

Use the same accept, reject, and counter rules. Dispatch at most three reviewer-driven Opus fixers during final review; after each accepted fix, re-run full verification and send a fix re-review packet (the findings being fixed plus the filtered fix delta and new validation output), not a new full packet. If a verified blocker remains after the third fix attempt, stop for user resolution.

## Final approval gate

Present:

- Plan path and baseline.
- Completed steps.
- Changed files.
- Exact validation commands and observed outcomes.
- Runtime smoke-test evidence.
- Accepted, rejected, and countered findings.
- Unverified questions and residual risks.
- Final Codex review outcome, actual model, and actual effort.
- Complete working-tree status.

If the user cancels, stop the current invocation, leave all reviewed and unreviewed working-tree changes visible and uncommitted, and report `CANCELLED — NOT APPROVED`. Cancellation creates no durable resume state and is not approval.

Otherwise ask whether to commit and push. Until the user explicitly approves, do neither.

If approved, create only the requested commit or commits and push only the requested branch. If declined, leave the reviewed work uncommitted and report how to inspect it.

## Quick reference

| Responsibility | Owner |
|---|---|
| Plan, step contracts, validation, evidence checks | Fable |
| Implementation and accepted fixes | Fresh Opus subagent |
| Adversarial review | Configured Codex reviewer |
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
| "Codex probably checked the line." | Fable opens the current source. |
| "Better safe than sorry." | Unsupported changes create risk; verify first. |
| "Both models agree." | Agreement is not evidence. |
| "The deadline makes staging harmless." | Staging changes review scope and user state. |
| "This convention is industry standard." | Repository instructions control. |
| "It is only a minor automatic commit." | The user owns commit boundaries. |
| "Codex withheld the approval phrase, so the hypothesis blocks." | Completion depends on verified blockers, not wording. |

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
