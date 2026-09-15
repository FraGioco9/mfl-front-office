import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

import {
  collectCoreTypeDiagnostics,
  compareCoreTypeDiagnostics,
  validateCoreTypeBaselineShape,
} from "./validation/core-type-diagnostics.mjs";

const BASELINE_PATH = new URL("./validation/core-type-diagnostic-baseline.json", import.meta.url);
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const baselineErrors = validateCoreTypeBaselineShape(baseline);
if (baselineErrors.length) {
  throw new Error(
    `Canonical core TypeScript diagnostic baseline is invalid:\n${baselineErrors.join("\n")}`,
  );
}

const tscCommand = process.platform === "win32" ? "tsc.cmd" : "tsc";
const result = spawnSync(tscCommand, ["-p", "jsconfig.core.json", "--noEmit", "--pretty", "false"], {
  cwd: process.cwd(),
  encoding: "utf8",
  windowsHide: true,
});

if (result.error) throw result.error;
const output = `${result.stdout || ""}\n${result.stderr || ""}`;
const { diagnostics, unexpectedDiagnostics } = collectCoreTypeDiagnostics(output);

if (unexpectedDiagnostics.length) {
  throw new Error(
    `Canonical core TypeScript produced diagnostics outside the tracked source contract:\n${unexpectedDiagnostics.join("\n")}`,
  );
}

if (result.status === 0 && diagnostics.length === 0) {
  console.log("Canonical core TypeScript check passed without diagnostics; the fingerprint baseline can be ratcheted to zero.");
  process.exit(0);
}

if (!diagnostics.length) {
  process.stderr.write(output);
  throw new Error(
    `Canonical core TypeScript process failed with status ${result.status} without parseable diagnostics.`,
  );
}

const comparison = compareCoreTypeDiagnostics(diagnostics, baseline);
if (comparison.regressions.length) {
  const details = [];
  for (const regression of comparison.regressions) {
    details.push(
      `${regression.fingerprint.slice(0, 12)}…: ${regression.count} > ${regression.allowed}`,
    );
    for (const diagnostic of regression.diagnostics) {
      details.push(`  ${diagnostic.raw}`);
      details.push(`    source: ${diagnostic.source || "<empty source line>"}`);
    }
  }
  throw new Error(
    `Canonical core TypeScript diagnostic fingerprint baseline regressed:\n${details.join("\n")}`,
  );
}

console.log(
  `Canonical core TypeScript fingerprint check passed: ${comparison.total}/${baseline.total} diagnostics remain across ${comparison.fingerprintCount}/${baseline.fingerprintCount} baseline fingerprints; no fingerprint increased or was introduced.`,
);
