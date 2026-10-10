import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadRun, redactSecrets, renderReport, runReviewRound } from "../plugins/check-loop/scripts/lib/review-loop.mjs";

const PLAN = ["# Plan", "", "1. Add the cache.", "", "Context.", "", "More context.", "", "2. UNCHANGED_SENTINEL keep this step.", "3. Ship it.", ""].join("\n");

function finding(overrides = {}) {
  return {
    severity: "important",
    evidence_status: "VERIFIED",
    title: "Cache never invalidates",
    location: "plan.md:3",
    claim: "Step 1 adds a cache without invalidation.",
    evidence: '"1. Add the cache."',
    impact: "Stale reads.",
    failure_condition: "Any write after the first read.",
    recommended_correction: "Invalidate on write.",
    origin: "new",
    reraise_of: null,
    ...overrides,
  };
}

function review({ verdict = "changes", prior = [], findings = [], questions = [] } = {}) {
  return JSON.stringify({ verdict, prior, findings, questions });
}

function harness(t, { maxRounds = 6 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "check-loop-round-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { CLAUDE_CONFIG_DIR: join(root, "claude") };
  const artifact = join(root, "plan.md");
  writeFileSync(artifact, PLAN);
  const prompts = [];
  const responses = [];
  const transport = async (prompt, turn) => {
    prompts.push({ prompt, turn });
    const next = responses.shift();
    if (typeof next === "function") return next();
    return { status: 0, error: null, threadId: "thread-1", model: "reviewer-x", effort: "high", response: next };
  };
  const round = (extra = {}) => runReviewRound({
    cwd: root,
    artifact: "plan.md",
    kind: "plan",
    requestText: "Make reads faster.",
    settings: { model: null, effort: null, maxRounds },
    env,
    transport,
    ...extra,
  });
  const edit = (text) => writeFileSync(artifact, text);
  return { root, env, artifact, prompts, responses, round, edit };
}

test("closure rounds send only the diff and cannot reopen unchanged scope", async (t) => {
  const h = harness(t);
  h.responses.push(review({
    findings: [
      finding(),
      finding({ title: "Typo in heading", severity: "minor" }),
      finding({ title: "Maybe a race", evidence_status: "INFERENCE" }),
    ],
  }));
  const first = await h.round();
  assert.equal(first.next, "adjudicate");
  assert.deepEqual(first.blockers.map((b) => b.id), ["F1"]);
  assert.equal(first.notes.length, 2);
  assert.match(h.prompts[0].prompt, /UNCHANGED_SENTINEL/);

  const accept = { decisions: [{ id: "F1", decision: "ACCEPT", reason: "Confirmed at plan.md:3." }] };
  await assert.rejects(h.round({ adjudication: accept }), /unchanged/);

  h.edit(PLAN.replace("1. Add the cache.", "1. Add the cache and invalidate it on write."));
  h.responses.push(review({
    verdict: "approve",
    prior: [{ id: "F1", status: "ADDRESSED", evidence: "Step 1 now invalidates on write." }],
    findings: [finding({ title: "Unrelated rollout gap", location: "plan.md:5", severity: "critical", origin: "new" })],
  }));
  const second = await h.round({ adjudication: accept });
  assert.equal(second.next, "done");
  assert.equal(second.outcome, "CONVERGED");
  assert.equal(h.prompts[1].turn.threadId, "thread-1");
  assert.equal(h.prompts[1].turn.model, "reviewer-x");
  assert.doesNotMatch(h.prompts[1].prompt, /UNCHANGED_SENTINEL/, "unchanged text must not be resent");
  assert.match(h.prompts[1].prompt, /\+1\. Add the cache and invalidate it on write\./);
  assert.match(h.prompts[1].prompt, /F1 \[important\] Cache never invalidates/);

  const report = renderReport(loadRun(h.artifact, h.env), h.env);
  assert.match(report, /CONVERGED/);
  assert.match(report, /Changed:\n- F1 Cache never invalidates/);
  assert.match(report, /Unrelated rollout gap/, "out-of-scope findings stay visible as notes");
});

test("rejecting every blocker converges without another reviewer turn", async (t) => {
  const h = harness(t);
  h.responses.push(review({ findings: [finding()] }));
  await h.round();
  const done = await h.round({ adjudication: { decisions: [{ id: "F1", decision: "REJECT", reason: "plan.md:3 already says writes go through the cache." }] } });
  assert.equal(done.outcome, "CONVERGED");
  assert.equal(h.prompts.length, 1);
  await assert.rejects(h.round(), /already finished/);
});

test("a rejection can be disputed once, and repeats of open findings are suppressed", async (t) => {
  const h = harness(t);
  h.responses.push(review({ findings: [finding(), finding({ title: "Missing auth check", location: "plan.md:4" })] }));
  await h.round();
  h.edit(PLAN.replace("1. Add the cache.", "1. Add the cache with invalidation."));
  h.responses.push(review({
    prior: [{ id: "F2", status: "REJECTION_DISPUTED", evidence: "plan.md:4 exposes the endpoint publicly." }],
    findings: [finding({ origin: "regression" })],
  }));
  const second = await h.round({ adjudication: { decisions: [
    { id: "F1", decision: "ACCEPT", reason: "Verified." },
    { id: "F2", decision: "REJECT", reason: "Auth is out of scope per request." },
  ] } });
  assert.deepEqual(second.blockers.map((b) => b.id), ["F2"]);
  assert.match(second.summary, /1 repeat\(s\) suppressed/);
  assert.deepEqual(second.unconfirmed, ["F1"]);

  const third = await h.round({ adjudication: { decisions: [{ id: "F2", decision: "REJECT", reason: "Still out of scope; user confirmed." }] } });
  assert.equal(third.next, "done");
  assert.equal(third.outcome, "CONVERGED — 1 FIX(ES) UNCONFIRMED");
});

test("the same unresolved blocker set two rounds running is reported as stalled", async (t) => {
  const h = harness(t);
  h.responses.push(review({ findings: [finding()] }));
  await h.round();
  const accept = (reason) => ({ decisions: [{ id: "F1", decision: "ACCEPT", reason }] });
  h.edit(`${PLAN}\nAttempt 1.\n`);
  h.responses.push(review({ prior: [{ id: "F1", status: "NOT_ADDRESSED", evidence: "Still no invalidation." }] }));
  const second = await h.round({ adjudication: accept("Verified.") });
  assert.equal(second.next, "adjudicate");
  h.edit(`${PLAN}\nAttempt 2.\n`);
  h.responses.push(review({ prior: [{ id: "F1", status: "NOT_ADDRESSED", evidence: "Still no invalidation." }] }));
  const third = await h.round({ adjudication: accept("Retrying.") });
  assert.equal(third.next, "stalled");
  assert.equal(third.stalled, true);
});

test("the round limit hands back unconfirmed fixes and allows one regression-only closeout", async (t) => {
  const h = harness(t, { maxRounds: 1 });
  h.responses.push(review({ findings: [finding()] }));
  const first = await h.round();
  assert.equal(first.next, "adjudicate-final");
  h.edit(PLAN.replace("1. Add the cache.", "1. Add the cache; invalidate on write."));
  const capped = await h.round({ adjudication: { decisions: [{ id: "F1", decision: "ACCEPT", reason: "Verified." }] } });
  assert.equal(capped.next, "cap");
  assert.equal(capped.outcome, "FIXES APPLIED — UNCONFIRMED");
  assert.equal(h.prompts.length, 1, "the cap must not spend a reviewer turn");

  h.responses.push(review({
    verdict: "approve",
    prior: [{ id: "F1", status: "ADDRESSED", evidence: "Fixed." }],
    findings: [finding({ title: "Late discovery", severity: "critical", origin: "missed", location: "plan.md:5" })],
  }));
  const closeout = await h.round({ closeout: true });
  assert.match(h.prompts[1].prompt, /closeout round/);
  assert.equal(closeout.outcome, "CONVERGED");
  assert.deepEqual(closeout.blockers, []);
  await assert.rejects(h.round({ closeout: true }), /already used|no unconfirmed/);
});

test("failed or malformed reviewer turns record nothing, so the same command can be retried", async (t) => {
  const h = harness(t);
  h.responses.push(() => ({ status: 1, error: "Reviewer turn timed out after 20 minute(s) and was interrupted." }));
  const failed = await h.round();
  assert.equal(failed.status, 1);
  assert.equal(failed.next, "retry");
  assert.equal(loadRun(h.artifact, h.env), null);

  h.responses.push("not json");
  await assert.rejects(h.round(), /malformed JSON/);
  h.responses.push(review({ findings: [{ ...finding(), evidence: "" }] }));
  await assert.rejects(h.round(), /finding field evidence/);
  assert.equal(loadRun(h.artifact, h.env), null);

  h.responses.push(review({ findings: [finding()] }));
  const ok = await h.round();
  assert.equal(ok.round, 1);
});

test("adjudication must decide exactly the pending blockers with reasons", async (t) => {
  const h = harness(t);
  h.responses.push(review({ findings: [finding(), finding({ title: "Second", location: "plan.md:4" })] }));
  await h.round();
  await assert.rejects(h.round(), /Adjudicate F1, F2 first/);
  await assert.rejects(h.round({ adjudication: { decisions: [{ id: "F1", decision: "ACCEPT", reason: "ok" }] } }), /Missing adjudication for F2/);
  await assert.rejects(h.round({ adjudication: { decisions: [{ id: "F9", decision: "ACCEPT", reason: "ok" }] } }), /F9 is not awaiting/);
  await assert.rejects(h.round({ adjudication: { decisions: [
    { id: "F1", decision: "MAYBE", reason: "ok" },
    { id: "F2", decision: "REJECT", reason: "ok" },
  ] } }), /decision must be/);
  await assert.rejects(h.round({ adjudication: { decisions: [
    { id: "F1", decision: "ACCEPT", reason: " " },
    { id: "F2", decision: "REJECT", reason: "ok" },
  ] } }), /reason/);
  assert.deepEqual(loadRun(h.artifact, h.env).pending, ["F1", "F2"], "a rejected adjudication must not partially apply");
});

test("credentials are redacted from every reviewer payload", async (t) => {
  const h = harness(t);
  const token = `ghp_${"a".repeat(36)}`;
  h.edit(`${PLAN}\nUse ${token} and password: hunter2hunter2 but keep apiKey: process.env.API_KEY.\n`);
  h.responses.push(review({ verdict: "approve" }));
  const result = await h.round();
  assert.equal(result.redactions, 2);
  assert.doesNotMatch(h.prompts[0].prompt, /ghp_a|hunter2/);
  assert.match(h.prompts[0].prompt, /apiKey: process\.env\.API_KEY/);
  const runs = join(h.env.CLAUDE_CONFIG_DIR, "check-loop", "runs");
  const [runFile] = readdirSync(runs);
  assert.doesNotMatch(readFileSync(join(runs, runFile), "utf8"), /ghp_a|hunter2/, "run state must not copy secrets");
});

test("secret patterns cover common credential shapes", () => {
  const { text, count } = redactSecrets([
    "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
    "AKIAABCDEFGHIJKLMNOP",
    `sk-ant-${"b".repeat(30)}`,
    "client_secret = 's3cr3tvalue123'",
  ].join("\n"));
  assert.equal(count, 4);
  assert.doesNotMatch(text, /abc|AKIA|sk-ant|s3cr3t/);
});
