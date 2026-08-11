import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const siteRoot = join(root, "site");
const OLD_CURRENT = "1.123.37";
const NEW_CURRENT = "1.124.0";
const excluded = new Set(["releases-recent.json"]);
const textExtensions = new Set([".js", ".mjs", ".html", ".json"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

for (const file of await walk(siteRoot)) {
  const path = relative(siteRoot, file).replaceAll("\\", "/");
  if (excluded.has(path) || !textExtensions.has(extname(file))) continue;
  const source = await readFile(file, "utf8");
  if (!source.includes(OLD_CURRENT)) continue;
  await writeFile(file, source.replaceAll(OLD_CURRENT, NEW_CURRENT), "utf8");
  console.log(`Updated current release reference in ${path}`);
}

const releasePath = join(siteRoot, "release.json");
const release = JSON.parse(await readFile(releasePath, "utf8"));
release.version = NEW_CURRENT;
await writeFile(releasePath, `${JSON.stringify(release, null, 2)}\n`, "utf8");

const rewritten = [
  ["v1.124.0", "Make full search authoritative, keep validated deployments current, and stabilize table widths"],
  ["v1.123.7", "Stabilize Evaluation and global search focus, recent result navigation, and cold-page full search"],
  ["v1.123.6", "Consolidate runtimes and restore shared table view navigation"],
  ["v1.123.5", "Cache table filters, unify loading states, and stabilize MFL Stats and wait interactions"],
  ["v1.123.4", "Make global search authoritative and stabilize Watchlist, table, and Evaluation first paint"],
  ["v1.123.3", "Stabilize Database Stats state, MFL Stats summaries, and static page rendering"],
  ["v1.123.2", "Restore static application chrome, protected-route first paint, and loading completion"],
  ["v1.123.1", "Modularize the client runtime, centralize release metadata and requests, and add automated quality checks"],
  ["v1.123.0", "Consolidate the post-SQLite application architecture into the first stable v1.123 release"],
  ["v1.122.0", "Remove legacy loading, JSON compatibility, and dead runtime code"],
  ["v1.121.0", "Query the runtime SQLite database for every site data request"],
  ["v1.120.4", "Prime Evaluation controls and MFL Stats filters before data loads"],
  ["v1.120.3", "Stabilize startup, Evaluation loading, and first-paint Stats rendering"],
  ["v1.120.2", "Refresh the Evaluation Discount Rate from live MFL/USD season ratios"],
  ["v1.120.1", "Refine Database Stats filtering, tooltips, and Changelog rendering"],
  ["v1.120.0", "Add Database Stats with retirement counts and active-player distributions"],
];
await writeFile(join(siteRoot, "releases-rewritten.json"), `${JSON.stringify(rewritten, null, 2)}\n`, "utf8");

const guard = `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("served release history stays compact and consecutive from v1.120 through current", async () => {
  const release = JSON.parse(await read("release.json"));
  const rewritten = JSON.parse(await read("releases-rewritten.json"));
  const api = await read("api/releases.js");

  assert.equal(release.version, "1.124.0");
  assert.deepEqual(rewritten.map(([version]) => version), [
    "v1.124.0",
    "v1.123.7",
    "v1.123.6",
    "v1.123.5",
    "v1.123.4",
    "v1.123.3",
    "v1.123.2",
    "v1.123.1",
    "v1.123.0",
    "v1.122.0",
    "v1.121.0",
    "v1.120.4",
    "v1.120.3",
    "v1.120.2",
    "v1.120.1",
    "v1.120.0",
  ]);

  const v123 = rewritten
    .map(([version]) => version)
    .filter((version) => version.startsWith("v1.123."));
  assert.deepEqual(v123, Array.from({ length: 8 }, (_, index) => \`v1.123.\${7 - index}\`));

  const versions = new Set(rewritten.map(([version]) => version));
  for (const omitted of ["v1.123.8", "v1.123.29", "v1.123.30", "v1.123.37", "v1.120.48", "v1.120.30"]) {
    assert.equal(versions.has(omitted), false, \`\${omitted} should stay omitted from the rewritten Changelog\`);
  }

  assert.match(api, /require\\("\\.\\.\\/releases-rewritten\\.json"\\)/);
  assert.doesNotMatch(api, /require\\("\\.\\.\\/releases-recent\\.json"\\)/);
});
`;
await writeFile(join(siteRoot, "tests/release-history-rewrite.test.mjs"), guard, "utf8");
