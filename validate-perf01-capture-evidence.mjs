import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const read = path => readFile(new URL(path, import.meta.url));
const meta = JSON.parse((await read("./performance-baselines/2026-10-02-perf01-summary.json")).toString("utf8"));
const archive = await read("./performance-baselines/2026-10-02-perf01.json.gz");
const rawBytes = gunzipSync(archive);
const sha256 = createHash("sha256").update(rawBytes).digest("hex");
assert.equal(sha256, meta.metadata.rawSha256, "The retained gzip must match the original raw JSON checksum.");
assert.equal(meta.metadata.rawArchive, "performance-baselines/2026-10-02-perf01.json.gz");
const raw = JSON.parse(rawBytes.toString("utf8"));
assert.equal(raw.metadata.complete, true);
assert.equal(meta.metadata.complete, true);
assert.equal(raw.metadata.repetitions, 5);
assert.equal(raw.metadata.completedRuns, 70);
assert.equal(meta.metadata.completedRuns, 70);
assert.equal(raw.metadata.targetContext.sourceCommit, "40f40b4208b29bbfab82a0a61ba6f1beedd86fe1",
  "The measured checkout must be the dedicated PERF-01 source, not a later report-only commit.");
assert.deepEqual(meta.metadata.targetContext, raw.metadata.targetContext);
assert.equal(meta.metadata.nextVersion, "16.3.6");
assert.equal(meta.metadata.reactVersion, "19.3.0");
assert.deepEqual(raw.metadata.profiles, ["desktop", "mobile-slow"]);
const journeys = ["home", "database", "player", "club", "my-clubs", "evaluation", "stats"];
assert.deepEqual(raw.metadata.journeys.map(({ id }) => id), journeys);
assert.deepEqual(meta.summary, raw.summary, "The compact report must retain the exact full-capture aggregates.");

let phaseSamples = 0;
for (const profile of raw.metadata.profiles) {
  for (const journey of journeys) {
    const sample = raw.raw[profile]?.[journey];
    const aggregates = raw.summary[profile]?.[journey];
    assert.ok(sample && aggregates, `Missing capture: ${profile}/${journey}`);
    for (const phase of ["cold", "refresh", "cached"]) {
      const values = sample[phase];
      assert.equal(values?.length, 5, `Incomplete capture: ${profile}/${journey}/${phase}`);
      assert.ok(aggregates[phase]?.settledMs?.median > 0,
        `No positive settled median: ${profile}/${journey}/${phase}`);
      assert.ok(aggregates[phase]?.settledMs?.slowest >= aggregates[phase]?.settledMs?.median,
        `Slowest settlement cannot be quicker than median: ${profile}/${journey}/${phase}`);
      for (const item of values) {
        assert.ok(Number.isFinite(item.settledMs) && item.settledMs >= 0,
          `Missing raw settlement: ${profile}/${journey}/${phase}`);
        assert.ok(Number.isFinite(item.usefulContentMs) && item.usefulContentMs >= 0,
          `Missing raw useful content: ${profile}/${journey}/${phase}`);
      }
      phaseSamples += values.length;
    }
    assert.equal(aggregates.cached.apiRequestCount.slowest, 0,
      `Cached revisit should not re-fetch an API payload: ${profile}/${journey}`);
  }
}
assert.equal(phaseSamples, 210);
assert.equal(meta.metadata.datasetWorkflowRunId === undefined, true);
assert.ok(/^20\d\d-\d\d-\d\dT/.test(meta.metadata.targetContext.datasetGeneratedAt));
assert.ok(Number(meta.metadata.databaseArtifactId) > 0);
assert.ok(Number(meta.metadata.databaseWorkflowRunId) > 0);
console.log("PERF-01 verified: gzip/raw SHA-256, exact summary equality, real checkout and dataset context, all 70 journeys / 210 phase samples and cached API ownership.");
