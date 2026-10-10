import { runCommand } from "./process.mjs";

function git(cwd, args) {
  return runCommand("git", args, { cwd });
}

export function ensureGitRepository(cwd) {
  const result = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (result.error?.code === "ENOENT") {
    throw new Error("git is not installed. Install Git and retry.");
  }
  if (result.status !== 0) {
    throw new Error("This command must run inside a Git repository.");
  }
  return result.stdout.trim();
}

function detectDefaultBranch(cwd) {
  const symbolic = git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (symbolic.status === 0 && symbolic.stdout.trim().startsWith("refs/remotes/origin/")) {
    return symbolic.stdout.trim().replace("refs/remotes/origin/", "");
  }
  for (const candidate of ["main", "master", "trunk"]) {
    if (git(cwd, ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`]).status === 0) return candidate;
    if (git(cwd, ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${candidate}`]).status === 0) return `origin/${candidate}`;
  }
  throw new Error("Unable to detect the repository default branch. Pass --base <ref> or use --scope working-tree.");
}

function isDirty(cwd) {
  return git(cwd, ["status", "--porcelain"]).stdout.trim().length > 0;
}

/** Choose the native review target: working tree when dirty or asked, otherwise a branch diff. */
export function resolveReviewTarget(cwd, { base = null, scope = "auto" } = {}) {
  ensureGitRepository(cwd);
  if (base) return { mode: "branch", baseRef: base };
  if (scope === "working-tree") return { mode: "working-tree" };
  if (!["auto", "branch"].includes(scope)) {
    throw new Error(`Unsupported review scope "${scope}". Use one of: auto, working-tree, branch, or pass --base <ref>.`);
  }
  if (scope === "auto" && isDirty(cwd)) return { mode: "working-tree" };
  return { mode: "branch", baseRef: detectDefaultBranch(cwd) };
}
