import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_BRANCH_ALLOWLIST,
  parseBranchAllowlist,
  parseCommitTimestamp,
  parseOpenPulls,
  parseRemoteRefs,
  parseTagCommitShas,
  runCleanup,
} from "../scripts/workflows/cleanup-unused-branches.mjs";

const REPO = "FraGioco9/mfl-front-office";
const SHA_A = "a".repeat(40), SHA_B = "b".repeat(40), SHA_C = "c".repeat(40);
const NOW = Date.parse("2026-10-05T12:00:00.000Z");
const OLD_SECONDS = Math.floor((NOW - 30 * 24 * 60 * 60 * 1000) / 1000);
const RECENT_SECONDS = Math.floor((NOW - 2 * 24 * 60 * 60 * 1000) / 1000);

const pull = (number, base, head, headRepo = REPO) => ({
  number, state: "open",
  base: { ref: base, repo: { full_name: REPO } },
  head: { ref: head, repo: headRepo === null ? null : { full_name: headRepo } },
});
const pages = (...groups) => JSON.stringify(groups);
const remote = entries => entries.map(([branch, sha]) => sha + "\trefs/heads/" + branch).join("\n") + "\n";
const tags = entries => entries.map(([name, sha, peeled = ""]) => (
  sha + "\trefs/tags/" + name + (peeled ? "\n" + peeled + "\trefs/tags/" + name + "^{}" : "")
)).join("\n") + (entries.length ? "\n" : "");

function simulated({
  openPulls,
  remoteHeads,
  tagRefs,
  commitTimes = {},
  ghFailureAt = -1,
  pushFailure = false,
  changeRemote = null,
} = {}) {
  const pullVersions = Array.isArray(openPulls) ? openPulls : [pages([
    pull(1122, "parent", "fix-child"),
  ])];
  const remoteVersions = Array.isArray(remoteHeads) ? remoteHeads : [
    remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]),
  ];
  const tagVersions = Array.isArray(tagRefs) ? tagRefs : [""];
  let ghIndex = 0, remoteIndex = 0, tagIndex = 0;
  const calls = [], deleted = [];
  function execute(bin, args) {
    calls.push({ bin, args: [...args] });
    if (bin === "gh") {
      assert.deepEqual(args, ["api", "--paginate", "--slurp",
        "repos/fragioco9/mfl-front-office/pulls?state=open&per_page=100"]);
      if (ghIndex === ghFailureAt) { ghIndex++; throw new Error("GitHub API 503"); }
      return pullVersions[Math.min(ghIndex++, pullVersions.length - 1)];
    }
    if (bin === "git" && args[0] === "ls-remote" && args[1] === "--heads") {
      assert.deepEqual(args, ["ls-remote", "--heads", "origin"]);
      return remoteVersions[Math.min(remoteIndex++, remoteVersions.length - 1)];
    }
    if (bin === "git" && args[0] === "ls-remote" && args[1] === "--tags") {
      assert.deepEqual(args, ["ls-remote", "--tags", "origin"]);
      return tagVersions[Math.min(tagIndex++, tagVersions.length - 1)];
    }
    if (bin === "git" && args[0] === "show") {
      assert.deepEqual(args.slice(0, 3), ["show", "-s", "--format=%ct"]);
      const sha = args[3];
      return String(commitTimes[sha] ?? OLD_SECONDS) + "\n";
    }
    if (bin === "git" && args[0] === "push") {
      assert.equal(args[1], "--porcelain");
      assert.match(args[2], /^--force-with-lease=refs\/heads\/[^:]+:[0-9a-f]{40}$/);
      assert.equal(args[3], "origin");
      assert.equal(args[4], ":refs/heads/" + args[2].split(":")[0].replace("--force-with-lease=refs/heads/", ""));
      if (pushFailure) throw new Error("Remote rejected deletion.");
      const branch = args[4].slice(":refs/heads/".length);
      deleted.push(branch);
      if (changeRemote) changeRemote(branch);
      return "OK";
    }
    throw new Error("Unexpected command: " + bin + " " + args.join(" "));
  }
  return { execute, deleted, calls };
}

function cleanup(mocked, options = {}) {
  return runCleanup(REPO, mocked.execute, {
    nowMs: NOW,
    minAgeDays: 14,
    dryRun: false,
    ...options,
  });
}

