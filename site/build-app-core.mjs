import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(siteRoot, "modules/app-core.js");
const releasePath = resolve(siteRoot, "release.json");
const tableWidthRuntimePath = resolve(siteRoot, "table-width-runtime.js");
const runtimePath = resolve(siteRoot, "modules/app-core-runtime.js");
const evaluationRuntimePath = resolve(siteRoot, "modules/app-core-evaluation-runtime.js");
const mflStatsRuntimePath = resolve(siteRoot, "modules/app-core-mfl-stats-runtime.js");
const clubRuntimePath = resolve(siteRoot, "modules/app-core-club-runtime.js");
const settingsRuntimePath = resolve(siteRoot, "modules/app-core-settings-runtime.js");
const playerRuntimePath = resolve(siteRoot, "modules/app-core-player-runtime.js");
const tableRuntimePath = resolve(siteRoot, "modules/app-core-table-runtime.js");
const walletRuntimePath = resolve(siteRoot, "modules/app-core-wallet-runtime.js");
const watchlistRuntimePath = resolve(siteRoot, "modules/app-core-watchlist-runtime.js");

function removeResidualLegacyWidthCall(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n");
  const residualWidthCall = [
    '      if (typeof window.applyExactPlayerTableWidths === "function") {',
    "        window.applyExactPlayerTableWidths();",
    "      }",
    "      return true;",
  ].join("\n");
  if (!normalized.includes(residualWidthCall)) {
    throw new Error("Could not remove residual post-render table width call from app-core source.");
  }
  return normalized.replace(residualWidthCall, "      return true;");
}

function normalizeRetirementCalendarIcon(source) {
  let normalized = String(source || "").replace(/\r\n?/g, "\n");

  const hourglassMarker = '      emoji: "\\u23F3",';
  if (!normalized.includes(hourglassMarker)) {
    throw new Error("Could not locate the legacy retirement hourglass marker in app-core source.");
  }
  normalized = normalized.replace(
    hourglassMarker,
    [
      '      icon: "calendar-clock",',
      "      retirementYears,",
    ].join("\n"),
  );

  const markerAssignment = "  markerElement.textContent = marker.emoji;";
  if (!normalized.includes(markerAssignment)) {
    throw new Error("Could not locate the name-marker emoji assignment in app-core source.");
  }
  normalized = normalized.replace(
    markerAssignment,
    [
      '  if (marker.icon !== "calendar-clock") {',
      "    markerElement.textContent = marker.emoji;",
      "  }",
    ].join("\n"),
  );

  const playerAgeMarker = [
    "  const ageMarkerHtml = ageMarker",
    '    ? ` <span class="retirementMarker playerAgeMarker" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}">${ageMarker.emoji}</span>`',
    '    : "";',
  ].join("\n");
  if (!normalized.includes(playerAgeMarker)) {
    throw new Error("Could not locate the Player retirement marker renderer in app-core source.");
  }
  normalized = normalized.replace(
    playerAgeMarker,
    [
      "  const ageMarkerHtml = ageMarker",
      '    ? ` <span class="retirementMarker playerAgeMarker" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}">${ageMarker.icon === "calendar-clock" ? "" : ageMarker.emoji}</span>`',
      '    : "";',
    ].join("\n"),
  );

  return normalized;
}

