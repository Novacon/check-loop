---
name: research
description: Researches questions when they need current sources, explicit uncertainty, adversarial fact-checking, or evidence-backed consensus in a Markdown deliverable.
model: fable
effort: xhigh
argument-hint: [research-question]
---

# Fable-Sol research

## Overview

Fable performs the requested research, writes the report, and owns every conclusion. GPT-5.6 Sol peer-reviews the completed draft in one persistent thread. Fable and Sol then challenge claims and corrections until no verified blocking concern remains.

**Core principle:** No evidence, no blocking finding. Model agreement is not research evidence.

Produce one final Markdown report. Do not implement code, create an implementation plan, or dispatch implementation subagents.

## Input and output

Treat `$ARGUMENTS` as the research question, scope, constraints, and optional output path. If empty, use the research request active in the conversation. Ask only when missing scope would materially change the answer.

Choose the Markdown path in this order:

1. An explicit path in the request.
2. The repository's existing research-report convention.
3. `research/YYYY-MM-DD-<topic>.md`.

Keep working notes in context rather than producing sidecar deliverables. The final Markdown file is the source of truth.

## Required models

This skill's frontmatter selects Fable at `xhigh`. Stop if Claude Code reports that `fable` was rejected, unavailable, or replaced.

Run the Sol preflight:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" setup --cwd "$(pwd)"
```

Proceed only when it reports:

```text
Model: gpt-5.6-sol
Reasoning effort: xhigh
Status: ready
```

All Sol turns use the transport's enforced read-only sandbox.

## Phase 1: Fable researches and drafts

Research the question completely before asking Sol to review it.

### Scope the answer

Record internally:

- The exact question and intended reader.
- Time, geography, version, or jurisdiction constraints.
- What would change the conclusion.
- Which unknowns cannot be resolved with available evidence.

Do not broaden the assignment into adjacent research the user did not request.

### Gather evidence

- Prefer primary sources: official documentation, specifications, first-party data, statutes, filings, source code, and original papers.
- Use secondary sources to orient or corroborate, not to replace an available primary source.
- For current claims, retrieve current sources rather than relying on model memory.
- Record the source URL or repository location, publication or version date when relevant, and the exact passage supporting each material claim.
- Corroborate consequential claims when independent evidence is available.
- Distinguish source facts, Fable's inferences, and unresolved unknowns.
- Do not cite a search-result snippet as evidence.

### Write the first draft

Write one Markdown report with the smallest structure that answers the request. Include:

1. Research question and scope.
2. Executive answer.
3. Findings with inline citations or footnotes.
4. Evidence and reasoning supporting each material conclusion.
5. Counterevidence, tradeoffs, or plausible alternative interpretations.
6. Uncertainties and evidence gaps.
7. Sources.
8. A peer-review record placeholder.

Every material factual claim must be traceable to a source. Label inference as inference. Use `Unknown` when the evidence does not support a conclusion.

## Phase 2: Sol peer review

Start one thread after the complete first draft exists:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --prompt "PROMPT"
```

Save the returned `threadId` and continue it for every later round:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-invoke.mjs" turn \
  --cwd "$(pwd)" \
  --thread-id THREAD_ID \
  --prompt "PROMPT"
