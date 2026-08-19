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

function replaceSourceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not normalize application core section: ${label}.`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function normalizeRetirementMarkerContract(source) {
  let normalized = String(source || "").replace(/\r\n?/g, "\n");

  normalized = replaceSourceSection(
    normalized,
    "function retirementMarker(row) {",
    "function newMintMarker(row) {",
    `function retirementMarker(row) {
      const rawRetirementYears = getValue(row, "retirement_years");
      const retirementYears = rawRetirementYears === null
        || rawRetirementYears === undefined
        || String(rawRetirementYears).trim() === ""
        ? null
        : Number(rawRetirementYears);

  if (retirementYears === 0) {
    return {
      icon: "calendar-x-2",
      label: "Retired",
      status: "retired",
    };
  }

  if ([1, 2, 3].includes(retirementYears)) {
    return {
      icon: "calendar-clock",
      label: \`${'${retirementYears}'} year${'${retirementYears === 1 ? "" : "s"}'} left\`,
      status: \`retiring-${'${retirementYears}'}\`,
    };
  }

  return null;
}

`,
    "canonical retirement marker states",
  );

  normalized = replaceSourceSection(
    normalized,
    "function appendNameMarker(cell, marker, className) {",
    "function playerRoute(playerId) {",
    `function appendNameMarker(cell, marker, className) {
  if (!marker) {
    return;
  }

  const markerElement = document.createElement("span");
  markerElement.className = \`${'${className}'} retirementMarker--${'${marker.status || "default"}'}\`;
  if (marker.icon) {
    const markerIcon = document.createElement("img");
    markerIcon.src = \`/retirement-${'${marker.icon}'}.svg\`;
    markerIcon.width = 16;
    markerIcon.height = 16;
    markerIcon.alt = "";
    markerIcon.setAttribute("aria-hidden", "true");
    markerElement.appendChild(markerIcon);
  } else {
    markerElement.textContent = marker.emoji;
  }
  markerElement.dataset.tooltip = marker.label;
  markerElement.setAttribute("aria-label", marker.label);
  cell.appendChild(markerElement);
}

`,
    "retirement marker SVG renderer",
  );

  const playerAgeMarkerStart = "  const ageMarkerHtml = ageMarker\n";
  const playerAgeMarkerEnd = "  const agentWalletAddress = getValue(row, \"wallet_address\");";
  normalized = replaceSourceSection(
    normalized,
    playerAgeMarkerStart,
    playerAgeMarkerEnd,
    `  const ageMarkerHtml = ageMarker
    ? \` <span class="retirementMarker playerAgeMarker retirementMarker--${'${escapeHtml(ageMarker.status || "default")}' }" data-tooltip="${'${escapeHtml(ageMarker.label)}'}" aria-label="${'${escapeHtml(ageMarker.label)}'}"><img src="/retirement-${'${escapeHtml(ageMarker.icon)}'}.svg" width="16" height="16" alt="" aria-hidden="true"></span>\`
    : "";
`,
    "Player retirement marker SVG renderer",
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

const source = normalizeRetirementMarkerContract(await readFile(sourcePath, "utf8"));
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

if (!generatedArtifacts.some(([, artifact]) => artifact.includes('icon: "calendar-x-2"'))) {
  throw new Error("Generated application core does not use the calendar-x-2 icon for retired players.");
}
if (!generatedArtifacts.some(([, artifact]) => artifact.includes('icon: "calendar-clock"'))) {
  throw new Error("Generated application core does not use the calendar-clock icon for retiring players.");
}
if (!generatedArtifacts.some(([, artifact]) => artifact.includes("`/retirement-${marker.icon}.svg`"))) {
  throw new Error("Generated application core does not render retirement marker SVG assets.");
}
if (!playerRuntime.includes('ageMarker.icon)}.svg')) {
  throw new Error("Player runtime does not render retirement SVG markers.");
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
  if (artifact.includes("function tableTooltipTarget(event)") || artifact.includes("showPlayerNoteTooltip(tooltip)")) {
    throw new Error(`Delegated table tooltip ownership leaked outside the global Tooltip Height runtime: ${path}.`);
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
