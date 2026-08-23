import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { normalizeMflStatsHistogramLifecycle } from "./modules/app-core-stats-render-lifecycle.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

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

async function writeFileIfChanged(path, content) {
  let current = null;
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  if (current === content) return false;
  await writeFile(path, content, "utf8");
  return true;
}

const release = JSON.parse(await readFile(releasePath, "utf8"));
const appConfigRuntime = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release)).replace(/\s*$/, "");
if (!appConfigRuntime) throw new Error("Canonical app configuration produced an empty browser runtime.");
const preBootstrapRuntime = `${appConfigRuntime}\nwindow.__mflUniformWidth = Object.freeze({\n  name: "Uniform Width",\n  source: "styles.css",\n  unit: "%",\n});`;

const source = await readFile(sourcePath, "utf8");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const normalized = String(artifacts.core || "").replace(/\s*$/, "");
const evaluationRuntime = String(artifacts.routeChunks?.evaluation || "").replace(/\s*$/, "");
const mflStatsRuntime = normalizeMflStatsHistogramLifecycle(String(artifacts.routeChunks?.mflstats || "").replace(/\s*$/, ""));
const clubRuntime = String(artifacts.routeChunks?.club || "").replace(/\s*$/, "");
const settingsRuntime = String(artifacts.routeChunks?.settings || "").replace(/\s*$/, "");
const playerRuntime = String(artifacts.routeChunks?.player || "").replace(/\s*$/, "");
const tableRuntime = String(artifacts.routeChunks?.table || "").replace(/\s*$/, "");
const walletRuntime = String(artifacts.routeChunks?.wallet || "").replace(/\s*$/, "");
const watchlistRuntime = String(artifacts.routeChunks?.watchlist || "").replace(/\s*$/, "");
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
const writeResults = await Promise.all([
  writeFileIfChanged(tableWidthRuntimePath, `${preBootstrapRuntime}\n`),
  writeFileIfChanged(runtimePath, `${banner}${normalized}\n`),
  writeFileIfChanged(evaluationRuntimePath, `${evaluationBanner}${evaluationRuntime}\n`),
  writeFileIfChanged(mflStatsRuntimePath, `${mflStatsBanner}${mflStatsRuntime}\n`),
  writeFileIfChanged(clubRuntimePath, `${clubBanner}${clubRuntime}\n`),
  writeFileIfChanged(settingsRuntimePath, `${settingsBanner}${settingsRuntime}\n`),
  writeFileIfChanged(playerRuntimePath, `${playerBanner}${playerRuntime}\n`),
  writeFileIfChanged(tableRuntimePath, `${tableBanner}${tableRuntime}\n`),
  writeFileIfChanged(walletRuntimePath, `${walletBanner}${walletRuntime}\n`),
  writeFileIfChanged(watchlistRuntimePath, `${watchlistBanner}${watchlistRuntime}\n`),
]);

if (process.env.MFL_BUILD_VERBOSE === "1") {
  console.log(`${writeResults[0] ? "Generated" : "Unchanged"} ${tableWidthRuntimePath} (${Buffer.byteLength(preBootstrapRuntime, "utf8")} canonical config + Uniform Width bytes).`);
  generatedArtifacts.forEach(([path, artifact, ownership], index) => {
    console.log(`${writeResults[index + 1] ? "Generated" : "Unchanged"} ${path} (${Buffer.byteLength(artifact, "utf8")} ${ownership} bytes).`);
  });
}
