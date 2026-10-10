import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const [rootInput, outputInput, requestedHead, requestedBase] = process.argv.slice(2);
assert.ok(rootInput && outputInput, "Usage: node scan-cut-04-4b-nft.mjs <isolated-checkout> <report-dir> <PR-SHA> <base-SHA>");
assert.match(requestedHead ?? "", /^[0-9a-f]{40}$/, "PR SHA required");
assert.match(requestedBase ?? "", /^[0-9a-f]{40}$/, "base SHA required");
const root = resolve(rootInput), output = resolve(outputInput);
assert.ok(output !== root && !output.startsWith(root + sep), "Reports must remain outside the isolated source checkout");
mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
assert.equal(resolve(git("rev-parse", "--show-toplevel")), root);
assert.equal(git("rev-parse", "HEAD"), requestedHead, "Detached worktree must be exact PR HEAD");
assert.equal(git("rev-parse", "HEAD^"), requestedBase, "Parent of PR commit must be expected main SHA");
const names = ["api-persistence", "build-generated", "club", "evaluation", "release-deployment", "responsive-ui", "route-features", "routing-loading", "shared-ui", "stats", "table"]
  .map(name => "validate-domain-" + name + ".mjs");
const expectedNames = new Set(names);
const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"]).toString("utf8").split("\0").filter(Boolean);
const stillTracked = names.filter(name => tracked.includes(name) || existsSync(join(root, name)));
assert.equal(tracked.length, 784, "The PR checkout should contain exactly 784 tracked files");
assert.deepEqual(stillTracked, [], "All 11 legacy wrappers must be physically absent");
const nftRoot = join(root, ".next");
assert.ok(existsSync(nftRoot), "Next build did not create .next");
const traceFiles = [];
function visit(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!["cache", "static"].includes(entry.name)) visit(path);
    } else if (entry.isFile() && path.endsWith(".nft.json")) {
      traceFiles.push(path);
    }
  }
}
visit(nftRoot);
traceFiles.sort();
const errors = [], hits = [], traces = [];
const rawRoot = join(output, "raw-next-nft");
mkdirSync(rawRoot, { recursive: true });
for (const source of traceFiles) {
  const name = relative(root, source).split(sep).join("/");
  try {
    const raw = readFileSync(source, "utf8");
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj.files)) throw new Error("Next NFT schema missing files array");
    const present = [];
    for (const dependency of obj.files) {
      if (typeof dependency !== "string") {
        errors.push({ trace: name, problem: "Non-string NFT dependency" });
        continue;
      }
      const absolute = resolve(dirname(source), dependency);
      const located = relative(root, absolute).split(sep).join("/");
      // Conservative: any exact legacy basename, even beyond repository root,
      // blocks the gate rather than asserting it is safe to delete.
      if (expectedNames.has(basename(absolute))) {
        present.push({ file: located, nftRelativeEntry: dependency });
        hits.push({ trace: name, file: located, nftRelativeEntry: dependency });
      }
    }
    traces.push({
      nft: name,
      fileCount: obj.files.length,
      sha256: createHash("sha256").update(raw).digest("hex"),
      wrapperMatches: present
    });
    const dest = join(rawRoot, name);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
  } catch (e) {
    errors.push({ trace: name, problem: String(e) });
  }
}
const report = {
  sourceCommit: requestedHead, expectedBaseCommit: requestedBase,
  trackedFiles: tracked.length, wrappersRemoved: names,
  originalR0B3TraceCount: 30, actualTraceCount: traceFiles.length,
  tracedDependencyEntries: traces.reduce((sum, item) => sum + item.fileCount, 0),
  wrapperMatches: hits, parseOrSchemaErrors: errors, traces,
  verdict: traceFiles.length === 30 && errors.length === 0 && hits.length === 0 ? "PASS" : "FAIL"
};
writeFileSync(join(output, "cut-04-4b-nft-report.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(join(output, "cut-04-4b-nft-summary.md"), [
  "# SIM-09A CUT-04.4B-NFT exact-HEAD audit",
  "",
  "- Pinned PR HEAD: " + requestedHead,
  "- Pinned main base: " + requestedBase,
  "- Tracked files: " + tracked.length + " (expected 784)",
  "- Deleted legacy wrappers: " + names.length + "/11",
  "- Build generated .nft.json: " + traceFiles.length + " (expected 30, R0B3 baseline)",
  "- NFT dependency entries checked: " + report.tracedDependencyEntries,
  "- Legacy wrapper references in NFT: " + hits.length,
  "- Invalid NFT files or schemas: " + errors.length,
  "- Verdict: **" + report.verdict + "**",
  "",
  "All raw .nft.json files are included in raw-next-nft/ for independent review.",
  "This isolated audit does not authorize a PR merge, production deployment or database change."
].join("\n") + "\n");
console.log("CUT04_4B_NFT_GATE " + JSON.stringify({
  sha: requestedHead, main: requestedBase, tracked: tracked.length,
  nft: traceFiles.length, deps: report.tracedDependencyEntries,
  wrapperReferences: hits.length, errors: errors.length, verdict: report.verdict
}));
if (report.verdict !== "PASS") process.exitCode = 1;
