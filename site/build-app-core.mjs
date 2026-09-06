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

function normalizePlayerFirstPaintShell(source) {
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
  const layoutAwareEntityGuard = `      html:not(.mflInitialRouteResolved)[data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage {
        display: none;
      }
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage,
      html:not(.mflInitialRouteResolved)[data-initial-entity-route="player"]:not([data-player-first-paint-cues-ready="true"]) #playerPage {
        visibility: hidden;
        pointer-events: none;
      }`;
  const emptyPlayerShell = `        <section id="playerPage" class="pageView playerPage" hidden>
          <div id="playerDetail" class="playerDetail"></div>
        </section>`;
  const staticPlayerShell = `        <section id="playerPage" class="pageView playerPage" hidden>
          <div id="playerDetail" class="playerDetail" data-mfl-static-player-shell="true">
            <section class="playerHero playerHeroPending" aria-hidden="true">
              <div class="playerHeroMedia">
                <div class="playerHeroOverall isPending"><strong>&nbsp;</strong></div>
                <div class="playerHeroPortraitFrame"><canvas class="playerHeroPortrait" aria-hidden="true"></canvas></div>
              </div>
              <div class="playerHeroIdentity">
                <button class="playerEyebrow playerIdText" style="visibility:hidden" type="button" disabled>ID #000000</button>
                <h2 class="tablePageTitle playerTitle"><span class="playerTitleName">&nbsp;</span></h2>
                <p>&nbsp;</p>
              </div>
              <div class="playerHeroActions" style="visibility:hidden">
                <div class="playerHeroActionMenu">
                  <a class="playerExternalButton playerHeroPrimaryAction" tabindex="-1" aria-hidden="true">Open link</a>
                  <button class="playerHeroActionMenuButton" type="button" disabled aria-hidden="true"><svg class="playerHeroChevronIcon" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"></path></svg></button>
                  <div class="playerHeroActionMenuDropdown" hidden></div>
                </div>
              </div>
            </section>
            <section class="playerGrid" aria-hidden="true">
              <div class="playerStack">
                <div class="playerPanel playerInfoPanel">
                  <h3>Profile</h3>
                  <div class="detailGrid">
                    <div><span>Nationality</span><strong>-</strong></div>
                    <div><span>Age</span><strong>-</strong></div>
                    <div><span>Height</span><strong>-</strong></div>
                    <div><span>Foot</span><strong>-</strong></div>
                    <div><span>Seasons</span><strong>-</strong></div>
                    <div><span>Agent</span><strong>-</strong></div>
                    <div class="contractDetailCard playerInfoFullWidthCard"><span>Contract</span><strong>-</strong></div>
                    <div class="revShareDetailCard playerInfoFullWidthCard"><span>Rev Share</span><strong>-</strong></div>
                  </div>
                </div>
                <div class="playerPanel attributesPanel">
                  <div class="playerPanelHeader">
                    <h3>Attributes</h3>
                    <div class="playerAttributeViews" style="visibility:hidden">
                      <button class="playerAttributeViewButton active" type="button" disabled>Attributes</button>
                      <button class="playerAttributeViewButton" type="button" disabled>Training</button>
                      <button class="playerAttributeViewButton" type="button" disabled>Next Overall</button>
                      <button class="playerAttributeViewButton" type="button" disabled>Current Season</button>
                      <button class="playerAttributeViewButton" type="button" disabled>All Time</button>
                    </div>
                  </div>
                  <div class="attributeGrid">
                    <div class="playerAttributeCard featured fullWidth"><span>&nbsp;</span><strong>-</strong></div>
                    <div class="playerAttributeCard"><span>&nbsp;</span><strong>-</strong></div>
                    <div class="playerAttributeCard"><span>&nbsp;</span><strong>-</strong></div>
                    <div class="playerAttributeCard"><span>&nbsp;</span><strong>-</strong></div>
                    <div class="playerAttributeCard"><span>&nbsp;</span><strong>-</strong></div>
                    <div class="playerAttributeCard"><span>&nbsp;</span><strong>-</strong></div>
                    <div class="playerAttributeCard"><span>&nbsp;</span><strong>-</strong></div>
                  </div>
                </div>
                <div class="playerPanel playerNotesPanel" data-mfl-static-player-notes="true">
                  <h3>Notes</h3>
                  <div class="playerNotesInputWrap">
                    <textarea class="playerNotesInput" style="visibility:hidden" aria-hidden="true" disabled></textarea>
                    <span class="playerNotesCount" style="visibility:hidden">0/100</span>
                  </div>
                </div>
              </div>
              <div class="playerPanel pitchPanel"><h3>Positions</h3><div class="pitch"></div></div>
            </section>
          </div>
        </section>
        <script>
          (() => {
            if (document.documentElement.dataset.initialEntityRoute !== "player") return;
            const playerPage = document.getElementById("playerPage");
            const notesPanel = document.querySelector("#playerPage [data-mfl-static-player-notes]");
            if (playerPage instanceof HTMLElement) playerPage.hidden = false;
            if (notesPanel instanceof HTMLElement) notesPanel.hidden = document.documentElement.dataset.storedWalletOptIn !== "true";
          })();
        </script>`;

  let normalized = String(source || "");
  if (normalized.includes(hiddenEntityGuard)) {
    normalized = normalized.replace(hiddenEntityGuard, layoutAwareEntityGuard);
  } else if (normalized.includes(previousLayoutAwareEntityGuard)) {
    normalized = normalized.replace(previousLayoutAwareEntityGuard, layoutAwareEntityGuard);
  } else if (!normalized.includes(layoutAwareEntityGuard)) {
    throw new Error("Player first-paint route guard owner is missing.");
  }

  if (normalized.includes(staticPlayerShell)) return normalized;
  const shellMatches = normalized.split(emptyPlayerShell).length - 1;
  if (shellMatches !== 1) {
    throw new Error(`Player first-paint static shell expected exactly one owned projection, found ${shellMatches}.`);
  }
  return normalized.replace(emptyPlayerShell, staticPlayerShell);
}

await synchronizeReleaseProjections(siteRoot);
const indexSource = String(await readFile(indexPath, "utf8")).replace(/\r\n?/g, "\n");
await writeFileIfChanged(indexPath, normalizePlayerFirstPaintShell(indexSource));

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
