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
const tableWidthRuntimePath = resolve(siteRoot, "table-width-runtime.js");

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

await synchronizeReleaseProjections(siteRoot);

const release = JSON.parse(await readFile(releasePath, "utf8"));
const appConfigRuntime = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release)).replace(/\s*$/, "");
if (!appConfigRuntime) throw new Error("Canonical app configuration produced an empty browser runtime.");

const artifacts = [];
for (const entry of coreSourceManifest) {
  const sourcePath = resolve(siteRoot, "modules", "core-sources", entry.source);
  const runtimePath = resolve(siteRoot, "modules", entry.runtime);
  const source = String(await readFile(sourcePath, "utf8")).replace(/\r\n?/g, "\n").replace(/\s*$/, "");
  if (!source) throw new Error(`Canonical core source is empty: ${entry.source}.`);
  const sourceBytes = Buffer.byteLength(source, "utf8");
  if (sourceBytes > entry.maxSourceBytes) {
    throw new Error(`Canonical ${entry.domain} core source is ${sourceBytes} bytes, above its ${entry.maxSourceBytes}-byte ownership budget. Move new behavior into the owning domain instead of growing the shared/runtime monolith.`);
  }
  artifacts.push(Object.freeze({ ...entry, sourceName: entry.source, sourcePath, runtimePath, source, sourceBytes }));
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
const playerSource = artifacts.find(({ sourceName }) => sourceName === "player.js")?.source || "";
if (!playerSource.includes('ageMarker.icon)}.svg')) {
  throw new Error("Canonical Player core source does not render retirement SVG markers.");
}

for (const { sourcePath, source } of artifacts) {
  if (source.includes("window.eval") || source.includes("eval(")) {
    throw new Error(`String evaluation leaked into canonical application core: ${sourcePath}.`);
  }
  if (source.includes("__mflEvaluationRouteStability") || source.includes("evaluationRouteStabilityStyles")) {
    throw new Error(`Legacy Evaluation route-stability ownership leaked into canonical application core: ${sourcePath}.`);
  }
  if (source.includes("__mflTooltipSettings?.gap") || source.includes("anchorHeight = 14")) {
    throw new Error(`Legacy tooltip spacing ownership leaked into canonical application core: ${sourcePath}.`);
  }
  if (source.includes("function tableTooltipTarget(event)") || source.includes("showPlayerNoteTooltip(tooltip)")) {
    throw new Error(`Delegated table tooltip ownership leaked outside the global Tooltip Height runtime: ${sourcePath}.`);
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
