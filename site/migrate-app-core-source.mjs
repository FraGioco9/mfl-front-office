import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MARKER = "// Canonical application core source. Build-time text normalization is retired.";
const corePath = new URL("./modules/app-core.js", import.meta.url);
const buildNormalizerPath = new URL("./modules/app-core-build-normalizer.js", import.meta.url);
const temporaryNormalizerPath = new URL("./modules/.app-core-migration-normalizer.mjs", import.meta.url);
const buildPath = new URL("./build-app-core.mjs", import.meta.url);

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Migration pattern missing: ${label}`);
  return source.replace(before, after);
}

async function tolerateRetiredEvaluationRecoveryRule() {
  const filePath = new URL("./modules/app-core-route-request-normalizer.js", import.meta.url);
  let source = await readFile(filePath, "utf8");
  const before = [
    "function replaceRequired(source, before, after, label) {",
    "  const text = String(source || \"\");",
    "  if (!text.includes(before)) {",
    "    throw new Error(`Could not normalize route request pattern: ${label}.`);",
    "  }",
    "  return text.replace(before, after);",
    "}",
  ].join("\n");
  const after = [
    "function replaceRequired(source, before, after, label) {",
    "  const text = String(source || \"\");",
    "  if (!text.includes(before)) {",
    '    if (label === "Evaluation route recovery") return text;',
    "    throw new Error(`Could not normalize route request pattern: ${label}.`);",
    "  }",
    "  return text.replace(before, after);",
    "}",
  ].join("\n");
  source = replaceRequired(source, before, after, "retired Evaluation recovery normalizer rule");
  await writeFile(filePath, source, "utf8");
}

function applyBuildOnlySourceTransforms(source) {
  let normalized = String(source || "").replace(/\r\n?/g, "\n");
  const residualWidthCall = [
    '      if (typeof window.applyExactPlayerTableWidths === "function") {',
    "        window.applyExactPlayerTableWidths();",
    "      }",
    "      return true;",
  ].join("\n");
  normalized = replaceRequired(
    normalized,
    residualWidthCall,
    "      return true;",
    "residual post-render table width call",
  );

  normalized = replaceRequired(
    normalized,
    '      emoji: "\\u23F3",',
    ['      icon: "calendar-clock",', "      retirementYears,"].join("\n"),
    "retirement calendar marker",
  );
  normalized = replaceRequired(
    normalized,
    "  markerElement.textContent = marker.emoji;",
    ['  if (marker.icon !== "calendar-clock") {', "    markerElement.textContent = marker.emoji;", "  }"].join("\n"),
    "retirement marker renderer",
  );
  const playerAgeMarker = [
    "  const ageMarkerHtml = ageMarker",
    '    ? ` <span class="retirementMarker playerAgeMarker" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}">${ageMarker.emoji}</span>`',
    '    : "";',
  ].join("\n");
  const canonicalPlayerAgeMarker = [
    "  const ageMarkerHtml = ageMarker",
    '    ? ` <span class="retirementMarker playerAgeMarker" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}">${ageMarker.icon === "calendar-clock" ? "" : ageMarker.emoji}</span>`',
    '    : "";',
  ].join("\n");
  return replaceRequired(normalized, playerAgeMarker, canonicalPlayerAgeMarker, "Player retirement marker");
}

function canonicalBuildNormalizerSource() {
  return `// @ts-check

import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

export const CANONICAL_APPLICATION_CORE_SOURCE_MARKER = ${JSON.stringify(MARKER)};

function canonicalApplicationCoreSource(source) {
  const text = String(source || "").replace(/\\r\\n?/g, "\\n");
  if (!text.startsWith(CANONICAL_APPLICATION_CORE_SOURCE_MARKER)) {
    throw new Error("Application core source is not canonical.");
  }
  return text;
}

export function normalizeBuiltApplicationCoreArtifacts(source) {
  const routeArtifacts = splitApplicationCoreRuntime(canonicalApplicationCoreSource(source));
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(routeArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(playerArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  return splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
`;
}

