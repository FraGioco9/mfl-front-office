import { readFile } from "node:fs/promises";

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
  read("./modules/core-sources/table.js"),
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
includes(sharedUi, "min-width: 820px;", "Tablet/mobile tables must retain a real horizontal scroll range.");
includes(sharedUi, "min-width: 680px;", "Phone tables must remain laterally pannable.");
includes(sharedUi, "min-width: 600px;", "Small phones must retain a real horizontal scroll range.");
includes(sharedUi, "--mfl-table-header-height: 32px;", "Mobile header height must stay canonical.");
includes(sharedUi, "--mfl-table-row-height: 28px;", "Mobile row content height must stay canonical.");
includes(sharedUi, "--mfl-table-header-height: 28px;", "Phone header height must stay canonical.");
includes(sharedUi, "--mfl-table-row-height: 24px;", "Phone row content height must stay canonical.");
includes(sharedUi, "--mfl-table-header-height: 26px;", "Tiny-screen header height must stay canonical.");
includes(sharedUi, "--mfl-table-row-height: 22px;", "Tiny-screen row content height must stay canonical.");
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
includes(tableSource, 'const compactTableHeadings = window.matchMedia("(max-width: 520px)").matches;', "Canonical Table headings must switch only at the narrow breakpoint.");
includes(tableSource, 'selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;', "Rebuilt headers must stay non-selectable until loaded selection state exists.");
excludes(tableSource, 'positions: "POS"', "Positions must not participate in compact width-dependent abbreviation.");
includes(tableSource, 'column === "positions"\n          ? "POSITIONS"', "Mobile tables must call the Positions column POSITIONS.");
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

includes(bootstrap, 'const FIRST_PAINT_PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");', "Bootstrap must know the compact heading breakpoint before first paint.");
excludes(bootstrap, 'positions: "POS"', "Bootstrap must not abbreviate Positions based on viewport width.");
includes(bootstrap, 'if (column === "positions") return "POSITIONS";', "Positions must already read POSITIONS before first paint.");
includes(bootstrap, "function firstPaintTableColumnLabel(page, column)", "Bootstrap must derive first-paint labels from viewport and column identity.");

excludes(buildCore, "app-core-mobile-table", "The canonical build must not depend on the retired mobile-table transform.");
includes(buildCore, 'Object.freeze({ source: "table.js", runtime: "app-core-table-runtime.js"', "The canonical build must emit Table runtime directly from table.js.");

const tableBanner = "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n";
if (!generatedTable.startsWith(tableBanner)) throw new Error("Generated Table runtime is missing its canonical banner.");
if (generatedTable.slice(tableBanner.length).replace(/\s*$/, "") !== tableSource.replace(/\s*$/, "")) {
  throw new Error("Generated Table runtime must exactly match canonical table.js.");
}

console.log("Source-owned mobile Table scrolling, responsive geometry, compact headings, tooltip behavior, first-paint parity, and generated-runtime equivalence validation passed.");
