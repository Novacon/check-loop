#!/usr/bin/env node

/**
 * codex-invoke.mjs -- Thin CLI wrapper around the Codex App Server protocol.
 *
 * Usage:
 *   node codex-invoke.mjs turn --prompt "..."                    # new thread
 *   node codex-invoke.mjs turn --thread-id <id> --prompt "..."   # continue thread
 *   node codex-invoke.mjs turn --prompt "..." --cwd /path        # set working dir
 *
 * Output: JSON to stdout with { threadId, response }
 * Model and reasoning effort come from ~/.codex/config.toml (no params needed).
 */

import { spawn } from "node:child_process";
import readline from "node:readline";
import process from "node:process";

// ---------------------------------------------------------------------------
// JSON-RPC client over stdio to `codex app-server`
// ---------------------------------------------------------------------------

class AppServerClient {
  constructor() {
    this.pending = new Map();
    this.nextId = 1;
    this.closed = false;
    this.notificationHandler = null;
    this.proc = null;
    this.exitPromise = null;
  }

  async connect(cwd) {
    this.proc = spawn("codex", ["app-server"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");

    // Collect stderr for diagnostics
    this.stderr = "";
    this.proc.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });

    this.exitPromise = new Promise((resolve) => {
      this.proc.on("exit", (code, signal) => {
        this.closed = true;
        // Reject all pending requests
        for (const p of this.pending.values()) {
          p.reject(new Error(`codex app-server exited (${signal ?? `code ${code}`})`));
        }
        this.pending.clear();
        resolve();
      });
      this.proc.on("error", (err) => {
        this.closed = true;
        for (const p of this.pending.values()) {
          p.reject(err);
        }
        this.pending.clear();
        resolve();
      });
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => this._handleLine(line));

    // Initialize handshake
    await this.request("initialize", {
      clientInfo: {
        title: "check-loop",
        name: "Claude Code",
        version: "2.0.0",
      },
      capabilities: {
        experimentalApi: false,
        optOutNotificationMethods: [
          "item/agentMessage/delta",
          "item/reasoning/summaryTextDelta",
          "item/reasoning/summaryPartAdded",
          "item/reasoning/textDelta",
        ],
      },
    });
    this.notify("initialized", {});
  }

  request(method, params) {
    if (this.closed) throw new Error("Client is closed");
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this._send({ id, method, params });
    });
  }

  notify(method, params = {}) {
    if (!this.closed) this._send({ method, params });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.proc && !this.proc.killed) {
      this.proc.stdin.end();
      setTimeout(() => {
        if (this.proc && !this.proc.killed && this.proc.exitCode === null) {
          this.proc.kill("SIGTERM");
        }
      }, 100).unref?.();
    }
    await this.exitPromise;
  }

  _send(msg) {
    this.proc?.stdin?.write(JSON.stringify(msg) + "\n");
  }

  _handleLine(line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    // Response to our request
    if (msg.id !== undefined && !msg.method) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        p.reject(new Error(msg.error.message ?? "RPC error"));
      } else {
        p.resolve(msg.result ?? {});
      }
      return;
    }

    // Server-initiated request (respond with unsupported)
    if (msg.id !== undefined && msg.method) {
      this._send({
        id: msg.id,
        error: { code: -32601, message: `Unsupported: ${msg.method}` },
      });
      return;
    }

    // Notification
    if (msg.method && this.notificationHandler) {
      this.notificationHandler(msg);
    }
  }
}

// ---------------------------------------------------------------------------
// Turn capture -- collects the full response from streaming notifications
// ---------------------------------------------------------------------------

function captureTurn(client) {
  return new Promise((resolve, reject) => {
    const agentMessages = []; // full text from item/completed agentMessage items
    let turnCompleted = false;

    client.notificationHandler = (msg) => {
      const method = msg.method;
      const params = msg.params ?? {};

      // Capture completed agent messages (contains full text)
      if (method === "item/completed" && params.item?.type === "agentMessage") {
        const text = params.item.text ?? "";
        if (text) agentMessages.push(text);
      }

      if (method === "turn/completed") {
        turnCompleted = true;
        resolve(agentMessages.join("\n\n"));
      }

      if (method === "error") {
        reject(new Error(params.message ?? "Codex error"));
      }
    };

    // Safety timeout -- 10 minutes
    setTimeout(() => {
      if (!turnCompleted) {
        reject(new Error("Turn timed out after 10 minutes"));
      }
    }, 10 * 60 * 1000).unref?.();
  });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--prompt" && i + 1 < argv.length) {
      opts.prompt = argv[++i];
    } else if (argv[i] === "--thread-id" && i + 1 < argv.length) {
      opts.threadId = argv[++i];
    } else if (argv[i] === "--cwd" && i + 1 < argv.length) {
      opts.cwd = argv[++i];
    } else if (argv[i] === "--sandbox" && i + 1 < argv.length) {
      opts.sandbox = argv[++i];
    } else if (argv[i] === "turn") {
      opts.command = "turn";
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.command !== "turn" || !opts.prompt) {
    process.stderr.write(
      "Usage: node codex-invoke.mjs turn --prompt <text> [--thread-id <id>] [--cwd <path>] [--sandbox <mode>]\n"
    );
    process.exit(1);
  }

  const cwd = opts.cwd ?? process.cwd();
  const client = new AppServerClient();

  try {
    await client.connect(cwd);

    let threadId = opts.threadId;

    // Start a new thread or resume an existing one
    if (threadId) {
      const resumeResult = await client.request("thread/resume", {
        threadId,
      });
      threadId = resumeResult.thread?.id ?? threadId;
    } else {
      const threadResult = await client.request("thread/start", {
        instructions: null,
      });
      threadId = threadResult.thread?.id ?? threadResult.threadId;
      if (!threadId) {
        throw new Error(
          "thread/start did not return a thread ID. Result: " +
            JSON.stringify(threadResult).slice(0, 200)
        );
      }
    }

    // Set up turn capture before starting the turn
    const responsePromise = captureTurn(client);

    // Start the turn
    await client.request("turn/start", {
      threadId,
      input: [{ type: "text", text: opts.prompt }],
    });

    // Wait for the full response
    const response = await responsePromise;

    // Output result as JSON
    process.stdout.write(
      JSON.stringify({ threadId, response }) + "\n"
    );
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    if (client.stderr) {
      process.stderr.write(`Codex stderr: ${client.stderr}\n`);
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
