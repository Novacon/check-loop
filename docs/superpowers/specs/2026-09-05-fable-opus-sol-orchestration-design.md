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
5. Require numbered concerns using the evidence contract or the exact `PLAN APPROVED` signal.
6. Have Fable independently verify every blocking claim, then classify it as `ACCEPT`, `REJECT`, or `COUNTER`.
7. Update the plan only for accepted, verified changes. Explain rejected and countered findings to Sol.
8. Continue the same Sol thread until approval, no independently verified critical or important concern remains, or the round limit.
9. At the limit, ask the user to resolve any remaining verified blocker; otherwise report meaningful plan changes, successfully defended decisions, and unresolved nonblocking questions.

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
   10. Complete the step when no independently verified critical or important finding remains, even if Sol withholds the approval phrase over a rejected, minor, inferred, or unverified item.
6. After all steps pass, run project-level verification and send one sanitized final execution packet through the persistent Sol thread.
7. Present the implementation, verification evidence, accepted/rejected/countered findings, and any residual risks.
8. Wait for explicit user approval before committing or pushing.

## Review policy

Sol is the only dedicated reviewer during execution. Remove the separate Opus spec-compliance and code-quality reviewer stages. Fable remains responsible for interpreting the plan, checking scope, selecting validation, and adjudicating Sol's findings.

Treat agreement as insufficient evidence. A Sol finding blocks only when it identifies an observable contract violation, correctness defect, security problem, unsupported assumption, or maintainability risk grounded in the repository. Minor preferences never block a step.

## Evidence gate

Every Sol concern must contain:

```text
F1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact plan quote, file:line, or command output
Impact:
Failure condition:
Recommended correction:
```

- `VERIFIED` means the cited source directly supports the claim.
- `INFERENCE` means the cited facts support a conclusion that has not been reproduced.
- `UNVERIFIED` means required evidence is unavailable or missing.
- Only verified critical or important findings may block a plan or implementation step.
- Inferences and unverified items remain non-blocking questions until Fable obtains and checks the missing evidence.
- Fable must inspect every cited source independently. Model agreement, confidence language, and repeated assertions do not count as evidence.
- Reject invented, stale, mismatched, or inaccessible citations and send the correction through the same Sol thread.
- Supply missing context and request a new review instead of allowing either model to guess.
- Separate verified defects from unresolved hypotheses in every round summary and final report.

## Research workflow

Add `/check-loop:research` for evidence-backed research deliverables:

1. Treat the command arguments as the research question, scope, constraints, and optional output path.
2. Run under Fable at `xhigh`.
3. Research before drafting. Prefer primary and current sources, preserve source URLs, distinguish facts from inference, and record unresolved gaps.
4. Write one Markdown report. Use an explicit user path when supplied; otherwise follow an existing repository research convention or write `research/YYYY-MM-DD-<topic>.md`.
5. Start one persistent GPT-5.6 Sol thread with the question, full draft, and sources.
6. Require evidence-formatted findings about factual support, source quality, missing counterevidence, internal consistency, and whether conclusions exceed the evidence.
7. Have Fable independently open and verify every cited source before accepting, rejecting, or countering a finding.
8. Revise the report only for verified accepted or countered findings, then continue the same Sol thread.
9. Conclude when Sol approves or no independently verified critical or important finding remains. At 40 rounds, preserve the draft and ask the user to resolve any remaining verified blocker.
10. Leave an auditable review summary and unresolved questions in the final Markdown report.

The research skill produces no code or implementation plan and does not dispatch implementation subagents.

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
- `plugins/check-loop/skills/research/SKILL.md`
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
- Never discard, stash, or silently include existing user work automatically.
- Treat transport failures, unavailable or rerouted required models, validation failures after three fixes, and unresolved verified critical or important review findings as blockers requiring user input.
- Preserve a full record of Fable's accepted, rejected, and countered findings in the final summary.

## Verification

Before release:

1. Validate all JSON manifests and version equality.
2. Run `node --check` over every JavaScript module.
3. Run the transport setup command and verify it reports `gpt-5.6-sol` with `xhigh`.
4. Verify all three skills declare `model: fable` and `effort: xhigh`.
5. Verify every implementer/fixer dispatch specifies `model: "opus"` and no Sonnet implementation path remains.
6. Verify removed reviewer files have no references.
7. Verify all three Sol prompt contracts require the complete evidence format and prohibit unsupported blocking findings.
8. Run the plugin locally with `claude --plugin-dir` and confirm all three skills are discovered.
9. Exercise a disposable plan through plan review to confirm Sol thread creation, continuation, evidence handling, and approval parsing.
10. Exercise one disposable implementation step to confirm the Opus dispatch contract, validation handoff, evidence-gated Sol review, and user approval gate.
11. Exercise a disposable research request and confirm it produces one cited Markdown report without implementation work.

## Non-goals

- Do not add Fable as a second implementation reviewer.
- Do not import `bb`, `/nagent`, `total-review`, or another orchestration dependency.
- Do not add model-selection configuration flags. The plugin intentionally defines one model contract.
- Do not automatically commit or push without final user approval.
- Do not preserve deprecated reviewer stages or compatibility aliases.