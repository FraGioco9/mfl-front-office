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

const [responsive, sharedTableUi, mobileInteractions, staticUi, dropdowns, appConfig, mobileTablePresentation, evaluationChunk, buildNormalizer] = await Promise.all([
  read("responsive.css"),
  read("shared-table-ui-runtime.js"),
  read("mobile-table-interactions-runtime.js"),
  read("static-ui-runtime.js"),
  read("dropdowns-runtime.js"),
  read("modules/app-config.js"),
  read("modules/app-core-mobile-table-presentation.js"),
  read("modules/app-core-evaluation-chunk.js"),
  read("modules/app-core-build-normalizer.js"),
]);

includes(responsive, "#progressionPage .playerTableScroller,\n  #progressionPage .tableScroller,", "The real player table scroller must own mobile horizontal scrolling directly from responsive CSS.");
includes(responsive, "overflow-x: auto;\n    overflow-y: hidden;\n    overscroll-behavior-x: contain;", "Player tables must pan laterally without waiting for runtime class mutation.");
includes(responsive, "min-width: 760px;", "Mobile player tables must remain wider than tablet viewports when needed.");
includes(responsive, "min-width: 620px;", "Phone player tables must preserve a horizontally pannable width.");
includes(mobileInteractions, 'progressionPage.style.setProperty("--mfl-table-row-height", phone ? "25px" : "27px");', "Hydrated mobile player-table rows must become shorter than the previous mobile geometry.");
includes(mobileInteractions, 'progressionPage.style.setProperty("--mfl-table-row-outer-height", phone ? "30px" : "32px");', "Hydrated mobile player-table row spacing must shrink with the content row.");
includes(responsive, "--mfl-table-col-listing: 4%;", "The mobile Listing column must stay narrow.");
includes(responsive, "--mfl-table-col-positions: 9.5%;", "The mobile Positions column must retain additional width.");
includes(responsive, "#progressionPage #tableBody .listingCellTableHost {\n    justify-content: center;\n    width: 100%;", "The Listing bag must be horizontally centered in its column.");
includes(responsive, ".listingCellContent {\n    justify-content: center;\n    width: 18px;\n    min-width: 18px;\n    max-width: 18px;\n    height: 18px;", "The first responsive Listing badge background must be square rather than rectangular.");
includes(mobileInteractions, 'const listingBadgeSize = phone ? 14 : 16;', "Hydrated Listing badges must shrink further while remaining square.");
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
includes(responsive, '#tableHead th:nth-child(6) > span:first-child::after {\n    content: "POS";', "Mobile first paint must label Positions as POS through its pre-hydration pseudo-element.");
for (const abbreviation of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]) {
  includes(responsive, `content: "${abbreviation}";`, `First paint must already show the compact ${abbreviation} stat heading.`);
}
includes(responsive, "#progressionPage:has(.viewButton[data-view=\"attributes\"].active)", "Compact first-paint stat headings must follow the actual active table view.");
includes(responsive, "#progressionPage #tableHead th.col-listing > span:first-child {\n    font-size: 0;", "Mobile first paint must keep the Listing header blank.");
includes(mobileInteractions, 'column === "listing_price" ? "" : MOBILE_HEADER_LABELS[column] || fullLabel', "Hydrated mobile Listing headers must remain blank while other columns use their compact labels.");

includes(responsive, ':is(th, td).selectionCell input {\n    width: 12px;', "Mobile selection controls must scale with the table.");
includes(responsive, "background-size: 8px 6px;\n    border-radius: 4px;", "Mobile selection controls must retain the desktop checkbox corner shape.");
includes(responsive, "#tableHead :is(th.selectionCell, th.rowActionsCell)::before,\n  #progressionPage #tableHead :is(th.selectionCell, th.rowActionsCell)::after {\n    content: none;", "Selection/action headers must not emit stray pseudo-element dots.");
includes(mobileInteractions, 'header.style.color = "transparent";', "Mobile selection/action headers must neutralize residual currentColor artifacts.");
includes(mobileInteractions, 'const actionSize = phone ? 16 : 18;', "The playerTableActionsButton must scale further on mobile and phone widths.");
includes(mobileInteractions, 'const actionIconSize = phone ? 10 : 12;', "The playerTableActionsButton glyph must scale with its compact button.");
includes(mobileInteractions, 'const markerScale = phone ? 0.5 : 0.625;', "The full retiring/retired and new-mint marker must scale, including pseudo-element artwork.");
includes(mobileInteractions, 'marker.style.zoom = String(markerScale);', "Retirement/new-mint marker scaling must affect pseudo-elements as well as child images/SVGs.");
includes(mobileInteractions, 'const flagSize = phone ? 10 : 12;', "Mobile table flags must continue scaling with the compact row.");
includes(mobileInteractions, 'const noteSize = phone ? 8 : 9;', "Mobile player-note icons must scale down with the rest of table chrome.");
includes(mobileInteractions, 'const listingIconSize = phone ? 7 : 8;', "Mobile Listing icons must scale with the smaller square badge.");
includes(mobileInteractions, 'const raritySize = phone ? 4 : 5;', "Mobile rarity markers must scale with the shorter rows.");

