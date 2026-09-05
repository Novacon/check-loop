# Fable–Opus–Sol Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release and install `check-loop` 4.0.0 with Fable 5.1 orchestrating, Opus 5 subagents implementing, and GPT-5.6 Sol reviewing the plan and every implementation step.

**Architecture:** Claude Code skill frontmatter selects the `fable` alias with `xhigh` effort for both workflows. Fresh `opus` subagents implement or fix one plan step at a time; the Fable parent runs validation and adjudicates findings from one persistent, read-only `gpt-5.6-sol` App Server thread. The old Opus reviewer stages, Sonnet path, automatic stashing, step commits, and project-specific rules are removed.

**Tech Stack:** Claude Code plugin skills, Node.js ESM, Node built-in test runner, Codex App Server, Git, JSON plugin manifests.

**Spec:** `docs/superpowers/specs/2026-09-05-fable-opus-sol-orchestration-design.md`

## Global Constraints

- Orchestrator: skill frontmatter `model: fable` and `effort: xhigh`.
- Implementer and fixer: Agent tool `model: "opus"`; no Sonnet implementation path.
- Reviewer: `gpt-5.6-sol` with `xhigh` effort through the existing read-only App Server transport.
- Sol is the only dedicated execution reviewer; Fable adjudicates every Sol finding.
- Every Sol concern carries severity, verification status, claim, exact evidence, impact, failure condition, and recommended correction.
- Only independently checked `VERIFIED` critical or important findings may block; model agreement is not evidence.
- Never silently downgrade a required model.
- Never stash, discard, stage, commit, or push unrelated work.
- Never automatically commit or push before final user approval.
- Preserve OAuth, broker reuse, streaming, persistent threads, and secret filtering.
- Use repository-native instructions and validation; remove PMO-specific quality rules.
- Version every plugin and marketplace declaration as `4.0.0`.

## File structure

- Create `tests/orchestration-contract.test.mjs`: executable contract tests for model selection, manifests, skill frontmatter, pipeline roles, and removed legacy behavior.
- Modify `plugins/check-loop/scripts/codex-invoke.mjs`: pin Sol and expose that pin in `help` and `setup` output.
- Modify `plugins/check-loop/skills/check-loop/SKILL.md`: make Fable the plan-refinement owner and Sol the named adversarial peer.
- Modify `plugins/check-loop/skills/execute/SKILL.md`: replace the multi-review pipeline with Fable → Opus → validation → Sol.
- Modify `plugins/check-loop/skills/execute/implementer-prompt.md`: make Opus-only implementation repository-driven and forbid staging/commits.
- Delete `plugins/check-loop/skills/execute/spec-reviewer-prompt.md`: obsolete Opus reviewer prompt.
- Delete `plugins/check-loop/skills/execute/code-quality-reviewer-prompt.md`: obsolete Opus reviewer prompt.
- Modify `plugins/check-loop/plugin.json`: publish version and architecture metadata.
- Modify `.claude-plugin/marketplace.json`: publish matching marketplace metadata.
- Modify `README.md`: document v4 roles, workflow, safety boundaries, setup, and usage.

---

### Task 1: Lock the Sol transport and package version

**Files:**
- Create: `tests/orchestration-contract.test.mjs`
- Modify: `plugins/check-loop/scripts/codex-invoke.mjs:39-44,159-163,197-209`
- Modify: `plugins/check-loop/plugin.json:1-8`
- Modify: `.claude-plugin/marketplace.json:1-19`

**Interfaces:**
- Consumes: existing `codex-invoke.mjs help` and `setup` CLI surfaces.
- Produces: transport constant `MODEL = "gpt-5.6-sol"`, `EFFORT = "xhigh"`; manifest version `4.0.0`; reusable Node contract-test helpers.

- [ ] **Step 1: Add failing transport and manifest contract tests**

Create `tests/orchestration-contract.test.mjs` with Node built-ins only:

