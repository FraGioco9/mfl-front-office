import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "..", "ci-quality-scope.mjs");

async function fixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), "mfl-ci-scope-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "ci-scope@example.invalid");
  git("config", "user.name", "CI Scope Test");
  async function commit(path, content, message) {
    const target = join(cwd, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    git("add", "--", path);
    git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  }
  const main = await commit("README.md", "baseline\n", "baseline");
  git("update-ref", "refs/remotes/origin/main", main);
  const run = async (event, head, options = {}) => {
    const output = join(cwd, "scope-output");
    await writeFile(output, "", "utf8");
    const result = spawnSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        EVENT_NAME: event,
        CURRENT_SHA: head,
        BEFORE_SHA: options.before || "",
        PR_BASE_SHA: options.prBase || "",
        PR_HEAD_SHA: options.prHead || "",
        GITHUB_OUTPUT: output,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return Object.fromEntries((await readFile(output, "utf8")).trim().split("\n")
      .map((line) => line.split("=")));
  };
  return { git, commit, main, run };
}

test("manual branch: changes before final docs-only commit still run site validation", async (t) => {
  const f = await fixture(t);
  f.git("switch", "-q", "-c", "feature");
  await f.commit("modules/example.js", "export const updated = true;\n", "change app");
  const head = await f.commit("docs/note.md", "documentation\n", "docs only");
  assert.deepEqual(await f.run("workflow_dispatch", head),
    { site: "true", builder: "false", workflow: "false", quality: "true" });
});

test("manual branch: docs-only delta does not turn on unrelated site tests", async (t) => {
  const f = await fixture(t);
  f.git("switch", "-q", "-c", "docs-only");
  const head = await f.commit("docs/note.md", "documentation\n", "docs only");
  assert.deepEqual(await f.run("workflow_dispatch", head),
    { site: "false", builder: "false", workflow: "false", quality: "false" });
});

test("manual main: run site checks instead of returning vacuous success", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.run("workflow_dispatch", f.main),
    { site: "true", builder: "false", workflow: "false", quality: "true" });
});

test("manual branch: missing main tracking ref fails closed to site validation", async (t) => {
  const f = await fixture(t);
  f.git("switch", "-q", "-c", "unknown-base");
  const head = await f.commit("docs/note.md", "documentation\n", "docs only");
  f.git("update-ref", "-d", "refs/remotes/origin/main");
  assert.deepEqual(await f.run("workflow_dispatch", head),
    { site: "true", builder: "false", workflow: "false", quality: "true" });
});

test("pull_request retains explicit base comparison across doc-only last commit", async (t) => {
  const f = await fixture(t);
  f.git("switch", "-q", "-c", "feature");
  await f.commit("modules/example.js", "export const updated = true;\n", "change app");
  const head = await f.commit("docs/note.md", "documentation\n", "docs only");
  assert.deepEqual(await f.run("pull_request", head, { prBase: f.main, prHead: head }),
    { site: "true", builder: "false", workflow: "false", quality: "true" });
});

test("push retains explicit before SHA and docs-only skip behavior", async (t) => {
  const f = await fixture(t);
  f.git("switch", "-q", "-c", "feature");
  const before = await f.commit("modules/example.js", "export const updated = true;\n", "change app");
  const head = await f.commit("docs/note.md", "documentation\n", "docs only");
  assert.deepEqual(await f.run("push", head, { before }),
    { site: "false", builder: "false", workflow: "false", quality: "false" });
});

test("manual branch: workflow fixture changes still trigger repository validation", async (t) => {
  const f = await fixture(t);
  f.git("switch", "-q", "-c", "workflow-test");
  await f.commit("tests/isolated.mjs", "export {};\n", "change test");
  const head = await f.commit("docs/note.md", "documentation\n", "docs only");
  assert.deepEqual(await f.run("workflow_dispatch", head),
    { site: "false", builder: "false", workflow: "true", quality: "true" });
});
