---
name: execute
description: Supervised plan execution with Codex oversight and subagent implementation. Dispatches fresh subagents per step with two-stage review (spec compliance + code quality) before Codex review. Pass the path to the plan file as the argument.
---

# Supervised Plan Execution with Codex Oversight + Subagent Implementation

Executes an approved plan continuously. Dispatches a fresh implementer subagent per step, runs two-stage review (spec compliance + code quality), then sends each diff to Codex for final review. Presents a complete summary for user approval before the final commit and push.

## Arguments

`$ARGUMENTS` should be the path to the plan file. If not provided, look for a plan file in the current session context (e.g., recently written plan files, `.claude/` directory, or the working directory). If you cannot find a plan file, ask the user.

## Configuration

- **Max review rounds per step**: 3 (for [minor] concerns only -- [critical] concerns always escalate to user)
- **Max spec/quality review loops**: 3 per reviewer per step
- **Max verification rounds**: 5
- **Shell command timeout**: 120s for validation gates, 30s for git operations

## Codex Transport

This skill invokes Codex via the **App Server protocol** using the official OpenAI transport layer (shared broker connection, proper streaming, notification handling). The transport script lives at `${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs`.

**Uses your Codex CLI session (OAuth) with `xhigh` reasoning effort.** No API keys or model config needed.

### How to call Codex

**New thread / turn** (returns `threadId` and `response`):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd "$(pwd)" --prompt "YOUR PROMPT HERE"
```

**Continue thread** (subsequent calls -- uses existing `threadId`):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd "$(pwd)" --thread-id THREAD_ID --prompt "YOUR PROMPT HERE"
```

