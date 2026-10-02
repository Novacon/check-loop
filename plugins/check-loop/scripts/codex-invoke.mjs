#!/usr/bin/env node

/**
 * CLI wrapper around the Codex App Server transport.
 *
 * Reviewer settings are resolved per key from command options, project
 * configuration, user configuration, and finally Codex/default plugin values.
 */

import path from "node:path";
import process from "node:process";

import { parseArgs } from "./lib/args.mjs";
import {
  getCodexAvailability,
  getCodexLoginStatus,
  runAppServerReview,
  runAppServerTurn,
} from "./lib/codex.mjs";
import { resolveReviewTarget } from "./lib/git.mjs";
import { resolveReviewConfig, updateReviewConfig } from "./lib/review-config.mjs";
import { buildReviewResult } from "./lib/review-result.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveCwd(options) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseCommandArgs(argv, config, command) {
  const valueOptions = new Set(config.valueOptions ?? []);
  const booleanOptions = new Set(config.booleanOptions ?? []);
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      break;
    }
    if (!token.startsWith("-") || token === "-") {
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unknown ${command} option: ${token}.`);
    }

    const equalsIndex = token.indexOf("=");
    const key = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    if (!valueOptions.has(key) && !booleanOptions.has(key)) {
      throw new Error(`Unknown ${command} option: --${key}.`);
    }
    if (seen.has(key)) {
      throw new Error(`Duplicate ${command} option: --${key}.`);
    }
    seen.add(key);

    if (booleanOptions.has(key)) {
      if (equalsIndex !== -1) {
        throw new Error(`Option --${key} does not take a value.`);
      }
      continue;
    }

    if (equalsIndex === -1) {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("-")) {
        throw new Error(`Missing value for --${key}.`);
      }
      index += 1;
    }
  }

  const { options, positionals } = parseArgs(argv, config);
  if (positionals.length > 0) {
    throw new Error(`Unexpected ${command} argument: ${positionals.map(JSON.stringify).join(", ")}.`);
  }
  return options;
}

function parseMaxRounds(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error("Invalid maximum review rounds: expected an integer from 1 through 40.");
  }
  const maxRounds = Number(value);
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 40) {
    throw new Error("Invalid maximum review rounds: expected an integer from 1 through 40.");
  }
  return maxRounds;
}

function reviewOverrides(options, includeMaxRounds = false) {
  const overrides = {};
  for (const key of ["model", "effort"]) {
    if (hasOwn(options, key)) {
      overrides[key] = options[key] === "default" ? null : options[key];
    }
  }
  if (includeMaxRounds && hasOwn(options, "max-rounds")) {
    overrides.maxRounds = parseMaxRounds(options["max-rounds"]);
  }
  return overrides;
}

function displaySetting(value) {
  return value ?? "Codex default";
}

function writeCommandResult(result, response) {
  const payload = buildReviewResult(result, response);
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  if (payload.status !== 0) {
    process.stderr.write(`[codex] ${payload.error}\n`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// turn -- start or continue a Codex conversation
// ---------------------------------------------------------------------------

async function handleTurn(argv) {
  const options = parseCommandArgs(argv, {
    valueOptions: ["prompt", "thread-id", "cwd", "model", "effort"],
  }, "turn");

  if (!options.prompt) {
    throw new Error(
      "Usage: node codex-invoke.mjs turn --prompt <text> [--thread-id <id>] [--cwd <path>] [--model <id|default>] [--effort <level|default>]"
    );
  }

  const cwd = resolveCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const config = resolveReviewConfig(cwd, reviewOverrides(options));

  const result = await runAppServerTurn(workspaceRoot, {
    resumeThreadId: options["thread-id"] ?? null,
    prompt: options.prompt,
    model: config.model,
    effort: config.effort,
    sandbox: "read-only",
    persistThread: true,
    onProgress: (event) => {
      const msg = typeof event === "string" ? event : event?.message;
      if (msg) {
        process.stderr.write(`[codex] ${msg}\n`);
      }
    },
  });

  writeCommandResult(result, result.finalMessage);
}

// ---------------------------------------------------------------------------
// review -- native Codex code review via review/start
// ---------------------------------------------------------------------------

async function handleReview(argv) {
  const options = parseCommandArgs(argv, {
    valueOptions: ["scope", "base", "cwd", "model", "effort"],
  }, "review");

  const cwd = resolveCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const config = resolveReviewConfig(cwd, reviewOverrides(options));

  const target = resolveReviewTarget(cwd, {
    base: options.base ?? null,
    scope: options.scope ?? "auto",
  });

  let nativeTarget;
  if (target.mode === "working-tree") {
    nativeTarget = { type: "uncommittedChanges" };
  } else if (target.mode === "branch") {
    nativeTarget = { type: "baseBranch", branch: target.baseRef };
  } else {
    throw new Error(`Unsupported review target mode: ${target.mode}`);
  }

  const result = await runAppServerReview(workspaceRoot, {
    target: nativeTarget,
    model: config.model,
    effort: config.effort,
    onProgress: (event) => {
      const msg = typeof event === "string" ? event : event?.message;
      if (msg) {
        process.stderr.write(`[codex] ${msg}\n`);
      }
    },
  });

  writeCommandResult(result, result.reviewText);
}

// ---------------------------------------------------------------------------
// setup -- verify Codex CLI readiness
// ---------------------------------------------------------------------------

function handleSetup(argv) {
  const options = parseCommandArgs(argv, {
    valueOptions: ["cwd", "model", "effort", "max-rounds"],
  }, "setup");

  const cwd = resolveCwd(options);
  const config = resolveReviewConfig(cwd, reviewOverrides(options, true));
  const codexStatus = getCodexAvailability(cwd);
  const authStatus = getCodexLoginStatus(cwd);

  const lines = [
    "# Codex Setup (check-loop)",
    "",
    `Model: ${displaySetting(config.model)}`,
    `Reasoning effort: ${displaySetting(config.effort)}`,
    `Maximum review rounds: ${config.maxRounds}`,
    "Model availability is checked when a review starts; setup checks installation and authentication only.",
    "",
    "Checks:",
    `- codex CLI: ${codexStatus.available ? "installed" : "NOT FOUND"} -- ${codexStatus.detail}`,
    `- auth: ${authStatus.loggedIn ? "authenticated" : "NOT AUTHENTICATED"} -- ${authStatus.detail}`,
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
  if (!codexStatus.available || !authStatus.loggedIn) {
    process.exitCode = 1;
  }
}

function handleConfig(argv) {
  const options = parseCommandArgs(argv, {
    valueOptions: ["cwd", "model", "effort", "max-rounds"],
    booleanOptions: ["project"],
  }, "config");

  const cwd = resolveCwd(options);
  const updates = reviewOverrides(options, true);
  const config = Object.keys(updates).length > 0
    ? updateReviewConfig(cwd, updates, { project: options.project === true })
    : resolveReviewConfig(cwd);
  process.stdout.write(`${JSON.stringify(config)}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [subcommand, ...argv] = process.argv.slice(2);

  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    process.stdout.write([
      "Usage:",
      "  node codex-invoke.mjs config [--cwd <path>] [--project] [--model <id|default>] [--effort <level|default>] [--max-rounds <1..40>]",
      "  node codex-invoke.mjs turn --prompt <text> [--thread-id <id>] [--cwd <path>] [--model <id|default>] [--effort <level|default>]",
      "  node codex-invoke.mjs review [--scope <auto|working-tree|branch>] [--base <ref>] [--cwd <path>] [--model <id|default>] [--effort <level|default>]",
      "  node codex-invoke.mjs setup [--cwd <path>] [--model <id|default>] [--effort <level|default>] [--max-rounds <1..40>]",
      "",
      "Reviewer model and effort default to the effective Codex settings.",
      "",
    ].join("\n"));
    return;
  }

  switch (subcommand) {
    case "config":
      handleConfig(argv);
      break;
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
      throw new Error(`Unknown subcommand: ${subcommand}. Use: config, turn, review, setup`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