```js
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const readJson = (path) => JSON.parse(read(path));

function frontmatter(path) {
  const match = read(path).match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, `${path} must have YAML frontmatter`);
  return match[1];
}

test("transport pins GPT-5.6 Sol at xhigh", () => {
  const output = execFileSync(
    process.execPath,
    [join(ROOT, "plugins/check-loop/scripts/codex-invoke.mjs"), "help"],
    { encoding: "utf8" },
  );
  assert.match(output, /Model: gpt-5\.6-sol \| Effort: xhigh/);
  assert.doesNotMatch(output, /CLI default/);
});

test("plugin and marketplace publish version 4.0.0", () => {
  const plugin = readJson("plugins/check-loop/plugin.json");
  const marketplace = readJson(".claude-plugin/marketplace.json");
  assert.equal(plugin.version, "4.0.0");
  assert.equal(marketplace.metadata.version, "4.0.0");
  assert.equal(marketplace.plugins[0].version, "4.0.0");
});
```

- [ ] **Step 2: Run the focused tests and verify red state**

Run:

```bash
node --test --test-name-pattern='transport pins|publish version' tests/orchestration-contract.test.mjs
```

Expected: two failures. The transport reports `(CLI default)` and both manifests report `3.1.0`.

- [ ] **Step 3: Pin the transport model**

In `plugins/check-loop/scripts/codex-invoke.mjs`, replace the nullable model configuration with:

```js
// Model contract -- Sol reviews every plan and implementation step.
const MODEL = "gpt-5.6-sol";
const EFFORT = "xhigh";
```

Keep both `runAppServerTurn` and `runAppServerReview` calls passing `model: MODEL`. Simplify output to use the non-null value:

```js
`Model: ${MODEL}`,
```

and:

```js
`Model: ${MODEL} | Effort: ${EFFORT}`,
```

- [ ] **Step 4: Bump both manifests to 4.0.0**

Set `version` in `plugins/check-loop/plugin.json`, `metadata.version` in `.claude-plugin/marketplace.json`, and `.claude-plugin/marketplace.json`'s plugin entry version to `4.0.0`. Update descriptions to name the architecture directly:

```json
"description": "Fable-orchestrated plan refinement and execution with Opus implementers and GPT-5.6 Sol review"
```

- [ ] **Step 5: Run the focused tests and verify green state**

Run:

```bash
node --test --test-name-pattern='transport pins|publish version' tests/orchestration-contract.test.mjs
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 6: Commit the model and packaging contract**

```bash
git add tests/orchestration-contract.test.mjs plugins/check-loop/scripts/codex-invoke.mjs plugins/check-loop/plugin.json .claude-plugin/marketplace.json
git commit -m "feat: pin Fable Opus Sol model contract"
```

### Task 2: Make Fable own adversarial plan refinement

**Files:**
- Modify: `tests/orchestration-contract.test.mjs`
- Modify: `plugins/check-loop/skills/check-loop/SKILL.md:1-204`

**Interfaces:**
- Consumes: pinned `codex-invoke.mjs turn` JSON `{ threadId, response }`.
- Produces: `/check-loop` running on `fable`/`xhigh`, one persistent Sol thread, `ACCEPT | REJECT | COUNTER` adjudication, and `PLAN APPROVED` convergence.

- [ ] **Step 1: Add a failing plan-skill contract test**

Append:

```js
test("plan refinement is owned by Fable against Sol", () => {
  const path = "plugins/check-loop/skills/check-loop/SKILL.md";
  const yaml = frontmatter(path);
  const body = read(path);
  assert.match(yaml, /^model: fable$/m);
  assert.match(yaml, /^effort: xhigh$/m);
  assert.match(body, /GPT-5\.6 Sol/);
  assert.match(body, /PLAN APPROVED/);
  assert.match(body, /ACCEPT/);
  assert.match(body, /REJECT/);
  assert.match(body, /COUNTER/);
  assert.match(body, /VERIFIED \| INFERENCE \| UNVERIFIED/);
  assert.match(body, /Evidence: exact plan quote, file:line, or command output/);
  assert.match(body, /Only VERIFIED.*may block/is);
  assert.match(body, /independently verify/i);
  assert.doesNotMatch(body, /Codex CLI default/);
});
```

- [ ] **Step 2: Run the focused test and verify red state**

Run:

```bash
node --test --test-name-pattern='plan refinement' tests/orchestration-contract.test.mjs
```

Expected: failure because the existing skill lacks Fable model and effort frontmatter and does not name GPT-5.6 Sol.

- [ ] **Step 3: Rewrite the plan-refinement skill around explicit roles**

Use this frontmatter:

```yaml
---
name: check-loop
description: Refines an implementation plan through an adversarial loop between Fable and GPT-5.6 Sol. Use when a plan needs architecture review, assumption checking, simplification, or consensus before implementation.
model: fable
effort: xhigh
argument-hint: [plan-path]
---
```

Keep the existing App Server invocation syntax and JSON parsing contract. Rewrite the body as a concise imperative workflow with these required sections:

````markdown
# Fable–Sol plan refinement

Use Fable as plan owner and GPT-5.6 Sol as an adversarial peer. Improve the plan rather than maximizing agreement.

## Preconditions

- Read the plan and original request.
- Stop if Claude Code reports that the `fable` skill model was rejected or replaced.
- Run `codex-invoke.mjs setup`; stop unless it reports `Model: gpt-5.6-sol`, `Reasoning effort: xhigh`, and `Status: ready`.

## Review loop

1. Start one Sol thread with the original request and complete plan.
2. Require numbered, evidence-based findings or `PLAN APPROVED -- No remaining concerns.`
3. Classify every finding as `ACCEPT`, `REJECT`, or `COUNTER`.
4. Apply only accepted changes to the plan file.
5. Send the adjudication and complete revised plan through the same thread ID.
6. Stop on approval or after 40 rounds; report unresolved disagreements at the limit.

Require every concern to use this complete contract:

```text
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:
```

State that only independently checked `VERIFIED` critical or important findings may change or block the plan. Treat `INFERENCE` and `UNVERIFIED` items as non-blocking questions; supply missing context and request another review instead of guessing.
````

Retain the exact initial and continuation prompt contracts, including numbered finding IDs, toolchain-marker exclusions, and plan-only scope. Replace generic “Claude” and “Codex” role labels with “Fable” and “Sol.”

- [ ] **Step 4: Run the focused test and verify green state**

Run:

```bash
node --test --test-name-pattern='plan refinement' tests/orchestration-contract.test.mjs
```

Expected: 1 test passes, 0 fail.

- [ ] **Step 5: Commit the plan-refinement workflow**

```bash
git add tests/orchestration-contract.test.mjs plugins/check-loop/skills/check-loop/SKILL.md
git commit -m "feat: run plan refinement with Fable and Sol"
```

### Task 3: Replace execution with Fable → Opus → Sol

**Files:**
- Modify: `tests/orchestration-contract.test.mjs`
- Modify: `plugins/check-loop/skills/execute/SKILL.md:1-505`
- Modify: `plugins/check-loop/skills/execute/implementer-prompt.md:1-106`
- Delete: `plugins/check-loop/skills/execute/spec-reviewer-prompt.md`
- Delete: `plugins/check-loop/skills/execute/code-quality-reviewer-prompt.md`

**Interfaces:**
- Consumes: approved plan, repository instructions, existing Agent tool, pinned `codex-invoke.mjs turn` and `review` commands.
- Produces: a Fable-owned step state machine: `IMPLEMENT → VALIDATE → SOL_REVIEW → FIX | APPROVE | ESCALATE`.

- [ ] **Step 1: Add failing execution-contract tests**

Replace the existing `node:fs` import with:

```js
import { existsSync, readFileSync } from "node:fs";
```

Append:

```js
test("execution uses Fable, Opus implementers, and Sol review only", () => {
  const path = "plugins/check-loop/skills/execute/SKILL.md";
  const yaml = frontmatter(path);
  const body = read(path);
  assert.match(yaml, /^model: fable$/m);
  assert.match(yaml, /^effort: xhigh$/m);
  assert.match(body, /model: "opus"/);
  assert.match(body, /GPT-5\.6 Sol/);
  assert.match(body, /STEP APPROVED/);
  assert.doesNotMatch(body, /model: "sonnet"/);
  assert.doesNotMatch(body, /spec-reviewer-prompt/);
  assert.doesNotMatch(body, /code-quality-reviewer-prompt/);
  assert.doesNotMatch(body, /git stash/);
  assert.doesNotMatch(body, /git add -A/);
  assert.doesNotMatch(body, /safeStripeRedirect|NextResponse|Supabase|Result<T>/);
  assert.match(body, /VERIFIED \| INFERENCE \| UNVERIFIED/);
  assert.match(body, /Only VERIFIED.*may block/is);
  assert.match(body, /independently verify/i);
});