**Native code review** (uses Codex's built-in `review/start` -- auto-detects git scope):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" review --cwd "$(pwd)" [--scope auto|working-tree|branch] [--base REF]
```

**Output format** (JSON on stdout, progress on stderr):
```json
{"threadId": "...", "response": "..."}
```

Parse the JSON output to extract `threadId` (save for subsequent calls within the same session) and `response` (Codex's review text). Progress messages appear on stderr prefixed with `[codex]`.

### When to use `turn` vs `review`

- **`turn`**: For sending prompts with plan context, step diffs, or custom review instructions. Used for step-by-step Codex reviews during execution.
- **`review`**: For the final full-diff verification (Step 5). Uses Codex's native code review which auto-collects git context efficiently. Preferred when reviewing actual code changes rather than sending a custom prompt.

## Shell Command Policy

All shell commands run during execution must follow these rules:
- **Explicit timeouts**: Use the Bash tool's timeout parameter (120s for tests/tsc/lint, 30s for git)
- **Non-interactive mode**: Use `CI=true`, `--ci`, `--no-interactive` flags where applicable
- **No watch mode**: Never use `--watch` or `--watchAll`. Use `--run` (vitest), `--watchAll=false` (jest)
- **Hang handling**: If a command exceeds its timeout, report to user with the command name and timeout, ask whether to skip validation or debug

## Subagent Strategy

Each step is implemented by a fresh subagent with isolated context. This preserves the orchestrator's context for coordination and review while giving implementers focused, clean working environments.

**Why subagents:**
- Fresh context per step -- no confusion from prior steps
- Orchestrator stays focused on coordination, not implementation details
- Subagents can ask questions before starting work
- Failed steps don't pollute context for subsequent steps

**Three review layers per step:**
1. **Spec compliance review** (subagent) -- Did the implementer build what was requested? Nothing more, nothing less.
2. **Code quality review** (subagent) -- Is the implementation well-built, clean, tested, maintainable?
3. **Codex review** (external) -- Final check against plan alignment and desloppify standards.

**Model selection:**
- **opus** -- Default for all implementer subagents and all reviewers. Business logic, API routes, integrations, auth, payments, and anything touching backend code.
- **sonnet** -- Only for pure frontend presentation tasks: styling tweaks, layout changes, component markup with a clear spec and no business logic. When in doubt, use opus.

## Step 1: Read the Plan and Prepare

1. Read the plan file at the path provided in `$ARGUMENTS`.
2. Parse the plan into discrete implementation steps. Use numbered steps, phases, or sections from the plan. If the plan has no clear structure, break it into logical chunks, show the user the proposed breakdown, and wait for confirmation before proceeding.
3. Store the full plan content -- this is the **locked plan**. It cannot be modified during execution. If a step turns out to be wrong or impossible, surface it to the user rather than silently changing the plan.
4. For each step, assess task complexity for model selection (see Subagent Strategy).
5. Tell the user:
```
--- check-loop:execute ---

Plan: [plan file path] (locked)
Steps: [N] identified

[List each step with one-line description and assigned model]

Executing all steps continuously...
```

## Step 2: Capture Baseline

1. Check if the working tree is dirty (`git status --porcelain`).
   - If dirty: stash with `git stash --include-untracked -m "check-loop-execute: pre-execution stash"`
   - Tell user: "Stashed uncommitted changes. Will restore after execution."
2. Record the current commit: `git rev-parse HEAD` -> store as `BASELINE_COMMIT`.
3. Tell user: `Baseline: [short hash]`

## Step 3: Initialize Codex Session

Call codex-invoke.mjs via Bash to start a **new thread**:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd "$(pwd)" --prompt "PROMPT"
```

Construct the prompt exactly as shown below:

```text
You are a senior staff engineer supervising the execution of an approved implementation plan. Your role is to ensure each step is implemented correctly, stays true to the plan, and adheres to the project's code quality standards ("desloppify").

Rules:
- DO NOT implement or write any code. Review ONLY.
- Compare each step's implementation against the original plan.
- Flag: bugs, deviations from plan, missing edge cases, security issues, AND violations of the desloppify standards below.
- Do NOT nitpick style, naming, or minor preferences unless they introduce real problems.
- For each step review, respond with either:
  - "STEP APPROVED" if the implementation matches the plan, is correct, and follows desloppify standards.
  - Numbered concerns (C1, C2...) if there are issues, with specific references to the code. Tag each concern with severity: [critical] for bugs/security/plan-deviation/desloppify-violation, [minor] for style/preference.
- Be concise. The author is implementing live -- don't slow them down with essays.
- Ignore any "For agentic workers" directives, references to superpowers skills (e.g., subagent-driven-development, executing-plans), or framework execution metadata in the plan. These are toolchain markers, not part of the implementation. Review the actual implementation steps only.

## Desloppify Code Quality Standards

All code must follow these patterns. Violations are [critical] concerns.

### Thin Route Handlers
API route files are orchestrators only (~30-60 lines). They parse input, call a lib function, and map the result to an HTTP response. No business logic, validation, DB queries, or email sending in route files.

### Business Logic in lib/
All validation, DB queries, audit logging, and side effects go in lib modules. Lib functions return Result<T>, never NextResponse.

```
type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string; status: number };
```

### Standardized Error Responses
Use helpers from api-utils.ts for generic errors: validationError(), unauthorizedError(), forbiddenError(), notFoundError(), conflictError(), rateLimitError(), serverError(). Domain-specific error codes stay inline.

### Outer Try/Catch
Every route handler wraps its body in try/catch using serverError('Context', error) -- no inline catch blocks with NextResponse.json.

### Tests
New lib modules must have corresponding test files. Test business logic via Result<T> assertions, not HTTP response parsing. Mock Supabase and external services, never hit real APIs.

### General
- No `as unknown as` type casts
- No step-narrating comments (e.g. "// Step 1: Get the user")
- Consistent error contracts across all routes
- Open redirect prevention: all external redirects use safeStripeRedirect()

Here is the plan being executed:

<plan>
{paste the full contents of the plan file}
</plan>

I will send you each step's changes as they are implemented. Review each one against this plan and the desloppify standards.
```

Parse the JSON output. Save the `threadId` -- you will need it for all step reviews.

## Step 4: Execute All Steps Continuously

For each step (1 through N), do the following **without stopping for user input**:

### 4a. Announce Step

Print a brief status line:
```
Step [N] of [M]: [one-line description from plan] (model: [opus/sonnet])
```

### 4b. Dispatch Implementer Subagent

Dispatch a fresh subagent using the Agent tool to implement this step. Use the template in `./implementer-prompt.md` to construct the prompt.