```

Before sending any report or follow-up to Sol, inspect it and redact secret or credential values. Omit contents from `*.env*`, `*.secret*`, `*credentials*`, `**/secrets/**`, ignored environment files, binary payloads, and dependency caches. Name an omitted path only when Sol needs the omission context; never include its content.

### Initial Sol prompt

```text
Act as GPT-5.6 Sol, the adversarial peer reviewer for research owned by Fable.

Review only. Do not implement code or turn the report into an implementation plan. Check:
- factual accuracy and whether citations support the exact claims;
- primary-source quality, currency, and relevance;
- missing material counterevidence or perspectives;
- internal consistency and reasoning gaps;
- conclusions that are stronger than the evidence;
- important unresolved questions hidden by confident wording.

Do not invent sources, quotations, repository facts, or browsing results. If you cannot open or confirm a source, mark the finding UNVERIFIED.

Evidence contract for every concern:
R1 [critical | important | minor] [VERIFIED | INFERENCE | UNVERIFIED]
Claim:
Evidence: exact report quote plus primary-source URL, file:line, or observed command output
Source check:
Impact on conclusion:
Recommended correction:

Status rules:
- VERIFIED: the cited source directly supports the review finding.
- INFERENCE: checked facts support a conclusion that has not been directly established.
- UNVERIFIED: required evidence is missing or inaccessible.
- Only VERIFIED critical or important findings may block.
- Model agreement, confidence, severity, and repetition are not evidence.
- Number findings continuously across rounds.

If no verified critical or important concern remains, respond exactly:
RESEARCH APPROVED -- No verified blocking findings.

Research request:
<request>
FULL_RESEARCH_REQUEST
</request>

Draft report:
<report>
FULL_MARKDOWN_REPORT
</report>
```

## Phase 3: Fable adjudicates and revises

Fable must independently verify every cited review source before changing the report.

For each finding:

1. Open the cited report passage and source.
2. Confirm the source exists, is current enough for the claim, and says what Sol claims it says.
3. Check that the finding's impact follows from the evidence.
4. Assign:
   - `ACCEPT`: verified and the correction improves accuracy or completeness.
   - `REJECT`: contradicted, unsupported, irrelevant to scope, or preference-only.
   - `COUNTER`: verified concern, but a different correction states the evidence more accurately.
5. Revise the report only for accepted or countered findings.
6. Keep inferred and unverified items in uncertainties until evidence promotes them.
7. Recording a neutral evidence gap is not acceptance; do not alter the substantive conclusion for an inferred or unverified item.

Reject invented, stale, mismatched, or inaccessible citations. If the source identity is sufficient, check one obvious canonical or archived location; otherwise ask Sol for an accessible primary source and exact passage. Do not perform an unbounded source hunt.

Continue the same thread:

```text
Fable independently checked every cited source.

Adjudication:
- R1: ACCEPTED -- verified source and reason
- R2: REJECTED -- contradictory or missing evidence and reason
- R3: COUNTERED -- verified concern, more accurate correction and reason

Unverified questions:
- Every INFERENCE or UNVERIFIED item still needing evidence

Revised report:
<report>
FULL_REVISED_MARKDOWN_REPORT
</report>

Review the adjudication and revised report.
- Do not repeat an addressed concern without new evidence.
- Continue finding numbers for genuinely new concerns.
- Use the complete evidence contract.
- If Fable rejected evidence incorrectly, cite the exact source it missed.
- If no verified critical or important concern remains, respond exactly:
RESEARCH APPROVED -- No verified blocking findings.
```

## Convergence

Conclude the review when Sol approves or when no independently verified critical or important finding remains after adjudication. Sol withholding the approval phrase over a rejected, minor, inferred, or unverified concern does not block completion. Never waive a verified blocker merely because the round limit was reached.
Call the result `consensus` only when Sol emitted the approval phrase. Otherwise report `no verified blocking findings after adjudication`; never imply model agreement that did not occur.

After each round, record:

```text
Round N: X concerns
- Accepted: R...
- Rejected: R...
- Countered: R...
- Unverified questions: R...
```

At the round limit, conclude only if no independently verified critical or important finding remains. Otherwise preserve the draft and adjudication record, mark research blocked, separate unresolved verified disagreements from unverified questions, and ask the user how to resolve the verified blocker.

## Final Markdown report

Update the report's peer-review record with:

- Rounds completed and convergence status.
- Verified corrections incorporated.
- Rejected and countered findings with concise reasons.
- Unresolved verified disagreements.
- Remaining inferences and unverified questions.

Check every material citation one final time. Ensure the executive answer matches the evidence and uncertainty sections. Report the final Markdown path to the user and do not produce implementation changes.

## Common mistakes

| Mistake | Correct action |
|---|---|
| Treating a citation as proof without opening it | Read the current source and matching passage. |
| Using a secondary summary when a primary source exists | Cite the primary source; use the summary only for context. |
| Accepting a severe claim because Sol sounds certain | Verify its evidence and impact independently. |
| Hiding uncertainty to force consensus | Preserve it as inference or unknown. |
| Letting review expand the research question | Reject out-of-scope findings. |
| Producing recommendations as if they were facts | Tie each recommendation to stated evidence and assumptions. |

## Review red flags

Pause that finding when it relies on:

- A source that cannot be opened.
- A quote that does not appear in the cited source.
- A stale source for a time-sensitive claim.
- A search snippet rather than source content.
- A conclusion stronger than the cited passage.
- Agreement between Fable and Sol instead of external evidence.

Reclassify, correct, or reject the finding before continuing.
