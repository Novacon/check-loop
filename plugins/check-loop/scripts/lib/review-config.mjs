import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SETTING_KEYS = ["model", "effort", "maxRounds"];
const DEFAULT_SETTINGS = Object.freeze({
  model: null,
  effort: null,
  maxRounds: 6,
});

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function userConfigRoot(env) {
  const configuredRoot = env.CLAUDE_CONFIG_DIR;
  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(os.homedir(), ".claude");
}

function configPaths(cwd, env) {
  return {
    project: path.join(path.resolve(cwd), ".claude", "check-loop.json"),
    user: path.join(userConfigRoot(env), "check-loop", "config.json"),
  };
}

function validateSettings(settings, source) {
  if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error(`Invalid review config at ${source}: expected a JSON object.`);
  }

  for (const key of Object.keys(settings)) {
    if (!SETTING_KEYS.includes(key)) {
      throw new Error(`Invalid review config at ${source}: unsupported setting ${JSON.stringify(key)}.`);
    }
  }

  for (const key of ["model", "effort"]) {
    if (!hasOwn(settings, key)) {
      continue;
    }
    const value = settings[key];
    if (value !== null && (typeof value !== "string" || value.trim().length === 0)) {
      throw new Error(`Invalid review config at ${source}: ${key} must be a non-empty string or null.`);
    }
  }

  if (
    hasOwn(settings, "maxRounds") &&
    (!Number.isInteger(settings.maxRounds) || settings.maxRounds < 1 || settings.maxRounds > 40)
  ) {
    throw new Error(`Invalid review config at ${source}: maxRounds must be an integer from 1 through 40.`);
  }

  return settings;
}

function readConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid review config at ${filePath}: ${detail}`);
  }
  return validateSettings(parsed, filePath);
}

function commandSettings(options) {
  const settings = {};
  for (const key of SETTING_KEYS) {
    if (hasOwn(options, key)) {
      settings[key] = options[key];
    }
  }
  return validateSettings(settings, "command options");
}

/**
 * Resolve reviewer settings independently per key.
 * Command options override project settings, which override user settings.
 */
export function resolveReviewConfig(cwd, options = {}) {
  const env = options.env ?? process.env;
  const paths = configPaths(cwd, env);
  const user = readConfig(paths.user);
  const project = readConfig(paths.project);
  const command = commandSettings(options);

  return {
    ...DEFAULT_SETTINGS,
    ...user,
    ...project,
    ...command,
  };
}

/** Persist only the supplied settings and preserve all other valid settings. */
export function updateReviewConfig(cwd, updates, options = {}) {
  const env = options.env ?? process.env;
  // Validate both precedence layers before mutating either file. A malformed
  // config must not allow a command that ultimately fails to partially save.
  resolveReviewConfig(cwd, { env });
  const paths = configPaths(cwd, env);
  const filePath = options.project ? paths.project : paths.user;
  const existing = readConfig(filePath);
  const validatedUpdates = commandSettings(updates);
  const next = validateSettings({ ...existing, ...validatedUpdates }, filePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return resolveReviewConfig(cwd, { env });
}