function normalizeTooltipHeightOwnership(source) {
  let normalized = String(source || "").replace(/\r\n?/g, "\n");

  normalized = normalized.replaceAll(
    "Number(window.__mflTooltipSettings?.gap) || 6",
    "Number(window.__mflTooltipHeight)",
  );
  normalized = normalized.replaceAll("const tooltipGap = Number(window.__mflTooltipHeight);", "const tooltipHeight = Number(window.__mflTooltipHeight);");
  normalized = normalized.replaceAll("tooltipRect.height - tooltipGap", "tooltipRect.height - tooltipHeight");
  normalized = normalized.replaceAll("anchorBottom + tooltipGap", "anchorBottom + tooltipHeight");

  const manualAnchor = [
    "  const anchorHeight = 14;",
    "  const anchorTop = iconRect.top + Math.max(0, (iconRect.height - anchorHeight) / 2);",
    "  const anchorBottom = anchorTop + anchorHeight;",
    "",
    "  const tooltipHeight = Number(window.__mflTooltipHeight);",
    "  let top = anchorTop - tooltipRect.height - tooltipHeight;",
    "  if (top < margin) {",
    "    top = anchorBottom + tooltipHeight;",
    "  }",
  ].join("\n");
  const canonicalAnchor = [
    "  const tooltipHeight = Number(window.__mflTooltipHeight);",
    "  let top = iconRect.top - tooltipRect.height - tooltipHeight;",
    "  if (top < margin) {",
    "    top = iconRect.bottom + tooltipHeight;",
    "  }",
  ].join("\n");
  if (normalized.includes(manualAnchor)) normalized = normalized.replace(manualAnchor, canonicalAnchor);

  return normalized;
}

const release = JSON.parse(await readFile(releasePath, "utf8"));
const appConfigRuntime = browserConfigRuntimeSource(release).replace(/\s*$/, "");
if (!appConfigRuntime) throw new Error("Canonical app configuration produced an empty browser runtime.");
const preBootstrapRuntime = `${appConfigRuntime}\nwindow.__mflUniformWidth = Object.freeze({\n  name: "Uniform Width",\n  source: "styles.css",\n  unit: "%",\n});`;

const source = normalizeRetirementCalendarIcon(
  removeResidualLegacyWidthCall(await readFile(sourcePath, "utf8")),
);
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const normalized = normalizeTooltipHeightOwnership(String(artifacts.core || "")).replace(/\s*$/, "");
const evaluationRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.evaluation || "")).replace(/\s*$/, "");
const mflStatsRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.mflstats || "")).replace(/\s*$/, "");
const clubRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.club || "")).replace(/\s*$/, "");
const settingsRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.settings || "")).replace(/\s*$/, "");
const playerRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.player || "")).replace(/\s*$/, "");
const tableRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.table || "")).replace(/\s*$/, "");
const walletRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.wallet || "")).replace(/\s*$/, "");
const watchlistRuntime = normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.watchlist || "")).replace(/\s*$/, "");
if (!normalized) throw new Error("Application core normalization produced an empty runtime.");
if (!evaluationRuntime) throw new Error("Application core normalization produced an empty Evaluation runtime.");
if (!mflStatsRuntime) throw new Error("Application core normalization produced an empty MFL Stats runtime.");
if (!clubRuntime) throw new Error("Application core normalization produced an empty Club runtime.");
if (!settingsRuntime) throw new Error("Application core normalization produced an empty Settings runtime.");
if (!playerRuntime) throw new Error("Application core normalization produced an empty Player runtime.");
if (!tableRuntime) throw new Error("Application core normalization produced an empty Table runtime.");
if (!walletRuntime) throw new Error("Application core normalization produced an empty Wallet runtime.");
if (!watchlistRuntime) throw new Error("Application core normalization produced an empty Watchlist runtime.");

const generatedArtifacts = [
  [runtimePath, normalized, "normalized"],
  [evaluationRuntimePath, evaluationRuntime, "route-owned"],
  [mflStatsRuntimePath, mflStatsRuntime, "route-owned"],
  [clubRuntimePath, clubRuntime, "route-owned"],
  [settingsRuntimePath, settingsRuntime, "route-owned"],
  [playerRuntimePath, playerRuntime, "route-owned"],
  [tableRuntimePath, tableRuntime, "route-owned"],
  [walletRuntimePath, walletRuntime, "action-owned"],
  [watchlistRuntimePath, watchlistRuntime, "route-owned"],
];

