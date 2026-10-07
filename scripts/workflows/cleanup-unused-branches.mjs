// Safe GitHub PR-aware cleanup: only trusted main invokes this executable.
// All queries are complete, validated snapshots. Errors fail closed.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAX_PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_MIN_BRANCH_AGE_DAYS = 14;
export const DEFAULT_BRANCH_ALLOWLIST = Object.freeze([
  "wip-*",
  "wip/*",
  "keep-*",
  "keep/*",
  "release-*",
  "release/*",
]);

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

function validAllowPattern(value) {
  if (typeof value !== "string" || !value) return false;
  const stars = [...value].filter(char => char === "*").length;
  if (stars > 1 || (stars === 1 && !value.endsWith("*"))) return false;
  const prefix = stars ? value.slice(0, -1) : value;
  return stars ? Boolean(prefix) && validRef(prefix + "placeholder") : validRef(prefix);
}

export function parseBranchAllowlist(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return [...DEFAULT_BRANCH_ALLOWLIST];
  }
  const patterns = String(value).split(",").map(item => item.trim()).filter(Boolean);
  if (!patterns.length || patterns.some(pattern => !validAllowPattern(pattern))) {
    throw new Error("Invalid cleanup branch allowlist.");
  }
  return [...new Set(patterns)];
}

function allowlistReason(branch, patterns) {
  for (const pattern of patterns) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (branch.startsWith(prefix)) return "ALLOWLIST:" + pattern;
    } else if (branch === pattern) {
      return "ALLOWLIST:" + pattern;
    }
  }
  return "";
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
  // An empty but structurally valid paginated response means there are no
  // open PRs. main remains protected and every branch still passes the
  // allowlist, tag, age, remote-SHA and pre-delete race checks below.
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

export function parseTagCommitShas(raw) {
  if (typeof raw !== "string") throw new Error("Invalid remote tag list.");
  if (!raw.trim()) return new Set();
  const commits = new Set();
  for (const line of raw.trim().split(/\r?\n/)) {
    const match = /^([0-9a-f]{40})\s+refs\/tags\/(.+?)(\^\{\})?$/.exec(line);
    if (!match || !validRef(match[2])) throw new Error("Invalid remote tag ref.");
    commits.add(match[1].toLowerCase());
  }
  return commits;
}

export function parseCommitTimestamp(raw) {
  const value = String(raw ?? "").trim();
  if (!/^\d{1,12}$/.test(value)) throw new Error("Invalid branch commit timestamp.");
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error("Invalid branch commit timestamp.");
  }
  return seconds * 1000;
}

function normalizeMinAgeDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("Cleanup minimum branch age must be an integer from 1 to 365 days.");
  }
  return days;
}

export function runCleanup(repository, execute, options = {}) {
  const repo = repositoryName(repository);
  const dryRun = Boolean(options.dryRun);
  const minAgeDays = normalizeMinAgeDays(options.minAgeDays ?? DEFAULT_MIN_BRANCH_AGE_DAYS);
  const nowMs = Number(options.nowMs ?? Date.now());
  if (!Number.isFinite(nowMs) || nowMs <= 0) throw new Error("Invalid cleanup reference time.");
  const allowlist = options.allowlist
    ? parseBranchAllowlist(Array.isArray(options.allowlist) ? options.allowlist.join(",") : options.allowlist)
    : [...DEFAULT_BRANCH_ALLOWLIST];

  const apiArgs = ["api", "--paginate", "--slurp",
    "repos/" + repo + "/pulls?state=open&per_page=100"];
  const pullSnapshot = () => parseOpenPulls(execute("gh", apiArgs), repo);
  const remoteSnapshot = () => parseRemoteRefs(execute("git", ["ls-remote", "--heads", "origin"]));
  const tagSnapshot = () => parseTagCommitShas(execute("git", ["ls-remote", "--tags", "origin"]));
  const commitTime = sha => parseCommitTimestamp(
    execute("git", ["show", "-s", "--format=%ct", sha]),
  );

  const kept = [], deleted = [], wouldDelete = [], alreadyGone = [];
  const protectedInitially = pullSnapshot();
  const initialRemote = remoteSnapshot();
  const initialTags = tagSnapshot();

  for (const [branch, sha] of initialRemote) {
    if (protectedInitially.has(branch)) {
      kept.push({ branch, reason: [...protectedInitially.get(branch)].join(",") });
      continue;
    }

    const listedReason = allowlistReason(branch, allowlist);
    if (listedReason) {
      kept.push({ branch, reason: listedReason });
      continue;
    }

    if (initialTags.has(sha)) {
      kept.push({ branch, reason: "TAGGED_COMMIT" });
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

    // A tag can be created after initial enumeration. Recheck before age/delete
    // evaluation so a release/tagged tip is never selected from a stale snapshot.
    const currentTags = tagSnapshot();
    if (currentTags.has(sha)) {
      kept.push({ branch, reason: "TAGGED_COMMIT" });
      continue;
    }

    const committedAt = commitTime(sha);
    const ageMs = Math.max(0, nowMs - committedAt);
    if (ageMs < minAgeDays * DAY_MS) {
      kept.push({ branch, reason: "RECENT_LT_" + minAgeDays + "D" });
      continue;
    }

    if (dryRun) {
      wouldDelete.push(branch);
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
  return { kept, deleted, wouldDelete, alreadyGone, dryRun, minAgeDays, allowlist };
}

function invoke(bin, args) {
  return execFileSync(bin, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function cleanupDryRunFromEnvironment(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("CLEANUP_DRY_RUN must be true or false.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repository = process.env.GITHUB_REPOSITORY || "";
  const dryRun = cleanupDryRunFromEnvironment(process.env.CLEANUP_DRY_RUN);
  const minAgeDays = normalizeMinAgeDays(
    process.env.CLEANUP_MIN_AGE_DAYS || DEFAULT_MIN_BRANCH_AGE_DAYS,
  );
  const allowlist = parseBranchAllowlist(process.env.CLEANUP_BRANCH_ALLOWLIST);
  const result = runCleanup(repository, invoke, { dryRun, minAgeDays, allowlist });
  const summary = [
    "## Safe branch cleanup",
    "",
    "Mode: " + (result.dryRun ? "DRY RUN" : "DELETE")
      + "; minimum age: " + result.minAgeDays + " day(s).",
    "Protected: " + result.kept.length
      + "; would delete: " + result.wouldDelete.length
      + "; deleted: " + result.deleted.length
      + "; already gone: " + result.alreadyGone.length,
    ...result.kept.map(x => "- kept " + x.branch + " (" + x.reason + ")"),
    ...result.wouldDelete.map(x => "- would delete " + x),
    ...result.deleted.map(x => "- deleted " + x),
    ...result.alreadyGone.map(x => "- already gone " + x),
    "",
  ].join("\n");
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
