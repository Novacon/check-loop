import { spawnSync } from "node:child_process";
import process from "node:process";

export function runCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
  };
}

export function binaryAvailable(command, versionArgs = ["--version"], options = {}) {
  const result = runCommand(command, versionArgs, options);
  if (result.error?.code === "ENOENT") return { available: false, detail: "not found" };
  if (result.error) return { available: false, detail: result.error.message };
  if (result.status !== 0) {
    return { available: false, detail: result.stderr.trim() || result.stdout.trim() || `exit ${result.status}` };
  }
  return { available: true, detail: result.stdout.trim() || result.stderr.trim() || "ok" };
}