test("implementer is Opus-only and leaves git ownership to Fable", () => {
  const body = read("plugins/check-loop/skills/execute/implementer-prompt.md");
  assert.match(body, /model: "opus"/);
  assert.match(body, /repository instructions/i);
  assert.match(body, /do not stage or commit/i);
  assert.doesNotMatch(body, /sonnet|safeStripeRedirect|NextResponse|Supabase|Result<T>/i);
});

test("legacy Opus reviewer prompts are removed", () => {
  assert.equal(
    existsSync(join(ROOT, "plugins/check-loop/skills/execute/spec-reviewer-prompt.md")),
    false,
  );
  assert.equal(
    existsSync(join(ROOT, "plugins/check-loop/skills/execute/code-quality-reviewer-prompt.md")),
    false,
  );
});
```

- [ ] **Step 2: Run the execution tests and verify red state**

Run:

```bash
node --test --test-name-pattern='execution uses|implementer is|legacy Opus' tests/orchestration-contract.test.mjs
```

Expected: all three fail against the v3 workflow.

- [ ] **Step 3: Rewrite the Opus implementer prompt**

Use one model path:

```text
Agent tool (general-purpose):
  model: "opus"
  description: "Implement assigned plan step"
```

Require the Fable orchestrator to supply the exact step, acceptance criteria, relevant prior-step context, repository instructions, working directory, and validation commands. Require the Opus agent to inspect existing patterns, implement only the named step, run only focused checks that do not interfere with concurrent work, and report:

```markdown
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Observable behavior implemented
- Files changed
- Checks run with exact results
- Remaining concerns
```

State exactly: `Do not stage or commit. Fable owns review scope and the final user approval gate.` Remove Sonnet selection and every project-specific rule.

- [ ] **Step 4: Rewrite the execution skill as one state machine**

Use this frontmatter:

```yaml
---
name: execute
description: Executes an approved plan with Fable orchestration, fresh Opus implementation subagents, repository-native validation, and GPT-5.6 Sol review of every step. Use after check-loop approves a plan or when the user requests supervised plan execution.
model: fable
effort: xhigh
argument-hint: [plan-path]
---
```

Implement these stages in the skill body:

```text
PREPARE
  Read plan and repository instructions.
  Stop if Claude Code reports that the fable skill model was rejected or replaced.
  Run Sol setup preflight and require the pinned model, effort, and ready status.
  Capture HEAD and working-tree state.
  If dirty, ask for worktree isolation or explicit inclusion; never stash.

FOR EACH STEP
  Snapshot working tree.
  Fable writes exact step contract.
  Fresh Opus subagent implements without staging.
  Fable runs repository-native validation.
  Fable computes the step-scoped diff from the snapshot and filters secrets.
  Sol reviews requirements + diff + validation in one persistent thread.
  Sol must emit the complete VERIFIED | INFERENCE | UNVERIFIED evidence contract.
  Fable independently checks cited plan text, file:line evidence, or command output.
  Only verified critical or important findings may block.
  Fable classifies every finding ACCEPT, REJECT, or COUNTER.
  Accepted blocking finding → fresh Opus fixer → validation → same Sol thread.
  STEP APPROVED → proceed.
  Three failed cycles or unresolved critical finding → ask user.

FINALIZE
  Run full project verification.
  Run native Sol full working-tree review.
  Present evidence and adjudication log.
  Ask before any commit or push.