const legacyHourglassTokens = ["⏳", "\\u23F3", "\\u23f3"];
const leakedHourglassArtifact = generatedArtifacts.find(([, artifact]) =>
  legacyHourglassTokens.some((token) => artifact.includes(token)),
);
if (leakedHourglassArtifact) {
  throw new Error(`Legacy retirement hourglass leaked into generated runtime: ${leakedHourglassArtifact[0]}.`);
}
if (!playerRuntime.includes('ageMarker.icon === "calendar-clock" ? "" : ageMarker.emoji')) {
  throw new Error("Player runtime does not use the calendar-clock retirement marker contract.");
}
for (const localTableIdTooltipListener of [
  'button.addEventListener("mouseenter", () => showPlayerNoteTooltip(button));',
  'button.addEventListener("mouseleave", hidePlayerNoteTooltip);',
  'button.addEventListener("blur", hidePlayerNoteTooltip);',
]) {
  if (playerRuntime.includes(localTableIdTooltipListener)) {
    throw new Error("Table player-ID tooltips must be owned only by the global Tooltip Height runtime.");
  }
}

for (const [path, artifact] of generatedArtifacts) {
  if (artifact.includes("window.eval") || artifact.includes("eval(")) {
    throw new Error(`String evaluation leaked into generated application core: ${path}.`);
  }
  if (artifact.includes("__mflEvaluationRouteStability") || artifact.includes("evaluationRouteStabilityStyles")) {
    throw new Error(`Legacy Evaluation route-stability ownership leaked into generated application core: ${path}.`);
  }
  if (artifact.includes("__mflTooltipSettings?.gap") || artifact.includes("anchorHeight = 14")) {
    throw new Error(`Legacy tooltip spacing ownership leaked into generated application core: ${path}.`);
  }
}
if (!generatedArtifacts.some(([, artifact]) => artifact.includes("iconRect.top - tooltipRect.height - tooltipHeight"))) {
  throw new Error("Generated application core does not position manual tooltips from the real generator rectangle.");
}

const banner = "// Generated by build-app-core.mjs from modules/app-core.js. Do not edit directly.\n";
const evaluationBanner = "// Generated Evaluation core chunk from modules/app-core.js. Do not edit directly.\n";
const mflStatsBanner = "// Generated MFL Stats core chunk from modules/app-core.js. Do not edit directly.\n";
const clubBanner = "// Generated Club core chunk from modules/app-core.js. Do not edit directly.\n";
const settingsBanner = "// Generated Settings core chunk from modules/app-core.js. Do not edit directly.\n";
const playerBanner = "// Generated Player core chunk from modules/app-core.js. Do not edit directly.\n";
const tableBanner = "// Generated Table core chunk from modules/app-core.js. Do not edit directly.\n";
const walletBanner = "// Generated Wallet core chunk from modules/app-core.js. Do not edit directly.\n";
const watchlistBanner = "// Generated Watchlist core chunk from modules/app-core.js. Do not edit directly.\n";
await Promise.all([
  writeFile(tableWidthRuntimePath, `${preBootstrapRuntime}\n`, "utf8"),
  writeFile(runtimePath, `${banner}${normalized}\n`, "utf8"),
  writeFile(evaluationRuntimePath, `${evaluationBanner}${evaluationRuntime}\n`, "utf8"),
  writeFile(mflStatsRuntimePath, `${mflStatsBanner}${mflStatsRuntime}\n`, "utf8"),
  writeFile(clubRuntimePath, `${clubBanner}${clubRuntime}\n`, "utf8"),
  writeFile(settingsRuntimePath, `${settingsBanner}${settingsRuntime}\n`, "utf8"),
  writeFile(playerRuntimePath, `${playerBanner}${playerRuntime}\n`, "utf8"),
  writeFile(tableRuntimePath, `${tableBanner}${tableRuntime}\n`, "utf8"),
  writeFile(walletRuntimePath, `${walletBanner}${walletRuntime}\n`, "utf8"),
  writeFile(watchlistRuntimePath, `${watchlistBanner}${watchlistRuntime}\n`, "utf8"),
]);

if (process.env.MFL_BUILD_VERBOSE === "1") {
  console.log(`Generated ${tableWidthRuntimePath} (${Buffer.byteLength(preBootstrapRuntime, "utf8")} canonical config + Uniform Width bytes).`);
  generatedArtifacts.forEach(([path, artifact, ownership]) => {
    console.log(`Generated ${path} (${Buffer.byteLength(artifact, "utf8")} ${ownership} bytes).`);
  });
}
