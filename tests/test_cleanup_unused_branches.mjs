import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseOpenPulls, parseRemoteRefs, runCleanup,
} from "../scripts/workflows/cleanup-unused-branches.mjs";

const REPO = "FraGioco9/mfl-front-office";
const SHA_A = "a".repeat(40), SHA_B = "b".repeat(40), SHA_C = "c".repeat(40);
const pull = (number, base, head, headRepo = REPO) => ({
  number, state: "open",
  base: { ref: base, repo: { full_name: REPO } },
  head: { ref: head, repo: headRepo === null ? null : { full_name: headRepo } },
});
const pages = (...groups) => JSON.stringify(groups);
const remote = entries => entries.map(([branch, sha]) => sha + "\trefs/heads/" + branch).join("\n") + "\n";

function simulated({ openPulls, remoteHeads, ghFailureAt = -1,
  pushFailure = false, changeRemote = null } = {}) {
  const pullVersions = Array.isArray(openPulls) ? openPulls : [pages([
    pull(1122, "parent", "fix-child"),
  ])];
  const remoteVersions = Array.isArray(remoteHeads) ? remoteHeads : [
    remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]),
  ];
  let ghIndex = 0, remoteIndex = 0;
  const calls = [], deleted = [];
  function execute(bin, args) {
    calls.push({ bin, args: [...args] });
    if (bin === "gh") {
      assert.deepEqual(args, ["api", "--paginate", "--slurp",
        "repos/fragioco9/mfl-front-office/pulls?state=open&per_page=100"]);
      if (ghIndex === ghFailureAt) { ghIndex++; throw new Error("GitHub API 503"); }
      return pullVersions[Math.min(ghIndex++, pullVersions.length - 1)];
    }
    if (bin === "git" && args[0] === "ls-remote") {
      assert.deepEqual(args, ["ls-remote", "--heads", "origin"]);
      return remoteVersions[Math.min(remoteIndex++, remoteVersions.length - 1)];
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

test("stacked #1120 stays protected as base of open #1121/#1122", () => {
  const p = pages([pull(1121, "base-1120", "audit-1121"),
    pull(1122, "base-1120", "fix-1122"),
    pull(1123, "fix-1122", "fix-1123")]);
  const refs = remote([
    ["main", SHA_A], ["base-1120", SHA_B], ["audit-1121", SHA_A],
    ["fix-1122", SHA_C], ["fix-1123", SHA_C], ["old-unused", SHA_B],
  ]);
  const mocked = simulated({ openPulls: [p], remoteHeads: [refs] });
  const result = runCleanup(REPO, mocked.execute);
  assert.deepEqual(mocked.deleted, ["old-unused"]);
  assert.ok(result.kept.find(x => x.branch === "base-1120" && x.reason.includes("PR_BASE#1121")));
  assert.ok(result.kept.find(x => x.branch === "fix-1122" &&
    x.reason.includes("PR_BASE#1123") && x.reason.includes("PR_HEAD#1122")));
  assert.equal(result.deleted.length, 1);
});

test("GitHub API pages: 101 distinct open PRs retain refs in second page", () => {
  const all = Array.from({ length: 101 }, (_, i) => pull(i + 1, "parent-" + i, "head-" + i));
  const kept = parseOpenPulls(pages(all.slice(0, 100), all.slice(100)), REPO);
  assert.ok(kept.has("parent-100"));
  assert.ok(kept.has("head-100"));
  assert.ok(kept.has("main"));
  assert.equal(kept.size, 203);
});

test("a fork head protects only its base in this repository", () => {
  const protectedRefs = parseOpenPulls(
    pages([pull(2, "shared-parent", "external-branch", "other/repo")]), REPO);
  assert.equal(protectedRefs.has("shared-parent"), true);
  assert.equal(protectedRefs.has("external-branch"), false);
  assert.equal(protectedRefs.has("main"), true);
});

test("a PR whose fork repo was deleted still protects the local base", () => {
  const protectedRefs = parseOpenPulls(
    pages([pull(3, "shared-parent", "missing", null)]), REPO);
  assert.ok(protectedRefs.has("shared-parent"));
  assert.equal(protectedRefs.has("missing"), false);
});

test("reject malformed pages, partial metadata and duplicated PRs", () => {
  const good = pull(1, "parent", "head");
  for (const input of [
    "", "{}", "[]", JSON.stringify([{}]), JSON.stringify([[{ ...good, base: null }]]),
    JSON.stringify([[{ ...good, state: "closed" }]]),
    JSON.stringify([[good], [good]]), JSON.stringify([Array(101).fill(good)]),
    JSON.stringify([[{ ...good, head: { ...good.head, ref: "bad ref" } }]]),
  ]) {
    assert.throws(() => parseOpenPulls(input, REPO));
  }
});

test("empty PR response blocks bulk cleanup instead of assuming no owners", () => {
  const mocked = simulated({ openPulls: [pages([])] });
  assert.throws(() => runCleanup(REPO, mocked.execute), /No open PRs/);
  assert.deepEqual(mocked.deleted, []);
  assert.equal(mocked.calls.filter(c => c.bin === "git" && c.args[0] === "push").length, 0);
});

test("offline/403/500 gh API blocks all deletions at initial inventory", () => {
  const mocked = simulated({ ghFailureAt: 0 });
  assert.throws(() => runCleanup(REPO, mocked.execute), /GitHub API 503/);
  assert.deepEqual(mocked.deleted, []);
});

test("gh API fails during pre-delete recheck: no deletion", () => {
  const mocked = simulated({ ghFailureAt: 1 });
  assert.throws(() => runCleanup(REPO, mocked.execute), /GitHub API 503/);
  assert.deepEqual(mocked.deleted, []);
});

test("newly opened PR referencing formerly orphaned base wins the race", () => {
  const first = pages([pull(1, "parent", "fix-child")]);
  const second = pages([pull(1, "parent", "fix-child"), pull(2, "orphan", "new-child")]);
  const mocked = simulated({ openPulls: [first, second] });
  const result = runCleanup(REPO, mocked.execute);
  assert.deepEqual(mocked.deleted, []);
  assert.ok(result.kept.find(x => x.branch === "orphan" && x.reason.includes("PR_BASE#2")));
});

test("changed remote head is retained, never deleted by a stale inventory", () => {
  const first = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]);
  const second = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_B]]);
  const mocked = simulated({ remoteHeads: [first, second] });
  const result = runCleanup(REPO, mocked.execute);
  assert.deepEqual(mocked.deleted, []);
  assert.ok(result.kept.find(x => x.reason === "REMOTE_SHA_CHANGED"));
});