includes(dropdowns, "function touchNativeSelectMode()", "Dropdown ownership must explicitly support native touch selects.");
includes(dropdowns, "const committedFilterSelects = new WeakSet();", "Touch filter selects must distinguish committed native picker changes from pointer-up/click events.");
includes(dropdowns, "if (touchNativeSelectMode() && !committedOnTouch) return;", "Touch filter selects must not be blurred before iOS opens its native picker.");
includes(dropdowns, "if (touchNativeSelectMode() && select instanceof HTMLSelectElement) committedFilterSelects.add(select);", "Touch filter selects must become blur-eligible only after native selection commits.");
includes(dropdowns, 'document.documentElement.classList.add("mflMobileScrolling");', "Touch scrolling must publish a temporary no-hover-animation state.");
includes(responsive, "html.mflMobileScrolling :is(", "Responsive CSS must suppress button transitions while touch scrolling.");
includes(responsive, ".filtersDialog select {\n    touch-action: auto;", "Filter selects must retain native iPhone picker touch behavior.");

includes(staticUi, "const MOBILE_TOOLTIP_MEDIA = window.matchMedia", "Global tooltip ownership must recognize mobile/touch input.");
includes(staticUi, "function onTooltipClick(event)", "Mobile tooltips must use click/tap input.");
includes(staticUi, "if (MOBILE_TOOLTIP_MEDIA.matches) return;", "Hover/focus tooltip handlers must be inert on mobile.");
includes(staticUi, "if (!MOBILE_TOOLTIP_MEDIA.matches && tooltipTarget.matches(SPECIALIZED_TOOLTIP_SELECTOR)) return null;", "Specialized desktop tooltip targets must fall through to the global tap owner on mobile.");
includes(staticUi, 'document.addEventListener("click", onTooltipClick, true);', "The global tooltip tap owner must be installed once site-wide.");
includes(evaluationChunk, 'window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches', "Evaluation saved-action hover/focus tooltips must be disabled on mobile so taps have one owner.");
includes(evaluationChunk, 'button.addEventListener("mouseenter", showTooltip);', "Evaluation saved-action desktop hover must remain supported through the guarded handler.");
includes(evaluationChunk, 'button.addEventListener("focus", showTooltip);', "Evaluation saved-action desktop focus must remain supported through the guarded handler.");
excludes(mobileInteractions, "mflMobileClickTooltip", "The table runtime must not maintain a competing mobile tooltip portal.");
excludes(mobileInteractions, "document.addEventListener(\"click\"", "The table runtime must not maintain a second tooltip click owner.");
includes(mobileInteractions, "resizeObserver = new ResizeObserver(() => sync());", "Table render geometry must continue scheduling shared presentation updates.");

excludes(mobileTablePresentation, "header.dataset.tableColumn", "Generated table headers must never reference an undefined header variable during refresh.");
includes(mobileTablePresentation, 'cell.dataset.tableColumn = column;', "Generated table headers must assign semantic identity to the actual header cell.");
includes(mobileTablePresentation, 'label.dataset.mflFullTableLabel = fullLabel;', "Generated headers must retain their desktop label for breakpoint restoration.");
includes(mobileTablePresentation, 'const mobileTable = window.matchMedia("(max-width: 900px)").matches;', "Generated table presentation must explicitly gate compact behavior to mobile.");
includes(mobileTablePresentation, 'positions: "POS"', "Generated mobile table headers must render Positions as POS.");
for (const abbreviation of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]) {
  includes(mobileTablePresentation, `: "${abbreviation}"`, `Generated mobile table presentation must contain ${abbreviation}.`);
}
includes(mobileTablePresentation, 'mobileTable && column === "listing_price"', "Listing header blanking must be mobile-only.");
includes(mobileTablePresentation, "if (!mobileTable) {\n          const listingBadge = listingPriceBadgeHtml(row);", "Desktop Listing cells must preserve their canonical visible-price renderer.");
includes(mobileTablePresentation, 'const priceText = "$" + listingPriceFormatter.format(numericListingPrice);', "Mobile Listing tooltip text must be exactly $ followed by the formatted price.");
includes(mobileTablePresentation, "listingBadge.dataset.tooltip = priceText;", "Mobile Listing tooltip text must be exactly the formatted price.");
includes(mobileTablePresentation, 'listingBadge.setAttribute("aria-label", priceText);', "Mobile Listing accessibility text must match the price-only tooltip.");
excludes(mobileTablePresentation, "For Sale at", "The mobile-only Listing renderer must not introduce explanatory tooltip copy.");
includes(buildNormalizer, "const tablePresentationArtifacts = addMobileTablePresentation(tableArtifacts);", "Canonical core generation must apply mobile table presentation at build time.");
includes(appConfig, '"/mobile-table-interactions-runtime.js"', "Every table route must retain the render-geometry sync bridge.");

for (const source of [responsive, sharedTableUi, mobileInteractions, staticUi, dropdowns, mobileTablePresentation, evaluationChunk]) {
  excludes(source, "!important", "Mobile table optimization must not introduce priority overrides.");
}
excludes(mobileInteractions, "MutationObserver", "Mobile table presentation must remain render/resize driven rather than mutation-polled.");

console.log("Mobile tables now keep compact first-paint headings, shorter rows, smaller full marker/action geometry, blank mobile Listing headers, price-only mobile Listing tooltips, and unchanged desktop Listing presentation.");
