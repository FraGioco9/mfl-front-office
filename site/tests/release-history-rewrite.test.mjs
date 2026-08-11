import assert from "node:assert/strict";
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
  assert.deepEqual(v123, Array.from({ length: 8 }, (_, index) => `v1.123.${7 - index}`));

  const versions = new Set(rewritten.map(([version]) => version));
  for (const omitted of ["v1.123.8", "v1.123.29", "v1.123.30", "v1.123.37", "v1.120.48", "v1.120.30"]) {
    assert.equal(versions.has(omitted), false, `${omitted} should stay omitted from the rewritten Changelog`);
  }

  assert.match(api, /require\("\.\.\/releases-rewritten\.json"\)/);
  assert.doesNotMatch(api, /require\("\.\.\/releases-recent\.json"\)/);
});
