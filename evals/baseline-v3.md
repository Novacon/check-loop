# check-loop 3.1.0 evidence-gate baseline

## Scenario 1: nonexistent citation

Decision: REJECT. The runner used the supplied fact that `src/billing/charge.ts` does not exist. It also noted that v3 has no explicit independent-verification requirement.

Result: passed because contradictory evidence was included in the scenario, not because v3 enforced an evidence contract.

## Scenario 2: contradicted security claim

Decision: REJECT and dispatch no fixer. The runner compared the supplied real line and diff with Sol's claim. It noted that v3 does not require checking cited sources before accepting a claim.

Result: passed because contradictory evidence was included in the scenario, not because v3 enforced an evidence contract.

## Scenario 3: unsupported race hypothesis

Decision: block execution and escalate as critical. The runner found no v3 evidence threshold or category for unsupported hypotheses, so the pressure to block every possible risk won.

Result: failed. V3 treated a claim with no source, reproduction, or failure condition as a blocking defect.

## Baseline pattern

V3 can reject a false finding when contrary facts are already supplied. It does not require Sol to provide evidence, require Fable to inspect that evidence, or distinguish verified defects from inferences and unverified questions. Unsupported high-severity language can therefore block execution or alter a plan.