```

Use `critical`, `important`, and `minor` severities. Define blocking as critical/important findings grounded in observable behavior, security, requirements, or repository maintainability. Minor preferences never block. Preserve transport failure handling, secret patterns (`*.env*`, `*.secret*`, `*credentials*`, `**/secrets/**`), stop handling without partial commits, and the exact `STEP APPROVED` signal.

- [ ] **Step 5: Delete obsolete reviewer prompts**

Delete both reviewer files. Do not retain aliases or deprecated copies.

- [ ] **Step 6: Run execution tests and verify green state**

Run:

```bash
node --test --test-name-pattern='execution uses|implementer is|legacy Opus' tests/orchestration-contract.test.mjs
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 7: Commit the execution pipeline**

```bash
git add tests/orchestration-contract.test.mjs plugins/check-loop/skills/execute
git commit -m "feat: orchestrate Opus implementation with Sol review"
```

### Task 4: Update public documentation

**Files:**
- Modify: `tests/orchestration-contract.test.mjs`
- Modify: `README.md:9-190`

**Interfaces:**
- Consumes: v4 model and workflow contracts from Tasks 1–3.
- Produces: installation and usage documentation that matches executable behavior.

- [ ] **Step 1: Add a failing README contract test**

Append:

```js
test("README documents the v4 orchestration contract", () => {
  const body = read("README.md");
  assert.match(body, /4\.0\.0/);
  assert.match(body, /Fable 5\.1/);
  assert.match(body, /Opus 5/);
  assert.match(body, /GPT-5\.6 Sol/);
  assert.match(body, /Fable.*Opus.*Sol/s);
  assert.match(body, /evidence gate/i);
  assert.match(body, /No evidence, no blocking finding/i);
  assert.doesNotMatch(body, /gpt-5\.4-codex|sonnet for pure frontend|three review layers/i);
});
```

- [ ] **Step 2: Run the README test and verify red state**

Run:

```bash
node --test --test-name-pattern='README documents' tests/orchestration-contract.test.mjs
```

Expected: failure because README still describes v3.1.0 and the old three-review pipeline.

- [ ] **Step 3: Rewrite README workflow and examples**

Document this concise flow:

```text
Plan:      Fable 5.1 ↔ GPT-5.6 Sol
Execution: Fable 5.1 → Opus 5 implementer → validation → GPT-5.6 Sol review
Fixes:     Fable adjudication → fresh Opus 5 fixer → validation → same Sol thread
Final:     full verification → Sol full-diff review → user approval → commit/push
```

Update prerequisites to Claude Code 2.1.255 or later because the `fable` alias requires it. State that Sol is pinned while Fable and Opus use Claude Code aliases. Document the evidence gate as “No evidence, no blocking finding,” including the `VERIFIED`, `INFERENCE`, and `UNVERIFIED` categories and Fable's independent verification responsibility. Remove three-review-layer, Sonnet frontend, step-commit, stash, and PMO-specific statements. Keep installation commands and transport explanation.

- [ ] **Step 4: Run the README test and full contract suite**

Run:

```bash
node --test tests/orchestration-contract.test.mjs
```

Expected: all tests pass, 0 fail.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md tests/orchestration-contract.test.mjs
git commit -m "docs: document check-loop v4 workflow"
```

### Task 5: Validate and smoke-test the plugin

**Files:**
- Verify: all files under `plugins/check-loop/`
- Verify: `.claude-plugin/marketplace.json`
- Verify: `README.md`
- Create temporarily outside repository: `/tmp/check-loop-v4-smoke/`

**Interfaces:**
- Consumes: complete v4 plugin.
- Produces: syntax, contract, transport, discovery, plan-loop, and execution-loop evidence.

- [ ] **Step 1: Run static and contract validation**

Run:

```bash
node --test tests/orchestration-contract.test.mjs
node --check plugins/check-loop/scripts/codex-invoke.mjs
node --check plugins/check-loop/scripts/app-server-broker.mjs
for file in plugins/check-loop/scripts/lib/*.mjs; do node --check "$file"; done
python3 -m json.tool plugins/check-loop/plugin.json >/dev/null
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null
git diff --check HEAD
```

Expected: every command exits 0; contract suite reports 0 failures.

- [ ] **Step 2: Verify the real transport preflight**

Run:

```bash
node plugins/check-loop/scripts/codex-invoke.mjs setup --cwd "$PWD"
```

Expected output includes:

```text
Model: gpt-5.6-sol
Reasoning effort: xhigh
Status: ready
```

- [ ] **Step 3: Verify plugin discovery under Fable**

Run Claude Code 2.1.255 or later with the local plugin directory:

```bash
claude --plugin-dir ./plugins/check-loop --model fable --effort xhigh -p "List the check-loop skills loaded from this plugin and their declared model roles. Do not modify files."
```

Expected: output names `check-loop` and `execute`, identifies Fable orchestration, Opus implementation, and Sol review, and reports no plugin-load error.

- [ ] **Step 4: Smoke-test the plan loop in a disposable repository**

Create `/tmp/check-loop-v4-smoke`, initialize Git, and add this plan:

```markdown
# Greeting change plan

1. Change `greeting.txt` from `hello` to `hello world`.
2. Verify the file contains exactly one line.
```

Launch an interactive Claude session from that temporary repository with the local plugin, invoke `/check-loop` on the plan, and observe:

- The skill turn identifies Fable as orchestrator.
- Setup identifies `gpt-5.6-sol` at `xhigh`.
- The first Sol response returns a thread ID.
- Any follow-up uses the same thread ID.
- Any Sol concern uses the complete evidence contract.
- Fable checks cited plan or repository evidence before accepting a finding.
- `INFERENCE` and `UNVERIFIED` items remain non-blocking questions.
- The loop ends only on exact approval or reports its bounded unresolved state.

Do not retain the temporary repository after recording the result.

- [ ] **Step 5: Smoke-test one execution step**

In a fresh disposable repository containing committed `greeting.txt` with `hello`, launch the local plugin under Fable and invoke `execute` with the approved greeting plan. Confirm:

- Fable owns the active skill turn.
- The implementation agent is explicitly Opus.
- The Opus agent changes only `greeting.txt` and does not stage or commit.
- Fable validates the exact file content.
- Sol reviews the step diff and validation evidence.
- Any Sol concern uses the complete evidence contract.
- Fable independently checks its cited file, plan, or command evidence before accepting it.
- No Opus reviewer or Sonnet implementation agent is launched.
- No commit or push occurs before the user approval prompt.

Decline the final commit/push prompt and remove the temporary repository.

- [ ] **Step 6: Record final repository state**

Run:

```bash
git status --short
git log --oneline --decorate -5
```

Expected: only intentionally uncommitted release adjustments, if any; commits from Tasks 1–4 are present on `main` after the previously committed design.

### Task 6: Publish and activate 4.0.0

**Files:**
- Publish: current `main` branch to `origin/main`
- Update: Claude Code plugin cache through the supported plugin updater
- Verify: `~/.claude/plugins/installed_plugins.json`

**Interfaces:**
- Consumes: verified local version 4.0.0.
- Produces: GitHub release state and active local installation at 4.0.0.

- [ ] **Step 1: Ask for release approval**

Present the exact commits, contract-test count, transport preflight, plan smoke result, execution smoke result, and any residual risks. Ask for explicit approval to push and update the installed plugin.

- [ ] **Step 2: Push the verified branch**

After approval:

```bash
git push origin main
```

Expected: `origin/main` advances to the verified v4 commits.

- [ ] **Step 3: Refresh the marketplace and installed plugin**

Use Claude Code's supported plugin commands for the installed version:

```bash
claude plugin marketplace update lordknows13-check-loop
claude plugin update check-loop@lordknows13-check-loop
```

If the installed CLI exposes different subcommand spelling, inspect `claude plugin --help` and use its documented equivalent rather than modifying the cache manually.

- [ ] **Step 4: Verify active installation metadata**

Confirm `~/.claude/plugins/installed_plugins.json` records:

```json
{
  "version": "4.0.0"
}
```

for `check-loop@lordknows13-check-loop`, and that its `installPath` ends in `/check-loop/4.0.0`.

- [ ] **Step 5: Reload and verify the installed plugin**

Run `/reload-plugins` in Claude Code or start a fresh session. Invoke the installed plugin's setup/preflight path and confirm it reports Fable orchestration, Opus implementation, and `gpt-5.6-sol` review at `xhigh`.
