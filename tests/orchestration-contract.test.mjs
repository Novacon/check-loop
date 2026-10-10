import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyTurnNotification,
  assertEffectiveThreadSettings,
  buildResultStatus,
} from "../plugins/check-loop/scripts/lib/codex.mjs";
import { buildReviewResult } from "../plugins/check-loop/scripts/lib/review-result.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "plugins/check-loop/scripts/codex-invoke.mjs");

function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), "check-loop-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "project");
  const configDir = join(root, "claude");
  mkdirSync(join(cwd, ".claude"), { recursive: true });
  mkdirSync(join(configDir, "check-loop"), { recursive: true });
  const userFile = join(configDir, "check-loop/config.json");
  const projectFile = join(cwd, ".claude/check-loop.json");
  const write = (file, value) => writeFileSync(file, JSON.stringify(value));
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    encoding: "utf8",
  });
  const config = (...args) => {
    const result = run("config", ...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  return { cwd, userFile, projectFile, write, run, config };
}

test("reviewer settings merge per key and command overrides can reset to Codex defaults", (t) => {
  const w = workspace(t);
  w.write(w.userFile, { model: "reviewer-user", effort: "high", maxRounds: 9 });
  w.write(w.projectFile, { model: "reviewer-project" });
  assert.deepEqual(w.config(), { model: "reviewer-project", effort: "high", maxRounds: 9, implementerModel: null });

  assert.deepEqual(w.config("--project", "--model", "reviewer-selected", "--effort", "medium"), {
    model: "reviewer-selected", effort: "medium", maxRounds: 9, implementerModel: null,
  });
  assert.deepEqual(JSON.parse(readFileSync(w.userFile, "utf8")), {
    model: "reviewer-user", effort: "high", maxRounds: 9,
  });

  assert.deepEqual(w.config("--project", "--model", "default", "--effort", "default"), {
    model: null, effort: null, maxRounds: 9, implementerModel: null,
  });
  assert.deepEqual(w.config(), { model: null, effort: null, maxRounds: 9, implementerModel: null });
});

test("changing one saved setting preserves other reviewer choices", (t) => {
  const w = workspace(t);
  w.write(w.userFile, { model: "reviewer-chosen", effort: "high", maxRounds: 12 });
  assert.deepEqual(w.config("--max-rounds", "4"), {
    model: "reviewer-chosen", effort: "high", maxRounds: 4, implementerModel: null,
  });
  assert.deepEqual(w.config(), { model: "reviewer-chosen", effort: "high", maxRounds: 4, implementerModel: null });
});

test("implementer model inherits the session model by default and can be saved or reset", (t) => {
  const w = workspace(t);
  assert.equal(w.config().implementerModel, null);
  assert.equal(w.config("--implementer-model", "sonnet").implementerModel, "sonnet");
  assert.equal(JSON.parse(readFileSync(w.userFile, "utf8")).implementerModel, "sonnet");
  assert.equal(w.config("--project", "--implementer-model", "default").implementerModel, null);
  assert.equal(JSON.parse(readFileSync(w.userFile, "utf8")).implementerModel, "sonnet");
  assert.notEqual(w.run("config", "--implementer-model", "").status, 0);
});

test("--cwd resolves the target project's overrides rather than the caller's", (t) => {
  const w = workspace(t);
  w.write(w.projectFile, { model: "caller-reviewer" });
  const target = join(w.cwd, "nested project");
  mkdirSync(join(target, ".claude"), { recursive: true });
  w.write(join(target, ".claude/check-loop.json"), { model: "target-reviewer", maxRounds: 3 });
  assert.equal(w.config("--cwd", target).model, "target-reviewer");
  w.config("--cwd", target, "--project", "--effort", "low");
  assert.equal(w.config("--cwd", target).effort, "low");
  assert.deepEqual(JSON.parse(readFileSync(w.projectFile, "utf8")), { model: "caller-reviewer" });
});

test("invalid round limits and model values cannot partially overwrite settings", (t) => {
  const w = workspace(t);
  const saved = { model: "keep-reviewer", effort: "high", maxRounds: 7 };
  w.write(w.userFile, saved);
  for (const bad of ["0", "41", "2.5", "NaN", "3junk"]) {
    const result = w.run("config", "--model", "unwanted-reviewer", "--max-rounds", bad);
    assert.notEqual(result.status, 0, `accepted maxRounds=${bad}`);
    assert.match(result.stderr, /round/i);
    assert.deepEqual(JSON.parse(readFileSync(w.userFile, "utf8")), saved);
  }
  const empty = w.run("config", "--model", "");
  assert.notEqual(empty.status, 0);
  assert.deepEqual(JSON.parse(readFileSync(w.userFile, "utf8")), saved);
});

test("malformed project config is reported rather than silently using a different reviewer", (t) => {
  const w = workspace(t);
  w.write(w.userFile, { model: "user-reviewer" });
  writeFileSync(w.projectFile, "{ broken json");
  const result = w.run("config");
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(w.projectFile), result.stderr);
});

