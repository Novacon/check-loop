// Minimal JSON-RPC client over a spawned `codex app-server` process.
import fs from "node:fs";
import process from "node:process";
import { spawn } from "node:child_process";
import readline from "node:readline";

const PLUGIN_MANIFEST = JSON.parse(fs.readFileSync(new URL("../../plugin.json", import.meta.url), "utf8"));

const CLIENT_INFO = {
  title: "check-loop",
  name: "Claude Code",
  version: PLUGIN_MANIFEST.version ?? "0.0.0",
};

// Deltas are noise for a non-interactive reviewer; completed items carry the text.
const CAPABILITIES = {
  experimentalApi: false,
  optOutNotificationMethods: [
    "item/agentMessage/delta",
    "item/reasoning/summaryTextDelta",
    "item/reasoning/summaryPartAdded",
    "item/reasoning/textDelta",
  ],
};

function protocolError(message, data) {
  const error = new Error(message);
  error.data = data;
  if (data?.code !== undefined) error.rpcCode = data.code;
  return error;
}

export class CodexAppServerClient {
  static async connect(cwd, options = {}) {
    const client = new CodexAppServerClient(cwd, options);
    await client.initialize();
    return client;
  }

  constructor(cwd, options = {}) {
    this.cwd = cwd;
    this.options = options;
    this.pending = new Map();
    this.nextId = 1;
    this.stderr = "";
    this.closed = false;
    this.exitError = null;
    this.exitResolved = false;
    this.notificationHandler = null;
    this.exitPromise = new Promise((resolve) => {
      this.resolveExit = resolve;
    });
  }

  setNotificationHandler(handler) {
    this.notificationHandler = handler;
  }

  request(method, params) {
    if (this.closed) throw new Error("codex app-server client is closed.");
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.send({ id, method, params });
    });
  }

  notify(method, params = {}) {
    if (!this.closed) this.send({ method, params });
  }

  send(message) {
    const stdin = this.proc?.stdin;
    if (!stdin) throw new Error("codex app-server stdin is not available.");
    stdin.write(`${JSON.stringify(message)}\n`);
  }

  handleLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      this.handleExit(protocolError(`Failed to parse codex app-server JSONL: ${error.message}`, { line }));
      return;
    }
    if (message.id !== undefined && message.method) {
      this.send({ id: message.id, error: { code: -32601, message: `Unsupported server request: ${message.method}` } });
      return;
    }
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(protocolError(message.error.message ?? `codex app-server ${pending.method} failed.`, message.error));
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }
    if (message.method) this.notificationHandler?.(message);
  }

  handleExit(error) {
    if (this.exitResolved) return;
    this.exitResolved = true;
    this.exitError = error ?? null;
    for (const pending of this.pending.values()) {
      pending.reject(this.exitError ?? new Error("codex app-server connection closed."));
    }
    this.pending.clear();
    this.resolveExit();
  }

  async initialize() {
    this.proc = spawn("codex", ["app-server"], {
      cwd: this.cwd,
      env: this.options.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
      windowsHide: true,
    });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.proc.on("error", (error) => this.handleExit(error));
    this.proc.on("exit", (code, signal) => {
      this.handleExit(code === 0 ? null : protocolError(`codex app-server exited unexpectedly (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
    this.readline = readline.createInterface({ input: this.proc.stdout });
    this.readline.on("line", (line) => this.handleLine(line));

    await this.request("initialize", { clientInfo: CLIENT_INFO, capabilities: CAPABILITIES });
    this.notify("initialized", {});
  }

  async close() {
    if (this.closed) return this.exitPromise;
    this.closed = true;
    this.readline?.close();
    if (this.proc && this.proc.exitCode === null) {
      this.proc.stdin.end();
      setTimeout(() => {
        if (this.proc.exitCode === null) this.proc.kill("SIGTERM");
      }, 50).unref?.();
    }
    return this.exitPromise;
  }
}
