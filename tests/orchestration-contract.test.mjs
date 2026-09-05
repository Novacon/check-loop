import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