test("unsupported settings and misspelled CLI flags fail visibly", (t) => {
  const w = workspace(t);
  for (const args of [
    ["config", "--modle", "reviewer"],
    ["setup", "--modle", "reviewer"],
    ["turn", "--prompt", "review", "--modle", "reviewer"],
    ["review", "--modle", "reviewer"],
    ["round", "--artifact", "plan.md", "--modle", "reviewer"],
    ["report", "--artifact", "plan.md", "--verbose"],
    ["turn", "--prompt", "review", "--timeout-minutes", "0"],
    ["turn", "--prompt", "a", "--prompt-file", "b"],
    ["config", "unexpected"],
    ["config", "--model"],
  ]) {
    const result = w.run(...args);
    assert.notEqual(result.status, 0, `silently accepted ${args.join(" ")}`);
    assert.match(result.stderr, /unknown|unexpected|unsupported|missing|unrecognized|invalid/i);
  }
  w.write(w.projectFile, { modle: "misspelled-reviewer" });
  const result = w.run("config");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /modle/);
});

test("both round-limit boundaries are usable", (t) => {
  const w = workspace(t);
  assert.equal(w.config("--max-rounds", "1").maxRounds, 1);
  assert.equal(w.config("--max-rounds", "40").maxRounds, 40);
});

test("a model substitution cannot turn a completed response into an approved review", () => {
  const state = { expectedModel: "chosen-reviewer", error: null, onProgress: null };
  applyTurnNotification(state, {
    method: "model/rerouted",
    params: { fromModel: "chosen-reviewer", toModel: "different-reviewer", reason: "capacity" },
  });
  assert.match(state.error.message, /Unexpected model reroute/);
  assert.equal(buildResultStatus({ error: state.error, finalTurn: { status: "completed" } }), 1);
});

test("effective model and effort mismatches fail before a review can be accepted", () => {
  assert.throws(() => assertEffectiveThreadSettings(
    { model: "other-reviewer", reasoningEffort: "high" },
    { model: "chosen-reviewer", effort: "high" },
  ), /Unexpected effective model/);
  assert.throws(() => assertEffectiveThreadSettings(
    { model: "chosen-reviewer", reasoningEffort: "low" },
    { model: "chosen-reviewer", effort: "high" },
  ), /Unexpected effective reasoning effort/);
  assert.throws(() => assertEffectiveThreadSettings(
    { model: "chosen-reviewer" },
    { model: "chosen-reviewer", effort: "high" },
  ), /Unexpected effective reasoning effort/);
});

test("missing or malformed review text is failure rather than implicit approval", () => {
  for (const response of ["", " \n\t", null, undefined, { findings: [] }]) {
    const result = buildReviewResult({ status: 0, threadId: "review-thread" }, response);
    assert.equal(result.status, 1);
    assert.match(result.error, /no review text|malformed review text/);
  }
});

test("approval text cannot mask a failed transport or server error", () => {
  const approval = "PLAN APPROVED -- No remaining concerns.";
  const failed = buildReviewResult({
    status: 1,
    error: { message: "Reviewer quota exhausted" },
    stderr: "less useful diagnostic",
  }, approval);
  assert.equal(failed.status, 1);
  assert.equal(failed.error, "Reviewer quota exhausted");
  assert.equal(failed.response, approval);

  const finalError = buildReviewResult({
    status: 0,
    turn: { error: { message: "Review interrupted" } },
  }, approval);
  assert.equal(finalError.status, 1);
  assert.equal(finalError.error, "Review interrupted");
});

test("failed runs retain actionable diagnostics even when review text is missing", () => {
  const result = buildReviewResult({ status: 1, stderr: "Authentication expired\n" }, "");
  assert.equal(result.status, 1);
  assert.equal(result.error, "Authentication expired");
});
