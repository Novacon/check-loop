// Reviewer turns and native reviews over the Codex App Server.
import { CodexAppServerClient } from "./app-server.mjs";
import { binaryAvailable, runCommand } from "./process.mjs";

const SERVICE_NAME = "claude_code_codex_plugin";

function cleanCodexStderr(stderr) {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith("WARNING: proceeding, even though we could not update PATH:"))
    .join("\n");
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 3)}...`;
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} minute(s)` : `${seconds} second(s)`;
}

function threadConfig(options) {
  const config = {};
  if (options.effort) config.model_reasoning_effort = options.effort;
  if (options.reviewModel) config.review_model = options.reviewModel;
  return Object.keys(config).length ? { config } : {};
}

function getEffectiveThreadSettings(value) {
  const thread = value?.thread ?? value;
  return { model: thread?.model ?? null, effort: thread?.reasoningEffort ?? null };
}

export function assertEffectiveThreadSettings(thread, expected = {}) {
  const effective = getEffectiveThreadSettings(thread);
  if (expected.model && effective.model !== expected.model) {
    throw new Error(`Unexpected effective model: expected ${expected.model}, received ${effective.model ?? "unknown"}.`);
  }
  if (expected.effort && effective.effort !== expected.effort) {
    throw new Error(`Unexpected effective reasoning effort: expected ${expected.effort}, received ${effective.effort ?? "unknown"}.`);
  }
}

function describeItem(item, lifecycle) {
  switch (item.type) {
    case "commandExecution":
      return lifecycle === "started"
        ? `Running command: ${shorten(item.command)}`
        : `Command ${item.status}: ${shorten(item.command)} (exit ${item.exitCode ?? "?"})`;
    case "mcpToolCall":
      return `Tool ${item.server}/${item.tool} ${lifecycle}.`;
    case "webSearch":
      return lifecycle === "started" ? `Searching: ${shorten(item.query)}` : null;
    case "enteredReviewMode":
      return `Reviewer started: ${item.review}`;
    case "exitedReviewMode":
      return "Reviewer finished.";
    default:
      return null;
  }
}

/** Fold one notification into the capture state. Exported for tests. */
export function applyTurnNotification(state, message) {
  const say = (text) => text && state.onProgress?.(text);
  const { method, params } = message;
  if (method === "model/rerouted") {
    if (state.expectedModel && params.toModel !== state.expectedModel) {
      state.error = new Error(`Unexpected model reroute: expected ${state.expectedModel}, received ${params.toModel ?? "unknown"} from ${params.fromModel ?? "unknown"}.`);
      say(state.error.message);
    }
    return;
  }
  if (method === "error") {
    state.error = params.error;
    say(`Codex error: ${params.error.message}`);
    return;
  }
  if (params?.threadId !== state.threadId) return;
  if (method === "turn/started") {
    say(`Turn started (${params.turn.id}).`);
  } else if (method === "item/started" || method === "item/completed") {
    const item = params.item;
    const lifecycle = method === "item/started" ? "started" : "completed";
    if (item.type === "agentMessage" && item.text) state.lastAgentMessage = item.text;
    if (item.type === "exitedReviewMode") state.reviewText = item.review ?? "";
    say(describeItem(item, lifecycle));
  } else if (method === "turn/completed") {
    say(`Turn ${params.turn.status}.`);
    state.finalTurn = params.turn;
    state.resolve();
  }
}

/** Issue one streaming request and wait for its turn to complete or time out. */
async function captureTurn(client, threadId, startRequest, { expectedModel = null, onProgress = null, timeoutMs = 0 }) {
  let resolve;
  const completion = new Promise((done) => {
    resolve = done;
  });
  const state = { threadId, expectedModel, onProgress, error: null, finalTurn: null, lastAgentMessage: "", reviewText: "", turnId: null, resolve };
  const buffered = [];
  client.setNotificationHandler((message) => (state.turnId ? applyTurnNotification(state, message) : buffered.push(message)));

  let deadline = null;
  const timedOut = timeoutMs > 0
    ? new Promise((done) => {
        deadline = setTimeout(async () => {
          state.error = new Error(`Reviewer turn timed out after ${formatDuration(timeoutMs)} and was interrupted. This is an incomplete review, not approval.`);
          onProgress?.(state.error.message);
          if (state.turnId) {
            await Promise.race([
              client.request("turn/interrupt", { threadId, turnId: state.turnId }).catch(() => {}),
              new Promise((wait) => setTimeout(wait, 5_000).unref?.()),
            ]);
          }
          state.finalTurn = { id: state.turnId ?? "timed-out-turn", status: "interrupted" };
          done();
        }, timeoutMs);
        deadline.unref?.();
      })
    : null;

  try {
    const response = await startRequest();
    state.turnId = response.turn?.id ?? null;
    for (const message of buffered) applyTurnNotification(state, message);
    if (response.turn?.status && response.turn.status !== "inProgress") {
      state.finalTurn = response.turn;
      resolve();
    }
    await (timedOut ? Promise.race([completion, timedOut]) : completion);
    return state;
  } finally {
    clearTimeout(deadline);
    client.setNotificationHandler(null);
  }
}