test("stacked PR bases and heads stay protected", () => {
  const p = pages([pull(1121, "base-1120", "audit-1121"),
    pull(1122, "base-1120", "fix-1122"),
    pull(1123, "fix-1122", "fix-1123")]);
  const refs = remote([
    ["main", SHA_A], ["base-1120", SHA_B], ["audit-1121", SHA_A],
    ["fix-1122", SHA_C], ["fix-1123", SHA_C], ["old-unused", SHA_B],
  ]);
  const mocked = simulated({ openPulls: [p], remoteHeads: [refs] });
  const result = cleanup(mocked);
  assert.deepEqual(mocked.deleted, ["old-unused"]);
  assert.ok(result.kept.find(x => x.branch === "base-1120" && x.reason.includes("PR_BASE#1121")));
  assert.ok(result.kept.find(x => x.branch === "fix-1122"
    && x.reason.includes("PR_BASE#1123") && x.reason.includes("PR_HEAD#1122")));
});

test("GitHub API pages: 101 distinct open PRs retain refs in second page", () => {
  const all = Array.from({ length: 101 }, (_, i) => pull(i + 1, "parent-" + i, "head-" + i));
  const kept = parseOpenPulls(pages(all.slice(0, 100), all.slice(100)), REPO);
  assert.ok(kept.has("parent-100"));
  assert.ok(kept.has("head-100"));
  assert.ok(kept.has("main"));
  assert.equal(kept.size, 203);
});

test("fork and deleted-fork heads never protect foreign refs", () => {
  const fork = parseOpenPulls(
    pages([pull(2, "shared-parent", "external-branch", "other/repo")]), REPO);
  assert.equal(fork.has("shared-parent"), true);
  assert.equal(fork.has("external-branch"), false);
  const deleted = parseOpenPulls(
    pages([pull(3, "shared-parent", "missing", null)]), REPO);
  assert.ok(deleted.has("shared-parent"));
  assert.equal(deleted.has("missing"), false);
});

test("reject malformed PR pages and empty PR inventory", () => {
  const good = pull(1, "parent", "head");
  for (const input of [
    "", "{}", "[]", JSON.stringify([{}]), JSON.stringify([[{ ...good, base: null }]]),
    JSON.stringify([[{ ...good, state: "closed" }]]),
    JSON.stringify([[good], [good]]), JSON.stringify([Array(101).fill(good)]),
    JSON.stringify([[{ ...good, head: { ...good.head, ref: "bad ref" } }]]),
  ]) assert.throws(() => parseOpenPulls(input, REPO));

  const mocked = simulated({ openPulls: [pages([])] });
  assert.throws(() => cleanup(mocked), /No open PRs/);
  assert.deepEqual(mocked.deleted, []);
});

test("offline/403/500 GitHub API fails closed", () => {
  const mocked = simulated({ ghFailureAt: 0 });
  assert.throws(() => cleanup(mocked), /GitHub API 503/);
  assert.deepEqual(mocked.deleted, []);
});

test("newly opened PR referencing formerly orphaned branch wins race", () => {
  const first = pages([pull(1, "parent", "fix-child")]);
  const second = pages([pull(1, "parent", "fix-child"), pull(2, "orphan", "new-child")]);
  const mocked = simulated({ openPulls: [first, second] });
  const result = cleanup(mocked);
  assert.deepEqual(mocked.deleted, []);
  assert.ok(result.kept.find(x => x.branch === "orphan" && x.reason.includes("PR_BASE#2")));
});

test("changed or concurrently removed remote branch is never deleted from stale inventory", () => {
  const first = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]);
  const changed = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_B]]);
  const mockedChanged = simulated({ remoteHeads: [first, changed] });
  const changedResult = cleanup(mockedChanged);
  assert.deepEqual(mockedChanged.deleted, []);
  assert.ok(changedResult.kept.find(x => x.reason === "REMOTE_SHA_CHANGED"));

  const gone = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C]]);
  const mockedGone = simulated({ remoteHeads: [first, gone] });
  const goneResult = cleanup(mockedGone);
  assert.deepEqual(goneResult.alreadyGone, ["orphan"]);
});

test("failed git push fails unless a competing cleanup already removed ref", () => {
  const mocked = simulated({ pushFailure: true });
  assert.throws(() => cleanup(mocked), /Remote rejected deletion/);
  assert.deepEqual(mocked.deleted, []);

  const first = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]);
  const gone = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C]]);
  const concurrent = simulated({ pushFailure: true, remoteHeads: [first, first, gone] });
  const result = cleanup(concurrent);
  assert.deepEqual(result.alreadyGone, ["orphan"]);
});

