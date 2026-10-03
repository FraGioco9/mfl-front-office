// PERF-03 opt-in CDP JavaScript evidence summary. Never included in client bundles.
import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { coreSourceManifest } from "../modules/core-source-manifest.js";

const [input, output, markdownOutput] = process.argv.slice(2);
assert.ok(input && output && markdownOutput, "Usage: node validation/perf03-js-report.mjs capture.json report.json report.md");
const root = fileURLToPath(new URL("../", import.meta.url));
const report = JSON.parse(await readFile(input, "utf8"));
const staticPaths = [
  "bootstrap.js", "bootstrap-core.js", "modules/app-entry.js",
  "modules/app-config.js", "table-width-runtime.js",
  "first-paint-table-header-runtime.js",
  ...coreSourceManifest.map(({ runtime }) => "modules/" + runtime),
];
const localBytes = {};
for (const path of staticPaths) {
  try { localBytes["/" + path] = (await stat(resolve(root, path))).size; }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
}
const labels = report.metadata.profiles;
const routeRows = [];
const loadPathsByRoute = {};
for (const profile of labels) {
  for (const [journey, phases] of Object.entries(report.raw[profile])) {
    const pathSets = {};
    for (const phase of ["cold", "refresh", "cached"]) {
      const snapshot = phases[phase][0];
      const audit = snapshot.perf03Js;
      assert.ok(audit?.scripts && audit?.performanceMetrics, profile + "/" + journey + "/" + phase);
      const localScripts = audit.scripts.filter((s) => {
        try { return new URL(s.url).hostname === "127.0.0.1"; }
        catch { return false; }
      });
      const paths = [...new Set(localScripts.map((s) => new URL(s.url).pathname))].sort();
      pathSets[phase] = paths;
      const staticJSBytes = paths.reduce((n, p) => n + (localBytes[p] || 0), 0);
      const metric = (name) => {
        const value = audit.performanceMetrics[name];
        return Number.isFinite(value) ? Math.round(value * 1000 * 100) / 100 : null;
      };
      routeRows.push({
        profile, journey, phase,
        scriptMs: metric("ScriptDuration"),
        compileMs: metric("V8CompileDuration"),
        taskMs: metric("TaskDuration"),
        staticJSBytes, localScriptCount: paths.length,
        transpiledSourceChars: localScripts.reduce((n, s) => n + (s.sourceLengthUnits || 0), 0),
        loadedScripts: paths,
        sharedCoreUsedFunctions: localScripts.filter((s) => new URL(s.url).pathname === "/modules/app-core-runtime.js")
          .map((s) => ({ declared: s.functions, touched: s.touchedFunctions, zeroCountRanges: s.zeroCountRanges })),
        phaseTransferredBytes: snapshot.transferredBytes,
      });
    }
    loadPathsByRoute[profile + "/" + journey] = pathSets;
  }
}
const pathRoutes = Object.keys(loadPathsByRoute);
const universallyCold = Object.keys(localBytes).filter((p) => pathRoutes.every((id) => loadPathsByRoute[id].cold.includes(p)));
const routeOwned = coreSourceManifest.filter(({ domain }) => domain !== "shared").map(({ domain, runtime }) => ({
  domain, runtime: "/modules/" + runtime,
  declaredBytes: localBytes["/modules/" + runtime] || null,
  coldRoutes: pathRoutes.filter((id) => loadPathsByRoute[id].cold.includes("/modules/" + runtime)),
}));
const evidence = {
  metadata: report.metadata,
  provenance: {
    note: "CDP Profiler precise coverage; Performance.getMetrics ScriptDuration and V8CompileDuration. Instrumentation itself changes absolute timing. Cold/refresh metrics are document totals, cached values subtract a post-parking baseline. Captures are not production RUM or separate parse and evaluation ground truth.",
    metricsAreMilliseconds: true,
    commonRuntimeBytes: universallyCold.reduce((n, p) => n + (localBytes[p] || 0), 0),
    manifestCeilingSharedBytes: coreSourceManifest.find((x) => x.domain === "shared")?.maxUniversalBytes,
  },
  localBytes, universallyCold, routeOwned, routeRows,
};
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n", "utf8");
const kb = (value) => value == null ? "-" : (value / 1024).toFixed(1);
const fmt = (value) => value == null ? "-" : Number(value).toFixed(1);
const lines = [
  "## PERF-03 experimental CDP JavaScript route audit",
  "",
  "Source: " + report.metadata.targetContext.sourceCommit
    + "; dataset: " + report.metadata.targetContext.datasetGeneratedAt
    + "; Chrome: " + report.metadata.targetContext.browserVersion,
  "",
  "**Measurement caveat:** CDP precise coverage is intrusive. ScriptDuration and V8CompileDuration are Chrome counters, not a profiler of individual source functions; neither is production latency. The source byte counts below are non-gzipped repository bytes (not transferred bytes).",
  "",
  "| Profile | Route | Phase | JS execution ms | V8 compile ms | Local scripts | Indexed source KiB |",
  "| --- | --- | --- | ---: | ---: | ---: | ---: |",
  ...routeRows.map((r) => "| " + [r.profile, r.journey, r.phase, fmt(r.scriptMs), fmt(r.compileMs), r.localScriptCount, kb(r.staticJSBytes)].join(" | ") + " |"),
  "",
  "### Universal same-origin scripts present on every cold route",
  "",
  "| Script | Uncompressed KiB |",
  "| --- | ---: |",
  ...universallyCold.map((p) => "| " + p + " | " + kb(localBytes[p]) + " |"),
  "",
  "### Route-owned core bundles discovered",
  "",
  "| Domain | JS runtime | KiB | Routes that loaded it on cold |",
  "| --- | --- | ---: | --- |",
  ...routeOwned.map((r) => "| " + r.domain + " | " + r.runtime + " | " + kb(r.declaredBytes) + " | " + r.coldRoutes.join(", ") + " |"),
  "",
  "**Gate:** do not move shared code into a lazy domain without verifying lexical dependencies, first paint, back-forward, deep links and subsequent route navigation with unchanged accessible behavior.",
  "",
];
await writeFile(markdownOutput, lines.join("\n") + "\n", "utf8");
console.log(lines.join("\n"));
