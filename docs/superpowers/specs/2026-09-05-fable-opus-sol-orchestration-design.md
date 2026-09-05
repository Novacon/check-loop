# Fable–Opus–Sol orchestration design

## Purpose

Update `check-loop` so its model roles are explicit and enforced:

- Fable 5.1 owns plan refinement and execution orchestration.
- Opus 5 subagents implement every plan step and every accepted review fix.
- GPT-5.6 Sol reviews the plan adversarially and reviews each implementation step.

The plugin must no longer depend on whichever Claude or Codex model happens to be active when a skill starts.

## Current state

Version 3.1.0 has the intended broad shape but does not enforce it:

- Both skills inherit the active Claude session model because their frontmatter has no `model` field.
- `codex-invoke.mjs` sets `MODEL = null`, so it inherits the Codex CLI default.
- Execution permits Sonnet for frontend implementation.
- Each step passes through separate Opus spec-compliance and code-quality reviewers before Codex.
- Generic plugin prompts contain project-specific Next.js, Supabase, and PMO conventions.

## Model contract

Use model-family aliases on the Claude side and an explicit model ID on the Codex side:

| Role | Selection | Reason |
|---|---|---|
| Orchestrator | Skill frontmatter `model: fable`, `effort: xhigh` | Claude Code resolves `fable` to the latest Fable model; currently Fable 5.1. The skill override applies for the invocation turn. |
| Implementer/fixer | Agent tool `model: "opus"` | Claude Code resolves `opus` to the current Opus model; currently Opus 5 on the Anthropic API. |
| Adversarial reviewer | `MODEL = "gpt-5.6-sol"`, `EFFORT = "xhigh"` | Prevent Codex CLI configuration changes from silently replacing Sol. |

If an account or organization does not allow one of these models, stop with the model-selection error or notice. Claude Code retains the prior session model when a skill model is disallowed; the workflow must not proceed after that fallback.

## Plan-refinement workflow

1. Run `/check-loop` under Fable via skill frontmatter.
2. Read the plan and the original user request.
3. Start one persistent GPT-5.6 Sol App Server thread.
4. Send the original request and full plan to Sol for adversarial review.
5. Require numbered, evidence-based concerns or the exact `PLAN APPROVED` signal.
6. Have Fable classify every concern as `ACCEPT`, `REJECT`, or `COUNTER`.
7. Update the plan only for accepted changes. Explain rejected and countered findings to Sol.
8. Continue the same Sol thread until approval or the round limit.
9. Report meaningful plan changes, successfully defended decisions, and unresolved disagreements.

The plan file remains the output and source of truth. This skill does not implement code.

## Execution workflow

1. Run `/check-loop:execute` under Fable via skill frontmatter.
2. Read and lock the approved plan, then divide it into explicit implementation steps.
3. Capture the baseline commit and working-tree state. If the tree is dirty, ask the user to move execution to a worktree or explicitly include the existing changes. Never stash, discard, or silently include unrelated work.
4. Start one persistent GPT-5.6 Sol supervision thread with the full plan and repository instructions.
5. For each step:
   1. Have Fable prepare the step contract, context, dependencies, and acceptance criteria.
   2. Dispatch one fresh Opus implementer subagent. Never use Sonnet for implementation.
   3. Have the Opus subagent implement the step and report changed files and checks run. The subagent never stages or commits; Fable keeps changes uncommitted until final approval and scopes each review from the working-tree snapshot taken before the step.
   4. Run applicable repository-native validation from Fable's session.
   5. Send Sol the step contract, actual diff, relevant file context, and validation results.
   6. Require `STEP APPROVED` or numbered findings tagged `critical`, `important`, or `minor` with file references and evidence.
   7. Have Fable classify every finding as `ACCEPT`, `REJECT`, or `COUNTER`. Reject unsupported or purely stylistic findings with repository evidence.
   8. Dispatch a fresh Opus fixer for accepted blocking findings, rerun validation, and resubmit the step plus Fable's adjudication to the same Sol thread.
   9. Stop after three unsuccessful review/fix cycles and ask the user to resolve remaining blocking disagreements.
6. After all steps pass, run project-level verification and one native Sol full-diff review.
7. Present the implementation, verification evidence, accepted/rejected/countered findings, and any residual risks.
8. Wait for explicit user approval before committing or pushing.

## Review policy

Sol is the only dedicated reviewer during execution. Remove the separate Opus spec-compliance and code-quality reviewer stages. Fable remains responsible for interpreting the plan, checking scope, selecting validation, and adjudicating Sol's findings.

Treat agreement as insufficient evidence. A Sol finding blocks only when it identifies an observable contract violation, correctness defect, security problem, unsupported assumption, or maintainability risk grounded in the repository. Minor preferences never block a step.

## Repository standards

Remove the baked-in “desloppify” rules about Next.js route length, `Result<T>`, Supabase mocks, `safeStripeRedirect()`, and PMO-specific helpers.

For every plan and implementation task:

1. Read the repository's active instructions and relevant existing patterns.
2. Include those constraints in the Opus implementation prompt and Sol review context.
3. Prefer the repository's own test, lint, type-check, build, and runtime commands.
4. Add no second convention beside an existing one.

## Files and packaging

Update:

- `plugins/check-loop/skills/check-loop/SKILL.md`
- `plugins/check-loop/skills/execute/SKILL.md`
- `plugins/check-loop/skills/execute/implementer-prompt.md`
- `plugins/check-loop/scripts/codex-invoke.mjs`
- `plugins/check-loop/plugin.json`
- `.claude-plugin/marketplace.json`
- `README.md`

Delete:

- `plugins/check-loop/skills/execute/spec-reviewer-prompt.md`
- `plugins/check-loop/skills/execute/code-quality-reviewer-prompt.md`

Bump the plugin and marketplace version to `4.0.0` because the execution pipeline and model-selection contract change incompatibly.

## Safety and failure handling

- Keep Codex sandboxing read-only for review turns.
- Preserve App Server broker reuse, streaming, OAuth authentication, and persistent thread handling.
- Never send secrets, credential files, or ignored environment files to Sol.
- Never discard or stash unrelated user work automatically.
- Treat transport failures, unavailable required models, validation failures after three fixes, and unresolved critical review findings as blockers requiring user input.
- Preserve a full record of Fable's accepted, rejected, and countered findings in the final summary.

## Verification

Before release:

1. Validate all JSON manifests and version equality.
2. Run `node --check` over every JavaScript module.
3. Run the transport setup command and verify it reports `gpt-5.6-sol` with `xhigh`.
4. Verify both skills declare `model: fable` and `effort: xhigh`.
5. Verify every implementer/fixer dispatch specifies `model: "opus"` and no Sonnet implementation path remains.
6. Verify removed reviewer files have no references.
7. Run the plugin locally with `claude --plugin-dir` and confirm both skills are discovered.
8. Exercise a disposable plan through plan review to confirm Sol thread creation, continuation, and approval parsing.
9. Exercise one disposable implementation step to confirm the Opus dispatch contract, validation handoff, Sol review, and user approval gate.

## Non-goals

- Do not add Fable as a second implementation reviewer.
- Do not import `bb`, `/nagent`, `total-review`, or another orchestration dependency.
- Do not add model-selection configuration flags. The plugin intentionally defines one model contract.
- Do not automatically commit or push without final user approval.
- Do not preserve deprecated reviewer stages or compatibility aliases.