import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(resolve(siteRoot, path), "utf8");

function includes(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

function excludes(source, unexpected, message) {
  if (source.includes(unexpected)) throw new Error(message);
}

const [responsive, sharedTableUi, mobileInteractions, staticUi, dropdowns, appConfig, mobileTablePresentation, buildNormalizer] = await Promise.all([
  read("responsive.css"),
  read("shared-table-ui-runtime.js"),
  read("mobile-table-interactions-runtime.js"),
  read("static-ui-runtime.js"),
  read("dropdowns-runtime.js"),
  read("modules/app-config.js"),
  read("modules/app-core-mobile-table-presentation.js"),
  read("modules/app-core-build-normalizer.js"),
]);

includes(responsive, "#progressionPage .playerTableScroller,\n  #progressionPage .tableScroller,", "The real player table scroller must own mobile horizontal scrolling directly from responsive CSS.");
includes(responsive, "overflow-x: auto;\n    overflow-y: hidden;\n    overscroll-behavior-x: contain;", "Player tables must pan laterally without waiting for runtime class mutation.");
includes(responsive, "min-width: 760px;", "Mobile player tables must remain wider than tablet viewports when needed.");
includes(responsive, "min-width: 620px;", "Phone player tables must preserve a horizontally pannable width.");
includes(responsive, "--mfl-table-col-listing: 4.25%;", "The mobile Listing column must be narrower than its desktop width.");
includes(responsive, "#progressionPage #tableBody .listingCellTableHost {\n    justify-content: center;\n    width: 100%;", "The Listing bag must be horizontally centered in its column.");
includes(responsive, "linear-gradient(to right, #000 0, #000 calc(100% - 56px), transparent 100%)", "First paint must show the player-table right-edge fade before hydration.");
includes(sharedTableUi, "const PLAYER_TABLE_FADE_DISTANCE = 56;", "Hydrated player-table fades must retain the stronger first-paint fade distance.");
includes(responsive, "width: 112px;", "Mobile view-button fades must be more prominent.");
includes(responsive, "width: 84px;", "Mobile Quick Filters fades must be more prominent.");
includes(responsive, "opacity: 0.92;", "Mobile horizontal cues must use the stronger visible opacity.");

for (const [column, abbreviation] of Object.entries({
  overall: "OVR",
  pace: "PAC",
  shooting: "SHO",
  passing: "PAS",
  dribbling: "DRI",
  defense: "DEF",
  physical: "PHY",
  goalkeeping: "GK",
})) {
  includes(sharedTableUi, `${column}: "${abbreviation}"`, `Hydrated mobile table headers must abbreviate ${column} as ${abbreviation}.`);
}
includes(responsive, 'content: "OVR";', "First paint must already show the compact Overall header.");
includes(responsive, 'content: "PAC";', "First paint must already show the compact Pace header.");
includes(responsive, 'content: "PHY";', "First paint must already show the compact Physical header.");
includes(responsive, "#tableHead th.col-listing > span:first-child {\n    font-size: 0;", "First paint must not flash the Listing header label.");

includes(responsive, ':is(th, td).selectionCell input {\n    width: 12px;', "Mobile selection controls must scale with the table.");
includes(responsive, ".playerTableActionsButton {\n    width: 20px;", "Mobile table action controls must be compact.");
includes(responsive, ".playerTableActionsButton svg {\n    width: 14px;", "Mobile table action SVGs must be compact.");
includes(responsive, ':is(.retirementMarker, .newMintMarker) img {\n    width: 12px;', "Mobile table status-marker icons must scale down.");
includes(responsive, ".listingCellIcon {\n    flex: 0 0 10px;", "Mobile Listing icons must scale down.");
includes(responsive, ".tableOverallRarityCircle {\n    flex-basis: 6px;", "Mobile rarity markers must scale down.");

includes(dropdowns, "function touchNativeSelectMode()", "Dropdown ownership must explicitly support native touch selects.");
includes(dropdowns, "if (touchNativeSelectMode() && options.afterChange !== true) return;", "Touch filter selects must not be blurred before iOS opens its native picker.");
includes(dropdowns, 'document.documentElement.classList.add("mflMobileScrolling");', "Touch scrolling must publish a temporary no-hover-animation state.");
includes(responsive, "html.mflMobileScrolling :is(", "Responsive CSS must suppress button transitions while touch scrolling.");
includes(responsive, ".filtersDialog select {\n    touch-action: auto;", "Filter selects must retain native iPhone picker touch behavior.");

includes(staticUi, "const MOBILE_TOOLTIP_MEDIA = window.matchMedia", "Global tooltip ownership must recognize mobile/touch input.");
includes(staticUi, "function onTooltipClick(event)", "Mobile tooltips must use click/tap input.");
includes(staticUi, "if (MOBILE_TOOLTIP_MEDIA.matches) return;", "Hover/focus tooltip handlers must be inert on mobile.");
includes(staticUi, 'document.addEventListener("click", onTooltipClick, true);', "The global tooltip tap owner must be installed once site-wide.");
excludes(mobileInteractions, "mflMobileClickTooltip", "The table runtime must not maintain a competing mobile tooltip portal.");
excludes(mobileInteractions, "document.addEventListener(\"click\"", "The table runtime must not maintain a second tooltip click owner.");
includes(mobileInteractions, "resizeObserver = new ResizeObserver(() => sync());", "Table render geometry must continue scheduling shared presentation updates.");

includes(mobileTablePresentation, 'label.textContent = column === "listing_price" ||', "The generated table header must keep Listing icon-only.");
includes(mobileTablePresentation, "listingBadge.dataset.tooltip = priceText;", "Listing tooltip text must be exactly the formatted price.");
includes(mobileTablePresentation, 'listingBadge.setAttribute("aria-label", priceText);', "Listing accessibility text must match the price-only tooltip.");
excludes(mobileTablePresentation, "For Sale at", "Listing tooltip copy must not include explanatory prefix text.");
excludes(mobileTablePresentation, "listingCellPrice", "Generated table Listing cells must not render visible price text.");
includes(buildNormalizer, "const tablePresentationArtifacts = addMobileTablePresentation(tableArtifacts);", "Canonical core generation must apply Listing presentation at build time.");
includes(appConfig, '"/mobile-table-interactions-runtime.js"', "Every table route must retain the render-geometry sync bridge.");

for (const source of [responsive, sharedTableUi, mobileInteractions, staticUi, dropdowns, mobileTablePresentation]) {
  excludes(source, "!important", "Mobile table optimization must not introduce priority overrides.");
}
excludes(mobileInteractions, "MutationObserver", "Mobile table presentation must remain render/resize driven rather than mutation-polled.");

console.log("Mobile tables now use native iPhone selects, tap tooltips, first-paint fades/labels, direct lateral scrolling, compact icons, and centered price-only Listing presentation.");
