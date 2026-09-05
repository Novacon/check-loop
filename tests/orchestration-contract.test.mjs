import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildThreadParams } from "../plugins/check-loop/scripts/lib/codex.mjs";

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

test("native review pins xhigh and all reviewer turns are read-only", () => {
  assert.deepEqual(
    buildThreadParams(ROOT, {
      model: "gpt-5.6-sol",
      effort: "xhigh",
      sandbox: "read-only",
      reviewModel: "gpt-5.6-sol",
    }),
    {
      cwd: ROOT,
      model: "gpt-5.6-sol",
      approvalPolicy: "never",
      sandbox: "read-only",
      serviceName: "claude_code_codex_plugin",
      ephemeral: true,
      experimentalRawEvents: false,
      config: {
        model_reasoning_effort: "xhigh",
        review_model: "gpt-5.6-sol",
      },
    },
  );

  const invoke = read("plugins/check-loop/scripts/codex-invoke.mjs");
  assert.match(
    invoke,
    /runAppServerReview\(workspaceRoot, \{[\s\S]*?effort: EFFORT,/,
  );
  assert.match(
    invoke,
    /runAppServerTurn\(workspaceRoot, \{[\s\S]*?sandbox: "read-only",/,
  );
  const help = execFileSync(
    process.execPath,
    [join(ROOT, "plugins/check-loop/scripts/codex-invoke.mjs"), "help"],
    { encoding: "utf8" },
  );
  assert.doesNotMatch(help, /--sandbox/);
});

test("plugin and marketplace publish version 4.0.0", () => {
  const plugin = readJson("plugins/check-loop/plugin.json");
  const marketplace = readJson(".claude-plugin/marketplace.json");
  assert.equal(plugin.version, "4.0.0");
  assert.equal(marketplace.metadata.version, "4.0.0");
  assert.equal(marketplace.plugins[0].version, "4.0.0");
});

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
  assert.match(
    body,
    /Conclude refinement when.*no independently verified critical or important finding remains/is,
  );
  assert.doesNotMatch(body, /Codex CLI default/);
});

test("skill frontmatter preserves names and trigger-only descriptions", () => {
  const plan = frontmatter("plugins/check-loop/skills/check-loop/SKILL.md");
  const execute = frontmatter("plugins/check-loop/skills/execute/SKILL.md");
  assert.match(plan, /^name: check-loop$/m);
  assert.match(execute, /^name: execute$/m);
  assert.match(plan, /^description: Refines implementation plans when /m);
  assert.match(execute, /^description: Executes approved multi-step plans when /m);
  for (const yaml of [plan, execute]) {
    assert.match(yaml, /^model: fable$/m);
    assert.match(yaml, /^effort: xhigh$/m);
    assert.match(yaml, /^argument-hint: \[plan-path\]$/m);
  }
});

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
  assert.match(
    body,
    /Complete the step when.*no independently verified critical or important finding remains/is,
  );
  assert.match(body, /independently verify/i);
});

test("implementer is Opus-only and leaves git ownership to Fable", () => {
  const body = read("plugins/check-loop/skills/execute/implementer-prompt.md");
  assert.match(body, /model: "opus"/);
  assert.match(body, /repository instructions/i);
  assert.match(body, /do not stage or commit/i);
  assert.doesNotMatch(
    body,
    /sonnet|safeStripeRedirect|NextResponse|Supabase|Result<T>/i,
  );
});

test("legacy Opus reviewer prompts are removed", () => {
  assert.equal(
    existsSync(
      join(
        ROOT,
        "plugins/check-loop/skills/execute/spec-reviewer-prompt.md",
      ),
    ),
    false,
  );
  assert.equal(
    existsSync(
      join(
        ROOT,
        "plugins/check-loop/skills/execute/code-quality-reviewer-prompt.md",
      ),
    ),
    false,
  );
});

test("research is a Fable Sol loop that produces one Markdown report", () => {
  const path = "plugins/check-loop/skills/research/SKILL.md";
  assert.equal(existsSync(join(ROOT, path)), true);
  const yaml = frontmatter(path);
  const body = read(path);
  assert.match(yaml, /^name: research$/m);
  assert.match(yaml, /^description: Researches questions when /m);
  assert.match(yaml, /^model: fable$/m);
  assert.match(yaml, /^effort: xhigh$/m);
  assert.match(yaml, /^argument-hint: \[research-question\]$/m);
  assert.match(body, /GPT-5\.6 Sol/);
  assert.match(body, /RESEARCH APPROVED/);
  assert.match(body, /VERIFIED \| INFERENCE \| UNVERIFIED/);
  assert.match(body, /independently verify/i);
  assert.match(body, /primary sources/i);
  assert.match(body, /one (?:final )?Markdown report/i);
  assert.match(
    body,
    /Conclude.*no independently verified critical or important finding remains/is,
  );
  assert.doesNotMatch(body, /model: "opus"|Agent tool/);
  const readme = read("README.md");
  assert.match(readme, /\/check-loop:research/);
  assert.match(readme, /one (?:final )?Markdown report/i);
  assert.match(readJson("plugins/check-loop/plugin.json").description, /research/i);
  assert.match(
    readJson(".claude-plugin/marketplace.json").plugins[0].description,
    /research/i,
  );
  assert.match(read("CLAUDE.md"), /check-loop:research|### `research`/);
});

test("README documents the version four orchestration contract", () => {
  const body = read("README.md");
  assert.match(body, /Version 4\.0\.0/i);
  assert.match(body, /Claude Code 2\.1\.255 or later/);
  assert.match(body, /Fable.*Opus.*GPT-5\.6 Sol/is);
  assert.match(body, /No evidence, no blocking finding/);
  assert.match(body, /VERIFIED.*INFERENCE.*UNVERIFIED/is);
  assert.match(body, /independently verifies/i);
  assert.doesNotMatch(body, /three review layers/i);
  assert.doesNotMatch(body, /\bsonnet\b/i);
  assert.doesNotMatch(body, /stash safety|spec review|quality review|desloppify/i);
});

test("repository guidance matches version four", () => {
  const body = read("CLAUDE.md");
  assert.match(body, /Fable.*Opus.*GPT-5\.6 Sol/is);
  assert.match(body, /Current version: \*\*4\.0\.0\*\*/);
  assert.doesNotMatch(body, /spec-reviewer-prompt|code-quality-reviewer-prompt/);
  assert.doesNotMatch(body, /CLI default|commits each step/i);
});
