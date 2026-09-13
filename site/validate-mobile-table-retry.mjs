import { readFile } from "node:fs/promises";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, expected, message) => {
  if (!source.includes(expected)) throw new Error(message);
};
const excludes = (source, unexpected, message) => {
  if (source.includes(unexpected)) throw new Error(message);
};

const [sharedUi, staticUi, discountUi, evaluationSource, tableSource, generatedTable, buildCore, bootstrap] = await Promise.all([
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./evaluation-discount-rate-ui-runtime.js"),
  read("./modules/core-sources/evaluation.js"),
  Promise.resolve(readCanonicalCoreSource("table")),
  read("./modules/app-core-table-runtime.js"),
  read("./build-app-core.mjs"),
  read("./bootstrap.js"),
]);

includes(sharedUi, 'const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");', "Mobile table behavior must be gated from desktop.");
includes(sharedUi, 'const PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");', "Compact phone geometry must use the canonical narrow breakpoint.");
includes(sharedUi, 'const MOBILE_STYLE_ID = "mflInitialMobileTableStyle";', "Hydration must reuse the first-paint mobile style owner.");
excludes(sharedUi, 'document.createElement("style")', "Shared mobile table behavior must not create a second runtime stylesheet.");
includes(sharedUi, "#progressionPage .playerTableScroller {\n    display: block;", "The real player table scroller must directly own mobile scrolling.");
includes(sharedUi, "overflow-x: auto;\n    overflow-y: hidden;", "The real player table scroller must pan horizontally.");
includes(sharedUi, "touch-action: auto;", "The player table must allow native touch panning.");
includes(sharedUi, "min-width: 760px;", "Tablet/mobile tables must retain a compact horizontal scroll range.");
includes(sharedUi, "min-width: 600px;", "Phone tables must remain compact and laterally pannable.");
includes(sharedUi, "min-width: 540px;", "Small phones must retain a compact horizontal scroll range.");
includes(sharedUi, "--mfl-table-header-height: 30px;", "Mobile header height must use the compact contract.");
includes(sharedUi, "--mfl-table-row-height: 26px;", "Mobile row content height must use the compact contract.");
includes(sharedUi, "--mfl-table-header-height: 26px;", "Phone header height must use the compact contract.");
includes(sharedUi, "--mfl-table-row-height: 22px;", "Phone row content height must use the compact contract.");
includes(sharedUi, "--mfl-table-header-height: 24px;", "Tiny-screen header height must use the compact contract.");
includes(sharedUi, "--mfl-table-row-height: 20px;", "Tiny-screen row content height must use the compact contract.");
includes(sharedUi, ".playerTableScroller th {\n    font-size: 10px;", "Mobile headers must stay two pixels smaller than row text.");
includes(sharedUi, ".playerTableScroller th {\n    font-size: 9px;", "Phone headers must stay two pixels smaller than row text.");
includes(sharedUi, ".playerTableScroller th {\n    font-size: 8px;", "Tiny-screen headers must stay two pixels smaller than row text.");
includes(sharedUi, '#tableHead .selectionCell input:disabled {\n    opacity: 0.45;', "Disabled header selection must look inactive during loading.");
includes(sharedUi, 'const PLAYER_TABLE_FADE_LEFT_CLASS = "mflPlayerTableCanScrollLeft";', "Player tables must expose left-scroll fade state.");
includes(sharedUi, 'const PLAYER_TABLE_FADE_RIGHT_CLASS = "mflPlayerTableCanScrollRight";', "Player tables must expose right-scroll fade state.");
includes(sharedUi, "function setPlayerTableFadeDirections(scroller, canScrollLeft, canScrollRight)", "Player-table fades must track each direction independently.");
includes(sharedUi, "function fadeShadow(canScrollLeft, canScrollRight, strength = 56)", "Views and Quick Filters must retain dynamic edge fading.");
excludes(sharedUi, "MutationObserver", "Mobile table presentation must remain render/resize driven.");

includes(tableSource, 'const mobileTable = window.matchMedia("(max-width: 900px)").matches;', "Canonical Table source must explicitly gate mobile-only behavior.");
includes(tableSource, 'selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;', "Rebuilt headers must stay non-selectable until loaded selection state exists.");
includes(tableSource, 'positions: "POS"', "Small-screen Positions headings must use POS.");
excludes(tableSource, '? "POSITIONS"', "Small-screen headers must not restore long POSITIONS text.");
for (const label of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY", "GK"]) {
  includes(tableSource, `: "${label}"`, `Canonical compact headings must include ${label}.`);
}
includes(tableSource, "function compactMobilePlayerName(value)", "Canonical Table source must own N. Surname formatting.");
includes(tableSource, 'nameLink.setAttribute("aria-label", fullPlayerName);', "Compact names must retain the full accessible name.");
includes(tableSource, 'column === "listing_price" || (column === agentColumn && state.currentPage === "mfl")', "Listing header blanking must remain inside mobile behavior.");
includes(tableSource, 'const priceText = String(price?.textContent || "").trim();', "Mobile Listing tooltip must reuse the formatted price.");
includes(tableSource, "price?.remove();", "Mobile Listing price must not remain visible in the cell.");
includes(tableSource, "badge.dataset.tooltip = priceText;", "Mobile Listing price must move to the tooltip.");
excludes(tableSource, "For Sale at", "Mobile Listing tooltips must contain only the formatted price.");

includes(staticUi, 'const MOBILE_TOOLTIP_MEDIA = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");', "Global tooltip ownership must recognize mobile input.");
includes(staticUi, "function onTooltipClick(event)", "Mobile tooltips must be click/tap driven.");
includes(staticUi, "if (MOBILE_TOOLTIP_MEDIA.matches) return;", "Hover/focus tooltip paths must be inert on mobile.");
includes(discountUi, "if (MOBILE_TOOLTIP_MEDIA.matches || !(metric instanceof HTMLElement)", "Discount-rate hover tooltip must be disabled on mobile.");
includes(evaluationSource, 'window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches', "Evaluation hover-only actions must remain disabled on mobile.");

includes(bootstrap, 'positions: "POS"', "Bootstrap must render POS before first paint on small screens.");
excludes(bootstrap, 'if (column === "positions") return "POSITIONS";', "Bootstrap must not restore long POSITIONS text.");
includes(bootstrap, "function firstPaintTableColumnLabel(page, column)", "Bootstrap must derive first-paint labels from viewport and column identity.");

excludes(buildCore, "app-core-mobile-table", "The canonical build must not depend on the retired mobile-table transform.");
if (coreSourceByDomain.table?.source !== "table.js"
  || coreSourceByDomain.table?.sources?.length !== 3
  || coreSourceByDomain.table.sources[0] !== "table.js"
  || coreSourceByDomain.table.sources[1] !== "table-render-lifecycle.js"
  || coreSourceByDomain.table.sources[2] !== "table-interaction-bindings.js"
  || coreSourceByDomain.table?.runtime !== "app-core-table-runtime.js") {
  throw new Error("The core manifest must emit Table runtime from its ordered canonical fragments.");
}

const tableBanner = "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n";
if (!generatedTable.startsWith(tableBanner)) throw new Error("Generated Table runtime is missing its canonical banner.");
if (generatedTable.slice(tableBanner.length).replace(/\s*$/, "") !== tableSource.replace(/\s*$/, "")) {
  throw new Error("Generated Table runtime must exactly match the manifest-assembled canonical Table source.");
}

console.log("Source-owned mobile Table scrolling, responsive geometry, compact headings, tooltip behavior, first-paint parity, and generated-runtime equivalence validation passed.");
