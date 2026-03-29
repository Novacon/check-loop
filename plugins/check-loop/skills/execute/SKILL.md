---
name: execute
description: Supervised plan execution with Codex oversight. Executes an approved plan continuously without stopping between steps, then presents a final summary for user approval before committing and pushing. Use after /check-loop has refined a plan, or on any plan you want to execute with review guardrails. Pass the path to the plan file as the argument.
---

# Supervised Plan Execution with Codex Oversight

Executes an approved plan continuously. Implements all steps, sends each diff to Codex for review, fixes issues inline, then presents a complete summary for user approval before the final commit and push.

## Arguments

`$ARGUMENTS` should be the path to the plan file. If not provided, look for a plan file in the current session context (e.g., recently written plan files, `.claude/` directory, or the working directory). If you cannot find a plan file, ask the user.

## Configuration

- **Max review rounds per step**: 3 (for [minor] concerns only -- [critical] concerns always escalate to user)
- **Max verification rounds**: 5
- **Shell command timeout**: 120s for validation gates, 30s for git operations

## Shell Command Policy

All shell commands run during execution must follow these rules:
- **Explicit timeouts**: Use the Bash tool's timeout parameter (120s for tests/tsc/lint, 30s for git)
- **Non-interactive mode**: Use `CI=true`, `--ci`, `--no-interactive` flags where applicable
- **No watch mode**: Never use `--watch` or `--watchAll`. Use `--run` (vitest), `--watchAll=false` (jest)
- **Hang handling**: If a command exceeds its timeout, report to user with the command name and timeout, ask whether to skip validation or debug

## Step 1: Read the Plan and Prepare

1. Read the plan file at the path provided in `$ARGUMENTS`.
2. Parse the plan into discrete implementation steps. Use numbered steps, phases, or sections from the plan. If the plan has no clear structure, break it into logical chunks, show the user the proposed breakdown, and wait for confirmation before proceeding.
3. Store the full plan content -- this is the **locked plan**. It cannot be modified during execution. If a step turns out to be wrong or impossible, surface it to the user rather than silently changing the plan.
4. Tell the user:
```
--- check-loop:execute ---

Plan: [plan file path] (locked)
Steps: [N] identified

[List each step with one-line description]

Executing all steps continuously...
```

## Step 2: Capture Baseline

1. Check if the working tree is dirty (`git status --porcelain`).
   - If dirty: stash with `git stash --include-untracked -m "check-loop-execute: pre-execution stash"`
   - Tell user: "Stashed uncommitted changes. Will restore after execution."
2. Record the current commit: `git rev-parse HEAD` -> store as `BASELINE_COMMIT`.
3. Tell user: `Baseline: [short hash]`

## Step 3: Initialize Codex Session

Call `mcp__codex-cli__codex` with:

- `model`: `gpt-5.4`
- `reasoningEffort`: `xhigh`
- `sandbox`: `read-only`
- `workingDirectory`: (use the current working directory)
- `prompt`: construct exactly as shown below

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

Save the `sessionId` from the response -- you will need it for all step reviews.

## Step 4: Execute All Steps Continuously

For each step (1 through N), do the following **without stopping for user input**:

### 4a. Announce Step

Print a brief status line:
```
Step [N] of [M]: [one-line description from plan]
```

### 4b. Implement the Step

Write the code, create files, edit files, run commands -- whatever the plan calls for.

### 4c. Run Validation Gates

After implementing, run applicable checks (all with explicit timeouts per Shell Command Policy):

1. **TypeScript**: If the project uses TypeScript, run `npx tsc --noEmit` (timeout: 120s)
2. **Tests**: If the project has tests, run the test command (e.g., `npx vitest --run`, timeout: 120s)
3. **Lint**: If lint is configured, run lint (timeout: 120s)

Report results inline:
```
Validation: tests [pass/fail/skipped] | tsc [pass/fail/skipped] | lint [pass/fail/skipped]
```

If a gate fails critically: fix the issue before proceeding to Codex review. If a gate command hangs past timeout: report to user and ask whether to skip or debug.

### 4d. Capture Step Diff

Stage all changes (including new files) and generate the diff for this step only:

```bash
git add -A
git diff --cached HEAD
```

**Secret filtering**: Before sending to Codex, exclude files matching: `*.env*`, `*.secret*`, `*credentials*`, `**/secrets/**`. Keep the full unfiltered diff locally.

### 4e. Send Diff to Codex for Review

Use `mcp__codex-cli__codex` with:

- `sessionId`: (from Step 3)
- `model`: `gpt-5.4`
- `reasoningEffort`: `xhigh`
- `prompt`: construct as shown below

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

Does this implementation match what the plan specifies for this step? Review for correctness, bugs, plan alignment, and desloppify standards compliance.
```

### 4f. Handle Codex Response

**If "STEP APPROVED"**: Create a step commit and move to the next step:
```bash
git commit -m "step {N}: {short description}"
```

**If concerns raised**: For EVERY numbered concern, make a judgment:

1. **ACCEPT** -- Valid bug, security issue, or plan deviation. Fix it, re-run validation gates (4c), re-capture diff (4d), re-send to Codex (4e).

2. **REJECT** -- Style preference, overkill, or incorrect assumption. Push back with specific reasoning and move on.

**Severity rules:**
- **[minor] concerns** (style, naming, preferences): Max 3 review rounds per step. After 3 rounds with unresolved [minor] items, log the disagreement and commit.
- **[critical] concerns** (security, bugs, plan deviations): Do NOT auto-resolve. Escalate to user: "Codex flagged a [critical] concern on step N: [details]. How do you want to proceed?"

After resolution, commit:
```bash
git commit -m "step {N}: {short description}"
```

### 4g. Report Step Status (inline)

```
Step N: COMPLETE [Approved / Approved with fixes]
```

Then immediately proceed to the next step.

## Step 5: Verification

After ALL steps are complete, run full verification.

### 5a. Generate Fresh Full Diff

```bash
git diff {BASELINE_COMMIT}..HEAD
```

Apply the same secret-filtering rules as step diffs.

### 5b. Start Fresh Codex Session

Call `mcp__codex-cli__codex` (NEW session -- do NOT reuse the step-review session) with:

- `model`: `gpt-5.4`
- `reasoningEffort`: `xhigh`
- `sandbox`: `read-only`
- `workingDirectory`: (use the current working directory)
- `prompt`:

```text
You are a senior staff engineer performing a final verification of a completed implementation against its approved plan.

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
1. Fix or defend (same judgment rules as step review)
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
**Codex reviews**: [N] step reviews + 1 final verification
**Verification**: [VERIFIED / Ended with unresolved items]

### Steps Summary
1. [status] [description] -- [outcome]
2. [status] [description] -- [outcome]
...

### Fixes from Codex Review
- Step N [severity]: [what was fixed]
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

### Codex disagrees with plan-matching implementation
If Codex says "this is wrong" but the implementation matches the plan exactly, defend: "This matches the approved plan (section X). The plan was already reviewed. Moving on."

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
