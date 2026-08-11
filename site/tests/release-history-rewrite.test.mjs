import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("served release history stays compact from v1.120 through current", async () => {
  const release = JSON.parse(await read("release.json"));
  const rewritten = JSON.parse(await read("releases-rewritten.json"));
  const api = await read("api/releases.js");

  assert.equal(release.version, "1.123.37");
  assert.equal(rewritten.length, 15);
  assert.deepEqual(rewritten.map(([version]) => version), [
    "v1.123.37",
    "v1.123.36",
    "v1.123.35",
    "v1.123.34",
    "v1.123.33",
    "v1.123.32",
    "v1.123.31",
    "v1.123.30",
    "v1.122.0",
    "v1.121.0",
    "v1.120.4",
    "v1.120.3",
    "v1.120.2",
    "v1.120.1",
    "v1.120.0",
  ]);

  const versions = new Set(rewritten.map(([version]) => version));
  for (const omitted of ["v1.123.29", "v1.123.22", "v1.120.48", "v1.120.30"]) {
    assert.equal(versions.has(omitted), false, `${omitted} should stay omitted from the rewritten Changelog`);
  }

  assert.match(api, /require\("\.\.\/releases-rewritten\.json"\)/);
  assert.doesNotMatch(api, /require\("\.\.\/releases-recent\.json"\)/);
});
