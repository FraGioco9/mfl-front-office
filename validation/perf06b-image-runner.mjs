import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportPath = resolve(process.env.MFL_PERF06B_OUTPUT || "perf06b-images-current.json");
const child = spawn(process.execPath, ["validation/performance-baseline.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    MFL_PERF06B_IMAGE_AUDIT: "1",
    MFL_BASELINE_RUNS: "2",
    MFL_BASELINE_PROFILES: "mobile-slow",
    MFL_BASELINE_JOURNEYS: "player,club,planner",
    MFL_BASELINE_OUTPUT: reportPath,
    MFL_BASELINE_LABEL: "PERF-06B isolated Next production/local pinned DB",
    MFL_BASELINE_SOURCE_REF: process.env.GITHUB_HEAD_REF || "isolated-perf06b",
    MFL_BASELINE_SOURCE_COMMIT: process.env.MFL_PERF06B_SOURCE_SHA || process.env.GITHUB_SHA || "",
    MFL_BASELINE_ACCESS_CONTEXT: "guest-only/pinned-validated-snapshot/no-live-writes",
  },
});
const exitCode = await new Promise((resolveCode, reject) => {
  child.once("error", reject);
  child.once("close", resolveCode);
});
assert.equal(exitCode, 0, "PERF-06B baseline capture exited with error; inspect phase logs.");
const report = JSON.parse(await readFile(reportPath, "utf8"));
assert.equal(report.metadata?.complete, true, "Capture must include all cold, refresh and cached repetitions.");
const expectedJourneys = ["player", "club", "planner"];
const rows = report.raw?.["mobile-slow"] || {};
function median(nums) {
  const values = nums.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}
function medianOf(list, key) { return median(list.map(item => Number(item?.[key])).filter(Number.isFinite)); }
for (const name of expectedJourneys) {
  const data = rows[name];
  assert(data, "Required Player/Club/Planner journey not measured: " + name);
  for (const phase of ["cold", "refresh", "cached"]) {
    const values = data[phase];
    assert.equal(values?.length, 2, name + "/" + phase + " requires two independent measured visits.");
    assert(values.every(x => Number.isFinite(x.imageRequests) && Number.isFinite(x.imageTransferredBytes)),
      name + "/" + phase + " image request and byte counters must be present.");
    assert(values.every(x => typeof x.imageDecodeProbe?.visibleDecodableImages === "number"),
      name + "/" + phase + " DOM decode observations must be present.");
    const imageErrors = values.reduce((sum, x) => sum + (x.imageFailed || 0), 0);
    console.log("PERF06B_IMAGE_PHASE " + JSON.stringify({
      route: name, phase, samples: values.length,
      imageRequestsMedian: medianOf(values,"imageRequests"),
      imageBytesMedian: medianOf(values,"imageTransferredBytes"),
      imageCacheEventsMedian: medianOf(values,"imageCacheEvents"),
      imageFailuresTotal: imageErrors,
      visibleDecodableDomImagesMedian: median(values.map(x=>x.imageDecodeProbe.visibleDecodableImages)),
      explicitDomDecodeMsMedian: median(values.map(x=>x.imageDecodeProbe.explicitDecodeDurationMs)),
      settledMsMedian: medianOf(values, "settledMs"),
      imagesSource: "CDP Network + DOM IMG.decode() post-settlement; excludes canvas/off-DOM Image decode",
    }));
  }
  const scrolls = data.cold.map(x => x.imageScroll);
  // captureRun stores scroll measurements adjacent to cold in its returned
  // journey result; the raw baseline schema only preserves cold/refresh/cached.
  // Nonexistent scroll values must not be misreported as zero.
  console.log("PERF06B_IMAGE_SCROLL " + JSON.stringify({
    route:name, phase:"scroll-after-cold",
    samples:scrolls.filter(Boolean).length,
    imageRequestsMedian:medianOf(scrolls,"imageRequests"),
    imageBytesMedian:medianOf(scrolls,"imageTransferredBytes"),
    available:scrolls.filter(Boolean).length===2,
  }));
}
console.log("PERF06B_CAPTURE_PASS " + JSON.stringify({
  snapshot: report.metadata?.targetContext?.datasetGeneratedAt,
  sourceCommit: report.metadata?.targetContext?.sourceCommit,
  browser: report.metadata?.targetContext?.browserVersion,
  routes: expectedJourneys,
  complete: report.metadata.complete,
  note:"Image counts include cross-origin failures. Planner may show zero portraits for guest/opt-out; zero is not an optimization. No live DB or external deployment write.",
}));
