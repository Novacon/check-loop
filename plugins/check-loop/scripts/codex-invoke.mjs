#!/usr/bin/env node

/**
 * codex-invoke.mjs -- CLI wrapper around Codex App Server protocol.
 *
 * Uses the official OpenAI transport layer (broker + direct fallback, proper
 * streaming, notification handling). Uses Codex CLI OAuth session with xhigh
 * reasoning for all operations.
 *
 * Subcommands:
 *
 *   turn   --prompt "..." [--thread-id ID] [--cwd PATH] [--sandbox MODE]
 *          Start or continue a Codex conversation.
 *          Output: JSON { threadId, response }
 *
 *   review [--scope auto|working-tree|branch] [--base REF] [--cwd PATH]
 *          Run a native Codex code review against local git state.
 *          Output: JSON { threadId, response }
 *
 *   setup  [--cwd PATH]
 *          Check Codex CLI readiness (installed, authenticated).
 *          Output: human-readable status report
 */

import path from "node:path";
import process from "node:process";

import { parseArgs } from "./lib/args.mjs";
import {
  getCodexAvailability,
  getCodexLoginStatus,
  getSessionRuntimeStatus,
  runAppServerReview,
  runAppServerTurn,
} from "./lib/codex.mjs";
import { resolveReviewTarget } from "./lib/git.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";

// ---------------------------------------------------------------------------
// Model contract -- Sol reviews every plan and implementation step.
// ---------------------------------------------------------------------------

const MODEL = "gpt-5.6-sol";
const EFFORT = "xhigh";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveCwd(options) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// turn -- start or continue a Codex conversation
// ---------------------------------------------------------------------------

async function handleTurn(argv) {
  const { options } = parseArgs(argv, {
    valueOptions: ["prompt", "thread-id", "cwd", "sandbox"],
  });

  if (!options.prompt) {
    fail("Usage: node codex-invoke.mjs turn --prompt <text> [--thread-id <id>] [--cwd <path>] [--sandbox <mode>]");
  }

  const cwd = resolveCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const sandbox = options.sandbox ?? "read-only";

  const result = await runAppServerTurn(workspaceRoot, {
    resumeThreadId: options["thread-id"] ?? null,
    prompt: options.prompt,
    model: MODEL,
    effort: EFFORT,
    sandbox,
    persistThread: true,
    onProgress: (event) => {
      const msg = typeof event === "string" ? event : event?.message;
      if (msg) {
        process.stderr.write(`[codex] ${msg}\n`);
      }
    },
  });

  const response = result.finalMessage ?? "";
  process.stdout.write(`${JSON.stringify({ threadId: result.threadId, response })}\n`);

  if (result.status !== 0) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// review -- native Codex code review via review/start
// ---------------------------------------------------------------------------

async function handleReview(argv) {
  const { options } = parseArgs(argv, {
    valueOptions: ["scope", "base", "cwd"],
  });

  const cwd = resolveCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);

  const target = resolveReviewTarget(cwd, {
    base: options.base ?? null,
    scope: options.scope ?? "auto",
  });

  // Build native review target for review/start
  let nativeTarget;
  if (target.mode === "working-tree") {
    nativeTarget = { type: "uncommittedChanges" };
  } else if (target.mode === "branch") {
    nativeTarget = { type: "baseBranch", branch: target.baseRef };
  } else {
    fail(`Unsupported review target mode: ${target.mode}`);
  }

  const result = await runAppServerReview(workspaceRoot, {
    target: nativeTarget,
    model: MODEL,
    onProgress: (event) => {
      const msg = typeof event === "string" ? event : event?.message;
      if (msg) {
        process.stderr.write(`[codex] ${msg}\n`);
      }
    },
  });

  const response = result.reviewText ?? "";
  process.stdout.write(`${JSON.stringify({ threadId: result.threadId, response })}\n`);

  if (result.status !== 0) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// setup -- verify Codex CLI readiness
// ---------------------------------------------------------------------------

function handleSetup(argv) {
  const { options } = parseArgs(argv, {
    valueOptions: ["cwd"],
  });

  const cwd = resolveCwd(options);
  const codexStatus = getCodexAvailability(cwd);
  const authStatus = getCodexLoginStatus(cwd);
  const runtimeStatus = getSessionRuntimeStatus();

  const lines = [
    "# Codex Setup (check-loop)",
    "",
    `Model: ${MODEL}`,
    `Reasoning effort: ${EFFORT}`,
    "",
    "Checks:",
    `- codex CLI: ${codexStatus.available ? "installed" : "NOT FOUND"} -- ${codexStatus.detail}`,
    `- auth: ${authStatus.loggedIn ? "authenticated" : "NOT AUTHENTICATED"} -- ${authStatus.detail}`,
    `- session runtime: ${runtimeStatus.label}`,
    "",
  ];

  const nextSteps = [];
  if (!codexStatus.available) {
    nextSteps.push("Install Codex with `npm install -g @openai/codex`.");
  }
  if (codexStatus.available && !authStatus.loggedIn) {
    nextSteps.push("Run `!codex login` to authenticate.");
    nextSteps.push("If browser login is blocked, try `!codex login --device-auth` or `!codex login --with-api-key`.");
  }

  if (nextSteps.length > 0) {
    lines.push("Next steps:");
    for (const step of nextSteps) {
      lines.push(`- ${step}`);
    }
  } else {
    lines.push("Status: ready");
  }

  process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [subcommand, ...argv] = process.argv.slice(2);

  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    process.stdout.write([
      "Usage:",
      "  node codex-invoke.mjs turn --prompt <text> [--thread-id <id>] [--cwd <path>] [--sandbox <mode>]",
      "  node codex-invoke.mjs review [--scope <auto|working-tree|branch>] [--base <ref>] [--cwd <path>]",
      "  node codex-invoke.mjs setup [--cwd <path>]",
      "",
      `Model: ${MODEL} | Effort: ${EFFORT}`,
      "",
    ].join("\n"));
    return;
  }

  switch (subcommand) {
    case "turn":
      await handleTurn(argv);
      break;
    case "review":
      await handleReview(argv);
      break;
    case "setup":
      handleSetup(argv);
      break;
    default:
      fail(`Unknown subcommand: ${subcommand}. Use: turn, review, setup`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
