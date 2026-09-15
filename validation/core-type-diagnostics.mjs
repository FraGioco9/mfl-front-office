import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CORE_TYPE_DIAGNOSTIC_PATTERN =
  /^(modules\/core-sources\/[^(:]+\.js)\((\d+),(\d+)\): error TS(\d+): (.*)$/;

export function normalizeCoreTypeSource(source) {
  return String(source || "").trim().replace(/\s+/g, " ");
}

export function coreTypeDiagnosticFingerprint({ file, code, message, source }) {
  return createHash("sha256")
    .update([file, code, message, normalizeCoreTypeSource(source)].join("\n"))
    .digest("hex");
}

export function collectCoreTypeDiagnostics(output, { readFile = readFileSync } = {}) {
  const diagnostics = [];
  const unexpectedDiagnostics = [];
  const sourceCache = new Map();

  const sourceLines = (file) => {
    if (!sourceCache.has(file)) {
      sourceCache.set(file, String(readFile(file, "utf8")).split(/\r?\n/));
    }
    return sourceCache.get(file);
  };

  for (const line of String(output || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.includes("error TS")) continue;

    const match = CORE_TYPE_DIAGNOSTIC_PATTERN.exec(trimmed);
    if (!match) {
      unexpectedDiagnostics.push(trimmed);
      continue;
    }

    const [, file, lineNumberText, columnNumberText, codeNumber, message] = match;
    const lineNumber = Number(lineNumberText);
    const columnNumber = Number(columnNumberText);
    const code = `TS${codeNumber}`;
    const source = normalizeCoreTypeSource(sourceLines(file)[lineNumber - 1] || "");
    const fingerprint = coreTypeDiagnosticFingerprint({ file, code, message, source });

    diagnostics.push({
      file,
      lineNumber,
      columnNumber,
      code,
      message,
      source,
      fingerprint,
      raw: trimmed,
    });
  }

  return { diagnostics, unexpectedDiagnostics };
}

export function countCoreTypeFingerprints(diagnostics) {
  const counts = new Map();
  for (const diagnostic of diagnostics) {
    counts.set(diagnostic.fingerprint, (counts.get(diagnostic.fingerprint) || 0) + 1);
  }
  return counts;
}

export function validateCoreTypeBaselineShape(baseline) {
  const errors = [];
  if (!baseline || baseline.version !== 1) {
    errors.push("baseline version must be 1");
    return errors;
  }

  if (!Number.isInteger(baseline.total) || baseline.total < 0) {
    errors.push("baseline total must be a non-negative integer");
  }
  if (!Number.isInteger(baseline.fingerprintCount) || baseline.fingerprintCount < 0) {
    errors.push("baseline fingerprintCount must be a non-negative integer");
  }
  if (!baseline.fingerprints || typeof baseline.fingerprints !== "object" || Array.isArray(baseline.fingerprints)) {
    errors.push("baseline fingerprints must be an object");
    return errors;
  }

  const entries = Object.entries(baseline.fingerprints);
  const countedTotal = entries.reduce((sum, [fingerprint, count]) => {
    if (!/^[0-9a-f]{64}$/.test(fingerprint)) {
      errors.push(`invalid diagnostic fingerprint: ${fingerprint}`);
    }
    if (!Number.isInteger(count) || count <= 0) {
      errors.push(`invalid diagnostic fingerprint count for ${fingerprint}: ${count}`);
      return sum;
    }
    return sum + count;
  }, 0);

  if (baseline.fingerprintCount !== entries.length) {
    errors.push(
      `baseline fingerprintCount mismatch: ${baseline.fingerprintCount} != ${entries.length}`,
    );
  }
  if (baseline.total !== countedTotal) {
    errors.push(`baseline total mismatch: ${baseline.total} != ${countedTotal}`);
  }

  return errors;
}

export function compareCoreTypeDiagnostics(diagnostics, baseline) {
  const currentCounts = countCoreTypeFingerprints(diagnostics);
  const regressions = [];

  for (const [fingerprint, count] of currentCounts) {
    const allowed = Number(baseline.fingerprints[fingerprint] || 0);
    if (count <= allowed) continue;
    regressions.push({
      fingerprint,
      count,
      allowed,
      diagnostics: diagnostics.filter((diagnostic) => diagnostic.fingerprint === fingerprint),
    });
  }

  return {
    total: diagnostics.length,
    fingerprintCount: currentCounts.size,
    regressions,
  };
}