test("already-removed orphan remains idempotent", () => {
  const first = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]);
  const second = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C]]);
  const mocked = simulated({ remoteHeads: [first, second] });
  const result = runCleanup(REPO, mocked.execute);
  assert.deepEqual(mocked.deleted, []);
  assert.deepEqual(result.alreadyGone, ["orphan"]);
});

test("failed git push never counts as success while remote ref still exists", () => {
  const mocked = simulated({ pushFailure: true });
  assert.throws(() => runCleanup(REPO, mocked.execute), /Remote rejected deletion/);
  assert.deepEqual(mocked.deleted, []);
});

test("if a competing cleanup deletes the branch, failed push is idempotent", () => {
  const first = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C], ["orphan", SHA_A]]);
  const second = remote([["main", SHA_A], ["parent", SHA_B], ["fix-child", SHA_C]]);
  const mocked = simulated({ pushFailure: true, remoteHeads: [first, first, second] });
  const result = runCleanup(REPO, mocked.execute);
  assert.deepEqual(result.alreadyGone, ["orphan"]);
  assert.deepEqual(mocked.deleted, []);
});

test("malformed git output or absent main fails closed", () => {
  for (const s of ["", "not-a-git-ref", remote([["orphan", SHA_B]]),
    remote([["main", SHA_A], ["main", SHA_B]])]) {
    assert.throws(() => parseRemoteRefs(s));
  }
  const mocked = simulated({ remoteHeads: ["oops"] });
  assert.throws(() => runCleanup(REPO, mocked.execute));
  assert.deepEqual(mocked.deleted, []);
});

test("workflow executes trusted main, uses serial group and no implicit deploy", () => {
  const source = readFileSync(new URL("../.github/workflows/cleanup-unused-branches.yml", import.meta.url), "utf8");
  assert.match(source, /pull_request_target:[\s\S]*?types:[\s\S]*?- closed/);
  assert.match(source, /ref: main/);
  assert.match(source, /group: cleanup-unused-branches-/);
  assert.match(source, /cancel-in-progress: false/);
  assert.match(source, /node --test tests\/test_cleanup_unused_branches\.mjs/);
  assert.match(source, /node scripts\/workflows\/cleanup-unused-branches\.mjs/);
  assert.doesNotMatch(source, /vercel deploy|deploy --prebuilt|full-database-refresh/);
});