async function withAppServer(cwd, fn) {
  const client = await CodexAppServerClient.connect(cwd);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export function buildResultStatus(turnState) {
  return !turnState.error && turnState.finalTurn?.status === "completed" ? 0 : 1;
}

export function getCodexAvailability(cwd) {
  const version = binaryAvailable("codex", ["--version"], { cwd });
  if (!version.available) return version;
  const appServer = binaryAvailable("codex", ["app-server", "--help"], { cwd });
  return appServer.available
    ? { available: true, detail: `${version.detail}; advanced runtime available` }
    : { available: false, detail: `${version.detail}; advanced runtime unavailable: ${appServer.detail}` };
}

export function getCodexLoginStatus(cwd) {
  const result = runCommand("codex", ["login", "status"], { cwd });
  if (result.error) return { loggedIn: false, detail: result.error.message };
  return result.status === 0
    ? { loggedIn: true, detail: result.stdout.trim() || "authenticated" }
    : { loggedIn: false, detail: result.stderr.trim() || result.stdout.trim() || "not authenticated" };
}

export async function runAppServerReview(cwd, options = {}) {
  return withAppServer(cwd, async (client) => {
    options.onProgress?.("Starting Codex review thread.");
    const thread = await client.request("thread/start", {
      cwd,
      model: options.model ?? null,
      approvalPolicy: "never",
      sandbox: "read-only",
      serviceName: SERVICE_NAME,
      ephemeral: true,
      experimentalRawEvents: false,
      ...threadConfig({ effort: options.effort, reviewModel: options.model }),
    });
    assertEffectiveThreadSettings(thread, options);
    const threadId = thread.thread.id;
    const effective = getEffectiveThreadSettings(thread);
    options.onProgress?.(`Thread ready (${threadId}).`);

    const state = await captureTurn(
      client,
      threadId,
      () => client.request("review/start", { threadId, delivery: "inline", target: options.target }),
      // Native review may use a separate review_model that thread/start does not
      // report, so only an explicit override is a known reviewer model.
      { onProgress: options.onProgress, expectedModel: options.model ?? null, timeoutMs: options.timeoutMs ?? 0 },
    );
    return {
      status: buildResultStatus(state),
      threadId,
      turnId: state.turnId,
      model: options.model ?? null,
      effort: effective.effort,
      reviewText: state.reviewText,
      turn: state.finalTurn,
      error: state.error,
      stderr: cleanCodexStderr(client.stderr),
    };
  });
}

export async function runAppServerTurn(cwd, options = {}) {
  return withAppServer(cwd, async (client) => {
    const base = { cwd, model: options.model ?? null, approvalPolicy: "never", sandbox: options.sandbox ?? "read-only", ...threadConfig(options) };
    let response;
    if (options.resumeThreadId) {
      options.onProgress?.(`Resuming thread ${options.resumeThreadId}.`);
      response = await client.request("thread/resume", { threadId: options.resumeThreadId, ...base });
    } else {
      options.onProgress?.("Starting Codex task thread.");
      response = await client.request("thread/start", { ...base, serviceName: SERVICE_NAME, ephemeral: !options.persistThread, experimentalRawEvents: false });
    }
    assertEffectiveThreadSettings(response, options);
    const threadId = response.thread.id;
    const effective = getEffectiveThreadSettings(response);
    options.onProgress?.(`Thread ready (${threadId}).`);

    const prompt = options.prompt?.trim();
    if (!prompt) throw new Error("A prompt is required for this Codex run.");

    const state = await captureTurn(
      client,
      threadId,
      () => client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: prompt, text_elements: [] }],
        model: effective.model,
        effort: effective.effort,
        outputSchema: options.outputSchema ?? null,
      }),
      { onProgress: options.onProgress, expectedModel: effective.model, timeoutMs: options.timeoutMs ?? 0 },
    );
    return {
      status: buildResultStatus(state),
      threadId,
      turnId: state.turnId,
      model: effective.model,
      effort: effective.effort,
      finalMessage: state.lastAgentMessage,
      turn: state.finalTurn,
      error: state.error,
      stderr: cleanCodexStderr(client.stderr),
    };
  });
}