test("default allowlist protects audit, WIP, keep and release branches", () => {
  const refs = remote([
    ["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C],
    ["audit-1034-temp", SHA_A], ["wip/foo", SHA_A], ["keep-local", SHA_A],
    ["release/v1.129.0", SHA_A], ["ordinary-old", SHA_A],
  ]);
  const mocked = simulated({ remoteHeads: [refs] });
  const result = cleanup(mocked);
  assert.deepEqual(mocked.deleted, ["ordinary-old"]);
  for (const branch of ["audit-1034-temp", "wip/foo", "keep-local", "release/v1.129.0"]) {
    assert.ok(result.kept.find(x => x.branch === branch && x.reason.startsWith("ALLOWLIST:")));
  }
  assert.ok(DEFAULT_BRANCH_ALLOWLIST.includes("audit-*"));
});

test("custom allowlist accepts exact or terminal-prefix patterns only", () => {
  assert.deepEqual(parseBranchAllowlist("foo,bar/*"), ["foo", "bar/*"]);
  for (const bad of ["foo*bar", "*foo", "bad ref", ","]) {
    assert.throws(() => parseBranchAllowlist(bad));
  }
});

test("recent unreferenced branches are retained until minimum age", () => {
  const mocked = simulated({ commitTimes: { [SHA_A]: RECENT_SECONDS } });
  const result = cleanup(mocked);
  assert.deepEqual(mocked.deleted, []);
  assert.ok(result.kept.find(x => x.branch === "orphan" && x.reason === "RECENT_LT_14D"));
});

test("tagged branch tips are retained, including annotated tag peeled commits", () => {
  const tagObject = "d".repeat(40);
  const mocked = simulated({
    tagRefs: [tags([["v1.129.0", tagObject, SHA_A]])],
  });
  const result = cleanup(mocked);
  assert.deepEqual(mocked.deleted, []);
  assert.ok(result.kept.find(x => x.branch === "orphan" && x.reason === "TAGGED_COMMIT"));
});

test("tag created after initial inventory wins pre-delete race", () => {
  const mocked = simulated({
    tagRefs: ["", tags([["rollback-safe", SHA_A]])],
  });
  const result = cleanup(mocked);
  assert.deepEqual(mocked.deleted, []);
  assert.ok(result.kept.find(x => x.branch === "orphan" && x.reason === "TAGGED_COMMIT"));
});

test("dry-run reports eligible branch without pushing deletion", () => {
  const mocked = simulated();
  const result = cleanup(mocked, { dryRun: true });
  assert.deepEqual(mocked.deleted, []);
  assert.deepEqual(result.wouldDelete, ["orphan"]);
  assert.equal(mocked.calls.some(c => c.bin === "git" && c.args[0] === "push"), false);
});

test("timestamp and remote/tag parsing fail closed", () => {
  assert.equal(parseCommitTimestamp(String(OLD_SECONDS)), OLD_SECONDS * 1000);
  for (const value of ["", "-1", "1.5", "nope"]) assert.throws(() => parseCommitTimestamp(value));
  assert.equal(parseTagCommitShas("").size, 0);
  assert.ok(parseTagCommitShas(tags([["v1", SHA_A]])).has(SHA_A));

  for (const s of ["", "not-a-git-ref", remote([["orphan", SHA_B]]),
    remote([["main", SHA_A], ["main", SHA_B]])]) {
    assert.throws(() => parseRemoteRefs(s));
  }
  assert.throws(() => parseTagCommitShas("oops"));
});

test("workflow defaults manual cleanup to dry-run and has no deploy side effect", () => {
  const source = readFileSync(new URL("../.github/workflows/cleanup-unused-branches.yml", import.meta.url), "utf8");
  assert.match(source, /pull_request_target:[\s\S]*?types:[\s\S]*?- closed/);
  assert.match(source, /workflow_dispatch:[\s\S]*?dry_run:[\s\S]*?default: true/);
  assert.match(source, /min_age_days:[\s\S]*?default: "14"/);
  assert.match(source, /CLEANUP_DRY_RUN:/);
  assert.match(source, /CLEANUP_MIN_AGE_DAYS:/);
  assert.match(source, /CLEANUP_BRANCH_ALLOWLIST: audit-\*,wip-\*/);
  assert.match(source, /ref: main/);
  assert.match(source, /group: cleanup-unused-branches-/);
  assert.match(source, /cancel-in-progress: false/);
  assert.match(source, /node --test tests\/test_cleanup_unused_branches\.mjs/);
  assert.match(source, /node scripts\/workflows\/cleanup-unused-branches\.mjs/);
  assert.doesNotMatch(source, /vercel deploy|deploy --prebuilt|full-database-refresh/);
});