**Provide the subagent with:**
- Full text of this step from the plan (paste it, don't make subagent read the plan file)
- Scene-setting context: where this step fits in the overall plan, what prior steps produced, any dependencies
- Working directory
- The desloppify standards (included in the implementer prompt template)

**Select model** based on task complexity (see Subagent Strategy section).

**Important:** The subagent must stage changes (`git add`) but NOT commit. The orchestrator manages commits after all reviews pass.

### 4c. Handle Implementer Status

The implementer subagent reports one of four statuses:

**DONE:** Proceed to validation gates (4d).

**DONE_WITH_CONCERNS:** Read the concerns before proceeding. If concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed to validation.

**NEEDS_CONTEXT:** The implementer needs information that wasn't provided. Gather the missing context (read files, check git history, etc.) and re-dispatch a fresh subagent with the additional information.

**BLOCKED:** The implementer cannot complete the step. Assess the blocker:
1. If it's a context problem, provide more context and re-dispatch
2. If the task requires more reasoning, re-dispatch with a more capable model
3. If the task is too large, break it into smaller pieces and dispatch subagents for each piece sequentially
4. If the plan itself is wrong, escalate to user: "Step N is blocked: [reason]. Options: skip it, modify the plan, or abort."

**Never** ignore an escalation or force the same model to retry without changes. If the implementer said it's stuck, something needs to change.

### 4d. Run Validation Gates

After implementation, run applicable checks (all with explicit timeouts per Shell Command Policy):

1. **TypeScript**: If the project uses TypeScript, run `npx tsc --noEmit` (timeout: 120s)
2. **Tests**: If the project has tests, run the test command (e.g., `npx vitest --run`, timeout: 120s)
3. **Lint**: If lint is configured, run lint (timeout: 120s)

Report results inline:
```
Validation: tests [pass/fail/skipped] | tsc [pass/fail/skipped] | lint [pass/fail/skipped]
```

If a gate fails: dispatch a fresh fix subagent with the error output and instructions to fix it. After the fix subagent completes, re-run validation gates. If validation still fails after 3 fix attempts, escalate to user.

If a gate command hangs past timeout: report to user and ask whether to skip or debug.

### 4e. Spec Compliance Review

Dispatch a spec compliance reviewer subagent using `model: "opus"` and the template in `./spec-reviewer-prompt.md`.

**Provide:**
- Full text of this step's requirements from the plan
- The implementer's report of what they built
- List of files changed
- Working directory (so reviewer can read the actual code)

**If SPEC_COMPLIANT:** Proceed to code quality review (4f).

**If SPEC_ISSUES:** Dispatch a fresh fix subagent with:
- The specific issues found by the spec reviewer
- The original step requirements
- Instructions to fix only the identified gaps

After the fix subagent completes:
1. Re-run validation gates (4d)
2. Re-dispatch spec compliance reviewer
3. Max 3 spec review loops. After 3 loops with unresolved issues, escalate to user.

**Important:** Do NOT proceed to code quality review until spec compliance passes.

### 4f. Code Quality Review

Dispatch a code quality reviewer subagent using `model: "opus"` and the template in `./code-quality-reviewer-prompt.md`.

**Provide:**
- The implementer's report
- Step requirements from the plan
- List of files changed
- Working directory (so reviewer can read the actual code)

**If QUALITY_APPROVED:** Proceed to Codex review (4h).

**If QUALITY_ISSUES:**
- **[critical] issues:** Dispatch a fresh fix subagent. After fix, re-run validation (4d), re-dispatch quality reviewer.
- **[important] issues:** Dispatch a fresh fix subagent. After fix, re-dispatch quality reviewer.
- **[minor] issues:** Log them and proceed.
- Max 3 quality review loops. After 3 loops, log remaining disagreements and proceed.

### 4g. Capture Step Diff

Stage all changes (including new files) and generate the diff for this step only:

```bash
git add -A
git diff --cached HEAD
```

**Secret filtering**: Before sending to Codex, exclude files matching: `*.env*`, `*.secret*`, `*credentials*`, `**/secrets/**`. Keep the full unfiltered diff locally.

### 4h. Send Diff to Codex for Review

Call codex-invoke.mjs via Bash, **continuing the existing thread**:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd "$(pwd)" --thread-id THREAD_ID --prompt "PROMPT"
```

Construct the prompt as shown below:

```text
Step {N} of {M}: {step description from plan}

Here is what was implemented:

<changes>
{filtered git diff --cached HEAD for this step}
</changes>

Validation results:
- Tests: {pass/fail/skipped}
- TypeScript: {pass/fail/skipped}
- Lint: {pass/fail/skipped}

Subagent review results:
- Spec compliance: {SPEC_COMPLIANT / SPEC_COMPLIANT after N fix rounds}
- Code quality: {QUALITY_APPROVED / QUALITY_APPROVED after N fix rounds}

Does this implementation match what the plan specifies for this step? Review for correctness, bugs, plan alignment, and desloppify standards compliance.
```

### 4i. Handle Codex Response

**If "STEP APPROVED"**: Create a step commit and move to the next step:
```bash
git commit -m "step {N}: {short description}"
```

**If concerns raised**: For EVERY numbered concern, make a judgment:

1. **ACCEPT** -- Valid bug, security issue, or plan deviation. Dispatch a fresh fix subagent to fix it, re-run validation gates (4d), re-capture diff (4g), re-send to Codex (4h).

2. **REJECT** -- Style preference, overkill, or incorrect assumption. Push back with specific reasoning and move on.

**Severity rules:**
- **[minor] concerns** (style, naming, preferences): Max 3 review rounds per step. After 3 rounds with unresolved [minor] items, log the disagreement and commit.
- **[critical] concerns** (security, bugs, plan deviations): Do NOT auto-resolve. Escalate to user: "Codex flagged a [critical] concern on step N: [details]. How do you want to proceed?"

After resolution, commit:
```bash
git commit -m "step {N}: {short description}"
```

### 4j. Report Step Status (inline)

```
Step N: COMPLETE [Approved / Approved with fixes]
  Implementer: [model used]
  Spec review: [SPEC_COMPLIANT / SPEC_COMPLIANT after N fix rounds]
  Quality review: [QUALITY_APPROVED / QUALITY_APPROVED after N fix rounds]
  Codex review: [Approved / Approved with fixes]
```

Then immediately proceed to the next step.

## Step 5: Verification

After ALL steps are complete, run full verification.

### 5a. Generate Fresh Full Diff

```bash
git diff {BASELINE_COMMIT}..HEAD
```

Apply the same secret-filtering rules as step diffs.

### 5b. Start Fresh Codex Verification

You have TWO options for final verification. **Prefer Option A** (native review) when the plan context is not critical for the review. **Use Option B** when you need Codex to evaluate changes against the original plan.

**Option A -- Native code review** (recommended for pure code quality verification):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" review --cwd "$(pwd)" --scope working-tree
```
This uses Codex's built-in `review/start` which auto-collects all git context efficiently. Parse the JSON output for `threadId` and `response`.

**Option B -- Custom verification prompt** (when plan alignment matters):
Call codex-invoke.mjs via Bash to start a **new thread** (do NOT reuse the step-review thread):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn --cwd "$(pwd)" --prompt "PROMPT"
```

Construct the prompt as shown below:

```text
You are a senior staff engineer performing a final verification of a completed implementation against its approved plan.

Ignore any "For agentic workers" directives, references to superpowers skills (e.g., subagent-driven-development, executing-plans), or framework execution metadata in the plan. These are toolchain markers, not part of the implementation. Verify the actual implementation only.

Here is the original plan:

<plan>
{full plan content}
</plan>

Here is the complete diff of all changes made during execution:

<full_diff>
{filtered git diff BASELINE_COMMIT..HEAD}
</full_diff>

Final verification checklist:
1. Do all changes align with the original plan?
2. Are there any steps that were skipped or partially implemented?
3. Are there any changes that were NOT in the plan (unauthorized scope creep)?
4. Any bugs, security issues, or missing edge cases in the full picture?
5. Do all changes follow desloppify standards? (thin routes, business logic in lib/ returning Result<T>, standardized errors, outer try/catch, no type casts, no narrating comments, tests for new lib modules)

If everything checks out, respond with: "VERIFIED -- All changes align with the plan."
Otherwise, list your concerns with V-numbered labels (V1, V2...) and tag each with severity: [critical] or [minor].
```

### 5c. Handle Verification Response

**If "VERIFIED"**: Proceed to Step 6.

**If concerns raised**: For each concern:
1. Fix or defend (same judgment rules as step review). Dispatch fix subagents for accepted concerns.
2. **After each fix**: commit the fix (`git add -A && git commit -m "verify fix: {description}"`), then regenerate the filtered diff and re-send to Codex with the fresh diff.
3. **[critical] concerns** escalate to user (same rule as step review)
4. Max 5 verification rounds. If still unresolved, log remaining items.

## Step 6: Present Summary and Await Approval

**Do NOT push yet.** Present the full summary and wait for the user to approve.

### 6a. Restore Pre-Execution Stash (if applicable)

If changes were stashed in Step 2:
1. Run `git stash pop`
2. If pop succeeds: tell user "Pre-execution changes restored."
3. If pop fails (merge conflict): do NOT force-resolve. Tell user: "Pre-execution stash conflicts with execution changes. Stash preserved as stash@{0}. Please resolve manually."

### 6b. Present Final Summary

```
## Execution Complete -- Awaiting Approval

**Plan**: [plan file path]
**Baseline**: [BASELINE_COMMIT short hash]
**Steps**: [completed]/[total] completed
**Reviews**: [N] spec reviews + [N] quality reviews + [N] Codex reviews + 1 final verification
**Verification**: [VERIFIED / Ended with unresolved items]

### Steps Summary
| Step | Description | Model | Spec | Quality | Codex | Outcome |
|------|-------------|-------|------|---------|-------|---------|
| 1 | [desc] | [model] | [result] | [result] | [result] | [outcome] |
| 2 | [desc] | [model] | [result] | [result] | [result] | [outcome] |
...

### Fixes from Reviews
- Step N [reviewer] [severity]: [what was fixed]
(or "None")

### Unresolved Disagreements (if any)
- [concern]: [both perspectives]
(or "None")

### Commits Created
[list of commit hashes and messages from BASELINE_COMMIT..HEAD]

Ready to push to remote? (y/n)
```

### 6c. Wait for User Approval

Use `AskUserQuestion` to ask: "Push these commits to remote? (y/n)"

- **If yes**: Run `git push` and confirm success.
- **If no**: Tell user: "Commits are local. You can review with `git log {BASELINE_COMMIT}..HEAD` and push when ready."

## Edge Cases

### Step is impossible or blocked
If a step can't be implemented (missing dependency, conflicting code, etc.):
1. Do NOT silently modify the plan.
2. Tell user: "Step N is blocked: [reason]. Options: skip it, modify the plan, or abort."
3. Wait for user input -- no timeout.

### Implementer subagent asks questions
Answer clearly and completely from your knowledge of the plan and codebase. Provide additional context files if needed. Re-dispatch a fresh subagent with the answers included in the prompt.

### Implementer repeatedly fails
If an implementer subagent fails the same step twice:
1. First retry: re-dispatch with more context
2. Second retry: re-dispatch with a more capable model
3. Third failure: escalate to user with full details of what's been tried

### Codex disagrees with plan-matching implementation
If Codex says "this is wrong" but the implementation matches the plan exactly, defend: "This matches the approved plan (section X). The plan was already reviewed. Moving on."

### Subagent reviewer disagrees with Codex
If a subagent reviewer approved something that Codex flags (or vice versa), evaluate the concern independently. Each reviewer has different strengths -- subagent reviewers read the actual code, Codex reviews the diff. Use your judgment.

### User aborts mid-execution
If the user asks to stop:
1. Commit any in-progress work as a partial step.
2. Restore stash if applicable (with conflict handling).
3. Present a partial summary showing which steps completed and which didn't.

## How To Treat Codex Responses

- Codex is a **peer reviewer**, not an authority. You know the plan and codebase context better.
- Fight for correct implementations. Do not capitulate just because Codex pushed back twice.
- If Codex keeps re-raising the same rejected [minor] point without new reasoning, say "Already addressed -- moving on."
- If Codex raises something you genuinely missed and it's clearly right, accept it immediately.
- The goal is correct implementation of the plan, not unanimous agreement at any cost.

## How To Treat Subagent Responses

- Subagents are **specialists** with fresh, focused context. Trust their domain expertise.
- If an implementer reports BLOCKED or NEEDS_CONTEXT, something genuinely needs to change. Don't retry the same thing.
- If a spec reviewer flags missing requirements, verify by reading the code yourself before dispatching a fix. The reviewer reads actual code -- take their findings seriously.
- If a code quality reviewer flags issues, evaluate severity honestly. Don't downgrade [critical] to [minor] to avoid a fix round.
- Fix subagents should get specific instructions about what to fix and why. Don't just say "fix the issues" -- list them explicitly.
- Never dispatch multiple implementation subagents in parallel for the same step (they'll conflict). Sequential only.
