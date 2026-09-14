import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { coreSourceManifest } from "./modules/core-source-manifest.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";
import { synchronizeReleaseProjections } from "./sync-release-projections.mjs";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const releasePath = resolve(siteRoot, "release.json");
const indexPath = resolve(siteRoot, "index.html");
const tableWidthRuntimePath = resolve(siteRoot, "table-width-runtime.js");
const playerHtmlSourcePath = resolve(siteRoot, "html-sources", "player.html");

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

function normalizePlayerFirstPaintShell(source, canonicalPlayerShell) {
  const hiddenEntityGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage,
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage {
        display: none;
      }`;
  const previousLayoutAwareEntityGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage {
        visibility: hidden;
        pointer-events: none;
      }`;
  const cueGatedLayoutAwareEntityGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage,
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-player-first-paint-cues-ready="true"]) #playerPage {
        visibility: hidden;
        pointer-events: none;
      }`;
  const finalVisibilityGatedEntityGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-player-first-paint-content-ready="true"]) #playerPage,
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-player-first-paint-cues-ready="true"]) #playerPage {
        visibility: hidden;
        pointer-events: none;
      }`;
  const layoutAwareEntityGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"] #playerPage {
        pointer-events: none;
      }`;
  const emptyPlayerShell = `        <section id="playerPage" class="pageView playerPage" hidden>
          <div id="playerDetail" class="playerDetail"></div>
        </section>`;
  const staticPlayerShell = String(canonicalPlayerShell || "")
  .replace(/\r\n?/g, "\n")
  .replace(/\s*$/, "");
if (!staticPlayerShell.includes('data-mfl-static-player-shell="true"')
    || !staticPlayerShell.includes('data-mfl-static-player-age')
    || !staticPlayerShell.includes('root.dataset.playerFirstPaintContentReady = "false";')
    || !staticPlayerShell.includes('root.dataset.playerFirstPaintCuesReady = "false";')) {
  throw new Error("Canonical Player first-paint HTML fragment is incomplete.");
}

  let normalized = String(source || "");
  if (normalized.includes(hiddenEntityGuard)) {
    normalized = normalized.replace(hiddenEntityGuard, layoutAwareEntityGuard);
  } else if (normalized.includes(previousLayoutAwareEntityGuard)) {
    normalized = normalized.replace(previousLayoutAwareEntityGuard, layoutAwareEntityGuard);
  } else if (normalized.includes(cueGatedLayoutAwareEntityGuard)) {
    normalized = normalized.replace(cueGatedLayoutAwareEntityGuard, layoutAwareEntityGuard);
  } else if (normalized.includes(finalVisibilityGatedEntityGuard)) {
    normalized = normalized.replace(finalVisibilityGatedEntityGuard, layoutAwareEntityGuard);
  } else if (!normalized.includes(layoutAwareEntityGuard)) {
    throw new Error("Player first-paint route guard owner is missing.");
  }

  if (normalized.includes(staticPlayerShell)) return normalized;
if (normalized.includes('data-mfl-static-player-shell="true"')) {
  const shellStart = normalized.indexOf('        <section id="playerPage" class="pageView playerPage" hidden>');
  const scriptStart = normalized.indexOf('        <script>', shellStart);
  const scriptEndMarker = '        </script>';
  const scriptEndStart = scriptStart >= 0 ? normalized.indexOf(scriptEndMarker, scriptStart) : -1;
  if (shellStart < 0 || scriptStart < 0 || scriptEndStart < 0) {
    throw new Error("Existing Player first-paint shell cannot be migrated from the canonical fragment boundary.");
  }
  const scriptEnd = scriptEndStart + scriptEndMarker.length;
  normalized = normalized.slice(0, shellStart) + staticPlayerShell + normalized.slice(scriptEnd);
  if (!normalized.includes(staticPlayerShell)) {
    throw new Error("Player first-paint static shell migration did not produce the canonical projection.");
  }
  return normalized;
}

  const shellMatches = normalized.split(emptyPlayerShell).length - 1;
  if (shellMatches !== 1) {
    throw new Error(`Player first-paint static shell expected exactly one owned projection, found ${shellMatches}.`);
  }
  return normalized.replace(emptyPlayerShell, staticPlayerShell);
}

async function readCanonicalCoreSource(entry) {
  const sourceNames = Array.isArray(entry.sources) ? entry.sources : [];
  if (!sourceNames.length) {
    throw new Error(`Canonical ${entry.domain} core must define at least one source fragment.`);
  }

  const sourcePaths = sourceNames.map((sourceName) => resolve(siteRoot, "modules", "core-sources", sourceName));
  const sourceParts = await Promise.all(sourcePaths.map(async (sourcePath, index) => {
    const sourcePart = String(await readFile(sourcePath, "utf8")).replace(/\r\n?/g, "\n").replace(/\s*$/, "");
    if (!sourcePart) throw new Error(`Canonical core source is empty: ${sourceNames[index]}.`);
    return sourcePart;
  }));

  return {
    sourceNames,
    sourcePaths,
    source: sourceParts.join("\n\n"),
  };
}

await synchronizeReleaseProjections(siteRoot);
const playerHtmlSource = String(await readFile(playerHtmlSourcePath, "utf8"))
  .replace(/\r\n?/g, "\n")
  .replace(/\s*$/, "");
const indexSource = String(await readFile(indexPath, "utf8")).replace(/\r\n?/g, "\n");
await writeFileIfChanged(indexPath, normalizePlayerFirstPaintShell(indexSource, playerHtmlSource));

const release = JSON.parse(await readFile(releasePath, "utf8"));
const appConfigRuntime = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release)).replace(/\s*$/, "");
if (!appConfigRuntime) throw new Error("Canonical app configuration produced an empty browser runtime.");

const artifacts = [];
for (const entry of coreSourceManifest) {
  const { sourceNames, sourcePaths, source } = await readCanonicalCoreSource(entry);
  const runtimePath = resolve(siteRoot, "modules", entry.runtime);
  const sourceBytes = Buffer.byteLength(source, "utf8");
  if (entry.maxUniversalBytes !== null) {
    if (!Number.isInteger(entry.maxUniversalBytes) || entry.maxUniversalBytes <= 0) {
      throw new Error(`Canonical ${entry.domain} core has an invalid universal ownership ceiling.`);
    }
    if (sourceBytes > entry.maxUniversalBytes) {
      throw new Error(`Canonical ${entry.domain} core source is ${sourceBytes} bytes, above its ${entry.maxUniversalBytes}-byte universal ownership ceiling. Move route/domain behavior out of the universal core instead of growing shared runtime cost.`);
    }
  }
  artifacts.push(Object.freeze({ ...entry, sourceNames, sourcePaths, runtimePath, source, sourceBytes }));
}

const coreBuildId = createHash("sha256")
  .update(artifacts.map(({ banner, source }) => `${banner}${source}\n`).join("\n"))
  .digest("hex")
  .slice(0, 16);
const preBootstrapRuntime = `${appConfigRuntime}\nwindow.__mflUniformWidth = Object.freeze({\n  name: "Uniform Width",\n  source: "styles.css",\n  unit: "%",\n});\nwindow.__mflCoreBuildId = "${coreBuildId}";`;

if (!artifacts.some(({ source }) => source.includes('icon: "calendar-x-2"'))) {
  throw new Error("Canonical core sources do not use the calendar-x-2 icon for retired players.");
}
if (!artifacts.some(({ source }) => source.includes('icon: "calendar-clock"'))) {
  throw new Error("Canonical core sources do not use the calendar-clock icon for retiring players.");
}
if (!artifacts.some(({ source }) => source.includes("`/retirement-${marker.icon}.svg`"))) {
  throw new Error("Canonical core sources do not render retirement marker SVG assets.");
}
const playerSource = artifacts.find(({ domain }) => domain === "player")?.source || "";
if (!playerSource.includes('ageMarker.icon)}.svg')) {
  throw new Error("Canonical Player core source does not render retirement SVG markers.");
}

for (const { sourcePaths, source } of artifacts) {
  const sourceDescription = sourcePaths.join(", ");
  if (source.includes("window.eval") || source.includes("eval(")) {
    throw new Error(`String evaluation leaked into canonical application core: ${sourceDescription}.`);
  }
  if (source.includes("__mflEvaluationRouteStability") || source.includes("evaluationRouteStabilityStyles")) {
    throw new Error(`Legacy Evaluation route-stability ownership leaked into canonical application core: ${sourceDescription}.`);
  }
  if (source.includes("__mflTooltipSettings?.gap") || source.includes("anchorHeight = 14")) {
    throw new Error(`Legacy tooltip spacing ownership leaked into canonical application core: ${sourceDescription}.`);
  }
  if (source.includes("function tableTooltipTarget(event)") || source.includes("showPlayerNoteTooltip(tooltip)")) {
    throw new Error(`Delegated table tooltip ownership leaked outside the global Tooltip Height runtime: ${sourceDescription}.`);
  }
}
if (!artifacts.some(({ source }) => source.includes("iconRect.top - tooltipRect.height - tooltipHeight"))) {
  throw new Error("Canonical application core does not position manual tooltips from the real generator rectangle.");
}

const tableWidthChanged = await writeFileIfChanged(tableWidthRuntimePath, `${preBootstrapRuntime}\n`);
const runtimeChanges = await Promise.all(artifacts.map(({ runtimePath, banner, source }) => (
  writeFileIfChanged(runtimePath, `${banner}${source}\n`)
)));

if (process.env.MFL_BUILD_VERBOSE === "1") {
  console.log(`${tableWidthChanged ? "Generated" : "Unchanged"} ${tableWidthRuntimePath} (canonical config + Uniform Width).`);
  console.log(`Application core build ID: ${coreBuildId}.`);
  artifacts.forEach(({ runtimePath, sourceBytes }, index) => {
    console.log(`${runtimeChanges[index] ? "Generated" : "Unchanged"} ${runtimePath} (${sourceBytes} source-owned bytes).`);
  });
}
