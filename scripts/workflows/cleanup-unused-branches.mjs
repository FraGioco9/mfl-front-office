// Safe GitHub PR-aware cleanup: only trusted main invokes this executable.
// All queries are complete, validated snapshots. Errors fail closed.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAX_PAGE_SIZE = 100;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function repositoryName(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("Invalid repository identity.");
  }
  return value.toLowerCase();
}

function validRef(value) {
  return typeof value === "string"
    && value.length > 0
    && !/[\u0000-\u0020\u007f]/.test(value)
    && !value.startsWith("-")
    && !value.startsWith("/")
    && !value.endsWith("/")
    && !value.endsWith(".lock")
    && !value.includes("..")
    && !value.includes("//")
    && !value.includes("@{");
}

function requireRef(value, label) {
  if (!validRef(value)) throw new Error("Invalid " + label + " in GitHub snapshot.");
  return value;
}

export function parseOpenPulls(raw, repository) {
  const repo = repositoryName(repository);
  let pages;
  try { pages = JSON.parse(raw); } catch { throw new Error("Malformed paginated GitHub PR JSON."); }
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("Missing paginated GitHub PR pages.");
  }
  const numbers = new Set();
  const protectedRefs = new Map([["main", new Set(["DEFAULT_BRANCH"])]]);
  let count = 0;
  const add = (ref, reason) => {
    if (!protectedRefs.has(ref)) protectedRefs.set(ref, new Set());
    protectedRefs.get(ref).add(reason);
  };
  for (const page of pages) {
    if (!Array.isArray(page) || page.length > MAX_PAGE_SIZE) {
      throw new Error("Incomplete or invalid paginated GitHub PR page.");
    }
    for (const pr of page) {
      if (!pr || !Number.isSafeInteger(pr.number) || pr.number <= 0
        || pr.state !== "open" || !pr.head || !pr.base || !pr.base.repo
        || repositoryName(pr.base.repo.full_name) !== repo) {
        throw new Error("Invalid open pull request metadata.");
      }
      if (numbers.has(pr.number)) throw new Error("Duplicated pull request across pages.");
      numbers.add(pr.number);
      count++;
      const base = requireRef(pr.base.ref, "base.ref");
      add(base, "PR_BASE#" + pr.number);
      if (pr.head.repo !== null) {
        if (!pr.head.repo || !pr.head.repo.full_name) throw new Error("Missing head repository.");
        if (repositoryName(pr.head.repo.full_name) === repo) {
          add(requireRef(pr.head.ref, "head.ref"), "PR_HEAD#" + pr.number);
        }
      }
    }
  }
  // An unexpectedly empty list must never turn into a bulk delete. With no
  // open PRs, manual cleanup is safer than a silent empty API response.
  if (!count) throw new Error("No open PRs; refusing bulk deletion.");
  return protectedRefs;
}

export function parseRemoteRefs(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Empty remote branch list; refusing cleanup.");
  }
  const refs = new Map();
  for (const line of raw.trim().split(/\r?\n/)) {
    const match = /^([0-9a-f]{40})\s+refs\/heads\/(.+)$/.exec(line);
    if (!match || !validRef(match[2]) || refs.has(match[2])) {
      throw new Error("Invalid or duplicate remote branch ref.");
    }
    refs.set(match[2], match[1].toLowerCase());
  }
  if (!refs.has("main")) throw new Error("Default main branch missing from remote listing.");
  return refs;
}

export function runCleanup(repository, execute) {
  const repo = repositoryName(repository);
  const apiArgs = ["api", "--paginate", "--slurp",
    "repos/" + repo + "/pulls?state=open&per_page=100"];
  const pullSnapshot = () => parseOpenPulls(execute("gh", apiArgs), repo);
  const remoteSnapshot = () => parseRemoteRefs(execute("git", ["ls-remote", "--heads", "origin"]));
  const kept = [], deleted = [], alreadyGone = [];
  const protectedInitially = pullSnapshot();
  const initialRemote = remoteSnapshot();

  for (const [branch, sha] of initialRemote) {
    if (protectedInitially.has(branch)) {
      kept.push({ branch, reason: [...protectedInitially.get(branch)].join(",") });
      continue;
    }
    // Never trust a single snapshot: a newly opened or retargeted PR can
    // reference the branch after enumeration.
    const currentProtected = pullSnapshot();
    if (currentProtected.has(branch)) {
      kept.push({ branch, reason: [...currentProtected.get(branch)].join(",") });
      continue;
    }
    const currentRemote = remoteSnapshot();
    if (!currentRemote.has(branch)) {
      alreadyGone.push(branch);
      continue;
    }
    if (currentRemote.get(branch) !== sha) {
      kept.push({ branch, reason: "REMOTE_SHA_CHANGED" });
      continue;
    }

    // CAS-style delete: even if someone pushes between the last ls-remote
    // and deletion, the expected SHA prevents deleting a newer ref.
    const lease = "--force-with-lease=refs/heads/" + branch + ":" + sha;
    try {
      execute("git", ["push", "--porcelain", lease, "origin", ":refs/heads/" + branch]);
      deleted.push(branch);
    } catch (error) {
      // Do not fail for a branch deleted by another cleanup; do fail for a
      // remaining branch, a changed SHA or a permissions/repo error.
      const after = remoteSnapshot();
      if (after.has(branch)) throw error;
      alreadyGone.push(branch);
    }
  }
  return { kept, deleted, alreadyGone };
}

function invoke(bin, args) {
  return execFileSync(bin, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repository = process.env.GITHUB_REPOSITORY || "";
  const result = runCleanup(repository, invoke);
  const summary = [
    "## Safe branch cleanup",
    "",
    "Protected: " + result.kept.length + "; deleted: " + result.deleted.length
      + "; already gone: " + result.alreadyGone.length,
    ...result.kept.map(x => "- kept " + x.branch + " (" + x.reason + ")"),
    ...result.deleted.map(x => "- deleted " + x),
    ...result.alreadyGone.map(x => "- already gone " + x),
    "",
  ].join("\n");
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
