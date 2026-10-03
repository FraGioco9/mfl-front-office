// PERF-03: opt-in CDP source-coverage and compile/execution audit.
// This wrapper instruments the unchanged perf-01 browser lifecycle in a temporary
// copy. It is intentionally not an app runtime and does not change production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const original = await readFile(resolve(directory, "performance-baseline.mjs"), "utf8");
const temporary = resolve(directory, ".perf03-js-audit-instrumented.tmp.mjs");
let instrumented = original;

function insertOnce(before, after, label) {
  const first = instrumented.indexOf(before);
  assert.ok(first >= 0 && instrumented.indexOf(before, first + 1) === -1, "Missing or ambiguous PERF-03 hook: " + label);
  instrumented = instrumented.replace(before, after);
}

const auditHelper = [
  "async function perf03ReadJsAudit(cdp) {",
  "  const [coverage, timing] = await Promise.all([",
  "    cdp.send('Profiler.takePreciseCoverage'),",
  "    cdp.send('Performance.getMetrics'),",
  "  ]);",
  "  const performanceMetrics = Object.fromEntries(",
  "    (timing.metrics || []).filter(x => x && typeof x.name === 'string' && Number.isFinite(x.value)).map(x => [x.name, x.value]),",
  "  );",
  "  const scripts = (coverage.result || []).filter(x => /^https?:\\/\\//.test(x.url || '')).map(script => {",
  "    const functions = script.functions || [];",
  "    const ranges = functions.flatMap(f => f.ranges || []);",
  "    const sourceLengthUnits = ranges.reduce((m, r) => Math.max(m, r.endOffset || 0), 0);",
  "    const touchedFunctions = functions.filter(f => f.ranges?.some(r => r.count > 0)).length;",
  "    const zeroCountRanges = ranges.filter(r => r.count === 0).length;",
  "    // Function offsets allow the audit to map reached code back to canonical Shared fragments.",
  "    const coreFunctions = /\\/modules\\/app-core-runtime\\.js(?:\\?|$)/.test(script.url) ? functions.map(fn => ({",
  "      name: fn.functionName || '', start: fn.ranges?.[0]?.startOffset ?? null, end: fn.ranges?.[0]?.endOffset ?? null,",
  "      reached: fn.ranges?.some(r => r.count > 0) || false,",
  "    })) : [];",
  "    return { url: script.url, sourceLengthUnits, functions: functions.length, touchedFunctions, zeroCountRanges, coreFunctions };",
  "  });",
  "  return { performanceMetrics, scripts };",
  "}",
  "",
].join("\n");
insertOnce("async function runJourney(executable, profile, journey) {", auditHelper + "async function runJourney(executable, profile, journey) {", "audit helper");
insertOnce(
  '    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: observerBootstrap });',
  [
    "    await cdp.send('Profiler.enable');",
    "    await cdp.send('Profiler.startPreciseCoverage', { callCount: false, detailed: true });",
    "    await cdp.send('Performance.enable');",
    '    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: observerBootstrap });',
  ].join("\n"),
  "CDP profiler before navigation",
);
insertOnce(
  "    const refresh = await runMeasuredPhase(",
  "    const perf03Cold = await perf03ReadJsAudit(cdp);\n\n    const refresh = await runMeasuredPhase(",
  "cold checkpoint",
);
insertOnce(
  "    await waitForSpaNavigationReady(cdp, routeTimeoutMs);",
  "    const perf03Refresh = await perf03ReadJsAudit(cdp);\n\n    await waitForSpaNavigationReady(cdp, routeTimeoutMs);",
  "refresh checkpoint",
);
insertOnce(
  "    await applyCachedRenderProbe(cdp, journey.cachedProbe);",
  "    await applyCachedRenderProbe(cdp, journey.cachedProbe);\n    const perf03CachedBefore = await perf03ReadJsAudit(cdp);",
  "post-parking baseline",
);
insertOnce(
  "    return { cold, refresh, cached };",
  [
    "    const perf03Cached = await perf03ReadJsAudit(cdp);",
    "    const perf03CachedTimingDelta = {};",
    "    for (const key of Object.keys(perf03Cached.performanceMetrics)) {",
    "      const after = perf03Cached.performanceMetrics[key];",
    "      const before = perf03CachedBefore.performanceMetrics[key];",
    "      if (typeof before === 'number' && Number.isFinite(after - before)) perf03CachedTimingDelta[key] = after - before;",
    "    }",
    "    return {",
    "      cold: { ...cold, perf03Js: perf03Cold },",
    "      refresh: { ...refresh, perf03Js: perf03Refresh },",
    "      cached: { ...cached, perf03Js: { ...perf03Cached, performanceMetrics: perf03CachedTimingDelta } },",
    "    };",
  ].join("\n"),
  "phase audit attribution",
);

await writeFile(temporary, instrumented, "utf8");
try {
  const code = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [temporary], {
      env: process.env, stdio: "inherit",
    });
    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)));
  });
  assert.equal(code, 0, "PERF-03 source coverage capture failed.");
} finally {
  await rm(temporary, { force: true });
}