async function makeCanonicalBuildDirect() {
  let buildSource = await readFile(buildPath, "utf8");
  const helperStart = buildSource.indexOf("function removeResidualLegacyWidthCall(");
  const releaseStart = buildSource.indexOf("const release = JSON.parse(");
  if (helperStart < 0 || releaseStart < 0 || releaseStart <= helperStart) {
    throw new Error("Could not locate legacy build-only source transforms.");
  }
  buildSource = `${buildSource.slice(0, helperStart)}${buildSource.slice(releaseStart)}`;

  const oldSourceRead = [
    "const source = normalizeRetirementCalendarIcon(",
    '  removeResidualLegacyWidthCall(await readFile(sourcePath, "utf8")),',
    ");",
  ].join("\n");
  const newSourceRead = [
    'const source = await readFile(sourcePath, "utf8");',
    "if (!source.startsWith(CANONICAL_APPLICATION_CORE_SOURCE_MARKER)) {",
    '  throw new Error("Application core source must be canonical before build.");',
    "}",
  ].join("\n");
  buildSource = replaceRequired(buildSource, oldSourceRead, newSourceRead, "direct canonical source build");
  buildSource = buildSource.replace(
    'import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";',
    'import { CANONICAL_APPLICATION_CORE_SOURCE_MARKER, normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";',
  );
  await writeFile(buildPath, buildSource, "utf8");
}

async function preserveLegacyValidatorEntrypoints() {
  const entries = [
    ["app-core-normalizer.js", "normalizeApplicationCore"],
    ["app-core-route-request-normalizer.js", "normalizeRouteRequestCancellation"],
    ["app-core-route-runtime-normalizer.js", "normalizeRouteRuntimeGate"],
    ["app-core-startup-data-normalizer.js", "normalizeStartupDataDependencies"],
    ["app-core-table-events-normalizer.js", "normalizeTableEventDelegation"],
    ["app-core-table-state-normalizer.js", "normalizePureTableStateRestoration"],
  ];

  for (const [fileName, functionName] of entries) {
    const filePath = new URL(`./modules/${fileName}`, import.meta.url);
    let source = await readFile(filePath, "utf8");
    const pattern = new RegExp(`((?:export\\s+)?function\\s+${functionName}\\s*\\(source[^)]*\\)\\s*\\{)`);
    const match = source.match(pattern);
    if (!match) throw new Error(`Normalizer entrypoint not found: ${functionName}`);
    const guard = `\n  if (String(source || "").startsWith(${JSON.stringify(MARKER)})) {\n    return String(source || "").replace(/\\r\\n?/g, "\\n");\n  }`;
    source = source.replace(pattern, `${match[1]}${guard}`);
    await writeFile(filePath, source, "utf8");
  }
}

await tolerateRetiredEvaluationRecoveryRule();

const buildNormalizerSource = await readFile(buildNormalizerPath, "utf8");
if (!buildNormalizerSource.includes("function normalizeCompleteApplicationCore(source)")) {
  throw new Error("Complete application-core normalizer entrypoint was not found.");
}
if (!buildNormalizerSource.includes("function normalizeReleaseOwnership(source)")) {
  throw new Error("Release ownership normalizer entrypoint was not found.");
}
await writeFile(
  temporaryNormalizerPath,
  buildNormalizerSource
    .replace("function normalizeCompleteApplicationCore(source)", "export function normalizeCompleteApplicationCore(source)")
    .replace("function normalizeReleaseOwnership(source)", "export function normalizeReleaseOwnership(source)"),
  "utf8",
);

try {
  const migrationModule = await import(`${pathToFileURL(temporaryNormalizerPath.pathname).href}?migration=${Date.now()}`);
  let source = applyBuildOnlySourceTransforms(await readFile(corePath, "utf8"));
  source = migrationModule.normalizeCompleteApplicationCore(source);
  source = migrationModule.normalizeReleaseOwnership(source).replace(/^\s+/, "").replace(/\s*$/, "");

  for (const forbidden of ["window.eval", "eval(", "__mflEvaluationRouteStability", "evaluationRouteStabilityStyles", "\\u23F3", "⏳"]) {
    if (source.includes(forbidden)) throw new Error(`Canonical application core still contains legacy source: ${forbidden}`);
  }
  if (!source.includes('ageMarker.icon === "calendar-clock" ? "" : ageMarker.emoji')) {
    throw new Error("Canonical application core lost the calendar-clock retirement marker.");
  }

  await writeFile(corePath, `${MARKER}\n${source}\n`, "utf8");
} finally {
  await unlink(temporaryNormalizerPath).catch(() => {});
}

await writeFile(buildNormalizerPath, canonicalBuildNormalizerSource(), "utf8");
await makeCanonicalBuildDirect();
await preserveLegacyValidatorEntrypoints();

console.log("Application core source migration completed.");
