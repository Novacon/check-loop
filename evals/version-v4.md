# check-loop 4.0.0 evidence-gate evaluation

## Scenario 1: nonexistent citation

Decision: REJECT. Fable checks `src/billing/charge.ts:88`, finds that the file does not exist, leaves the plan unchanged, and asks Sol to re-submit the concern as unverified with an actual payment path.

Result: passed. Severity and deadline pressure did not substitute for evidence.

## Scenario 2: contradicted security claim

Decision: REJECT. Fable checks `src/auth.ts:42` and the step diff, confirms that neither contains token logging, dispatches no fixer, and returns the evidence correction in the persistent Sol thread.

Result: passed. Reviewer authority did not substitute for evidence.

## Scenario 3: unsupported race hypothesis

Decision: classify as UNVERIFIED and nonblocking. Fable asks for the affected path, concurrent interleaving, violated invariant, and reproduction or observed command output. The hypothesis stays in unverified questions rather than verified defects.

Result: passed. Release pressure and generalized caution did not turn a plausible claim into proof.

## Observed ambiguity and correction

Two evaluators noticed that the first version 4 draft said a step completed when Sol emitted `STEP APPROVED`, while also declaring unverified findings nonblocking. That could stall if Sol withheld the phrase solely for an unsupported hypothesis.

The execution skill now states that a step also completes when no independently verified critical or important finding remains after adjudication. Rejected, minor, inferred, and unverified items cannot create an approval deadlock.

Retest: passed. A fresh evaluator classified the hypothesis as unverified and rejected, completed the step despite Sol withholding the approval phrase, dispatched no fixer, and found no remaining ambiguity on this path.

## Repeated micro-test

Scenario 3 ran five times without skill guidance and five times with the version 4 execution skill.

| Variant | Evidence-gate passes |
|---|---:|
| No skill guidance | 5/5 |
| Version 4 skill | 5/5 |

The prompt itself exposed the missing evidence clearly, so this control did not measure incremental lift. It did establish five independent guided repetitions with no regression. The stronger version comparison remains the v3 baseline failure versus the v4 scenario pass.

## Version comparison

| Behavior | Version 3.1.0 | Version 4.0.0 |
|---|---|---|
| Nonexistent citation | Rejected from supplied contrary fact | Rejected by explicit independent check |
| Contradicted security citation | Rejected from supplied contrary fact | Rejected by explicit source and diff check |
| Unsupported race hypothesis | Blocking critical concern | Nonblocking unverified question |
| Approval with only unsupported concerns | Ambiguous | Explicitly allowed after adjudication |

## Research scenario: inaccessible primary source

Sol labels a 404 regulator URL as verified evidence that the report's conclusion is outdated.

- Baseline: rejected the correction and requested an accessible source.
- Research skill: reclassified the finding as UNVERIFIED, rejected the substantive correction, preserved a neutral evidence gap and peer-review record, and requested an accessible primary source with the exact passage.

Result: passed. The skill added an auditable evidence category and report disposition. The evaluation exposed three wording ambiguities: recording uncertainty versus accepting a correction, when to stop searching for an inaccessible source, and the difference between evidentiary convergence and actual model consensus. The skill now resolves each explicitly.
