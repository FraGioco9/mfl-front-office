import assert from "node:assert/strict";

import {
  collectCoreTypeDiagnostics,
  compareCoreTypeDiagnostics,
  validateCoreTypeBaselineShape,
} from "./validation/core-type-diagnostics.mjs";

const file = "modules/core-sources/example.js";
const message = "Property 'missing' does not exist on type '{}'.";
const outputAt = (line, sourceMessage = message) =>
  `${file}(${line},3): error TS2339: ${sourceMessage}`;

function collect(output, source) {
  return collectCoreTypeDiagnostics(output, {
    readFile: (requestedFile) => {
      assert.equal(requestedFile, file);
      return source;
    },
  });
}

const originalSource = "const stable = true;\nvalue.missing;\n";
const original = collect(outputAt(2), originalSource);
assert.equal(original.unexpectedDiagnostics.length, 0);
assert.equal(original.diagnostics.length, 1);

const fingerprint = original.diagnostics[0].fingerprint;
const baseline = {
  version: 1,
  sourceCommit: "test",
  total: 1,
  fingerprintCount: 1,
  fingerprints: { [fingerprint]: 1 },
};
assert.deepEqual(validateCoreTypeBaselineShape(baseline), []);

const unchanged = compareCoreTypeDiagnostics(original.diagnostics, baseline);
assert.equal(unchanged.regressions.length, 0);

const reduced = compareCoreTypeDiagnostics([], baseline);
assert.equal(reduced.regressions.length, 0, "Resolved diagnostics must not require a baseline rewrite.");

const shiftedSource = "\nconst stable = true;\nvalue.missing;\n";
const shifted = collect(outputAt(3), shiftedSource);
assert.equal(
  shifted.diagnostics[0].fingerprint,
  fingerprint,
  "Line-number-only movement must preserve the diagnostic fingerprint.",
);
assert.equal(compareCoreTypeDiagnostics(shifted.diagnostics, baseline).regressions.length, 0);

const replacedMessage = collect(
  outputAt(2, "Property 'replacement' does not exist on type '{}'."),
  originalSource,
);
assert.equal(
  compareCoreTypeDiagnostics(replacedMessage.diagnostics, baseline).regressions.length,
  1,
  "A different diagnostic message in the same file/code bucket must fail.",
);

const replacedSource = collect(outputAt(2), "const stable = true;\nother.missing;\n");
assert.equal(
  compareCoreTypeDiagnostics(replacedSource.diagnostics, baseline).regressions.length,
  1,
  "A diagnostic on different source text must fail even when its TypeScript code and message match.",
);

const duplicated = collect(`${outputAt(2)}\n${outputAt(2)}`, originalSource);
const duplicateComparison = compareCoreTypeDiagnostics(duplicated.diagnostics, baseline);
assert.equal(duplicateComparison.regressions.length, 1);
assert.equal(duplicateComparison.regressions[0].count, 2);
assert.equal(duplicateComparison.regressions[0].allowed, 1);

const unexpected = collectCoreTypeDiagnostics("elsewhere.ts(1,1): error TS2339: unexpected");
assert.deepEqual(unexpected.diagnostics, []);
assert.deepEqual(unexpected.unexpectedDiagnostics, [
  "elsewhere.ts(1,1): error TS2339: unexpected",
]);

assert.ok(
  validateCoreTypeBaselineShape({
    ...baseline,
    total: 2,
  }).some((error) => error.includes("baseline total mismatch")),
  "Corrupt baseline metadata must fail validation.",
);

console.log(
  "Core TypeScript diagnostics allow removals and line shifts while rejecting new messages, source locations, duplicate growth, and untracked files.",
);
