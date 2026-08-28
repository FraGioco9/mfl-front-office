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

const [responsive, sharedTableUi, mobileInteractions, staticUi, dropdowns, appConfig, mobileTablePresentation, evaluationChunk, buildNormalizer, releaseProjection] = await Promise.all([
  read("responsive.css"),
  read("shared-table-ui-runtime.js"),
  read("mobile-table-interactions-runtime.js"),
  read("static-ui-runtime.js"),
  read("dropdowns-runtime.js"),
  read("modules/app-config.js"),
  read("modules/app-core-mobile-table-presentation.js"),
  read("modules/app-core-evaluation-chunk.js"),
  read("modules/app-core-build-normalizer.js"),
  read("sync-release-projections.mjs"),
]);

includes(responsive, "#progressionPage .playerTableScroller,\n  #progressionPage .tableScroller,", "The real player table scroller must own mobile horizontal scrolling directly from responsive CSS.");
includes(responsive, "overflow-x: auto;\n    overflow-y: hidden;\n    overscroll-behavior-x: contain;", "Player tables must pan laterally without waiting for runtime class mutation.");
includes(responsive, "min-width: 760px;", "Mobile player tables must remain wider than tablet viewports when needed.");
includes(responsive, "min-width: 620px;", "Phone player tables must preserve a horizontally pannable width.");
includes(mobileInteractions, 'progressionPage.style.setProperty("--mfl-table-header-height", phone ? "24px" : "26px");', "Hydrated mobile table headers must be shorter than desktop headers.");
includes(mobileInteractions, 'progressionPage.style.setProperty("--mfl-table-row-height", phone ? "22px" : "24px");', "Hydrated mobile player-table rows must be shorter than the previous mobile geometry.");
includes(mobileInteractions, 'progressionPage.style.setProperty("--mfl-table-row-outer-height", phone ? "26px" : "28px");', "Hydrated mobile player-table row spacing must shrink with the content row.");
includes(responsive, "--mfl-table-col-listing: 4%;", "The mobile Listing column must stay narrow.");
includes(responsive, "--mfl-table-col-positions: 9.5%;", "The mobile Positions column must retain additional width.");
includes(responsive, "#progressionPage #tableBody .listingCellTableHost {\n    justify-content: center;\n    width: 100%;", "The Listing bag must be horizontally centered in its column.");
includes(responsive, ".listingCellContent {\n    justify-content: center;\n    width: 18px;\n    min-width: 18px;\n    max-width: 18px;\n    height: 18px;", "The first responsive Listing badge background must be square rather than rectangular.");
includes(mobileInteractions, 'const listingBadgeSize = phone ? 12 : 13;', "Hydrated Listing badges must shrink further while remaining square.");
includes(responsive, "linear-gradient(to right, #000 0, #000 calc(100% - 56px), transparent 100%)", "First paint must show the player-table right-edge fade before hydration.");
includes(sharedTableUi, "const PLAYER_TABLE_FADE_DISTANCE = 56;", "Hydrated player-table fades must retain the stronger first-paint fade distance.");
includes(responsive, "width: 112px;", "Mobile view-button fades must be more prominent.");
includes(responsive, "width: 84px;", "Mobile Quick Filters fades must be more prominent.");
includes(responsive, "opacity: 0.92;", "Mobile horizontal cues must use the stronger visible opacity.");

includes(releaseProjection, 'const MOBILE_TABLE_FIRST_PAINT_LABELS = Object.freeze({', "The zero-request projection must own compact phone table labels before bootstrap runs.");
includes(releaseProjection, 'mobileTableFirstPaintStyle.id = "mflResponsiveTableHeadings";', "The width-aware heading stylesheet must persist beyond initial route resolution.");
includes(releaseProjection, "--mfl-table-header-height: 26px; --mfl-table-row-height: 24px; --mfl-table-row-outer-height: 28px;", "First paint must already use the compact mobile header and row geometry.");
includes(releaseProjection, "--mfl-table-header-height: 24px; --mfl-table-row-height: 22px; --mfl-table-row-outer-height: 26px;", "Phone first paint must already use the smallest header and row geometry.");
includes(releaseProjection, '@media (min-width: 521px) and (max-width: 900px)', "Tablet-width tables must keep full column names while retaining mobile layout.");
includes(releaseProjection, '@media (max-width: 520px)', "Compact column names must be limited to narrow phone widths.");
includes(releaseProjection, 'mobileTableTabletLabelRules', "Tablet heading presentation must have an explicit full-name owner.");
includes(releaseProjection, 'mobileTableCompactLabelRules', "Phone heading presentation must have an explicit compact-name owner.");
includes(releaseProjection, 'Object.keys(MOBILE_TABLE_FIRST_PAINT_LABELS).forEach((column) => {', "Tablet semantic headers must explicitly neutralize compact pseudo labels.");
includes(releaseProjection, '`${selector} { font-size: 10px; }`', "Tablet semantic headers must display their real full text.");
includes(releaseProjection, '`${selector}::after { content: none; display: none; }`', "Tablet semantic headers must not render a second pseudo label.");
includes(releaseProjection, 'MOBILE_TABLE_FIRST_PAINT_LABELS.overall', "The phone first-paint Overall column must render OVR before route runtimes load.");
includes(releaseProjection, 'MOBILE_TABLE_FIRST_PAINT_LABELS.positions', "The phone first-paint Positions column must render POS before route runtimes load.");
includes(releaseProjection, 'data-table-column=\\"listing_price\\"] > span:first-child { font-size: 0; }', "The semantic mobile Listing header must remain blank.");
excludes(releaseProjection, 'const MOBILE_TABLE_FULL_LABELS', "Tablet headings must use canonical real header text rather than a second full-label pseudo map.");
for (const abbreviation of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY", "GK"]) {
  includes(releaseProjection, `"${abbreviation}"`, `The first-paint projection must contain the compact ${abbreviation} heading.`);
}

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
  includes(sharedTableUi, `${column}: "${abbreviation}"`, `Hydrated table headers must retain ${abbreviation} as the compact form for ${column}.`);
}
includes(sharedTableUi, 'const COMPACT_TABLE_HEADING_MEDIA = window.matchMedia("(max-width: 520px)");', "Shared table text must use the same 520px compact-heading breakpoint as generated headers.");
includes(sharedTableUi, 'const compactHeadings = COMPACT_TABLE_HEADING_MEDIA.matches;', "Shared table text must independently distinguish compact headings from general mobile layout.");
includes(sharedTableUi, 'const desired = compactHeadings ? compactStatLabel(fullLabel) : fullLabel;', "Shared table text must keep full stat names above phone width.");
includes(sharedTableUi, 'COMPACT_TABLE_HEADING_MEDIA.addEventListener("change", scheduleMobileTablePresentation);', "Crossing the compact-heading breakpoint must update rendered headings immediately.");
excludes(sharedTableUi, 'const desired = mobile ? compactStatLabel(fullLabel) : fullLabel;', "The old 900px stat-abbreviation owner must not remain active.");
includes(mobileTablePresentation, 'document.querySelectorAll("#progressionPage .viewButton[data-view]")', "Generated mobile headers must synchronize the routed active view before the header can paint.");
includes(mobileTablePresentation, 'button.classList.toggle("active", button.dataset.view === state.view);', "First-paint pseudo headings must follow the actual routed mobile view instead of the static Current Season class.");
includes(mobileTablePresentation, 'const compactTableHeadings = window.matchMedia("(max-width: 520px)").matches;', "Generated table headers must switch to compact names only at phone width.");
includes(mobileTablePresentation, 'label.dataset.mflMobileTableLabel = mobileLabel;', "Generated headers must publish their semantic compact name at construction time.");
includes(mobileTablePresentation, ': compactTableHeadings\n          ? compactLabel\n          : fullLabel;', "Generated tablet headers must preserve full names while narrow phones use compact names.");
includes(mobileInteractions, 'String(label.dataset.mflMobileTableLabel || "").trim()', "Hydrated headers must retain their semantic compact label metadata.");
includes(mobileInteractions, 'const compact = PHONE_TABLE_MEDIA.matches;', "Runtime heading selection must use the same phone-width breakpoint as first paint.");
includes(mobileInteractions, 'const listingHeader = column === "listing_price" || fullLabel.toLowerCase() === "listing";', "Bootstrap and generated Listing headers must share the same mobile blank-header rule.");
includes(mobileInteractions, ': compact\n            ? compactLabel\n            : fullLabel;', "Hydrated tablet headings must use full names and narrow phones must use compact names.");

includes(responsive, ':is(th, td).selectionCell input {\n    width: 12px;', "Mobile selection controls must scale with the table.");
includes(responsive, "background-size: 8px 6px;\n    border-radius: 4px;", "Mobile selection controls must retain the desktop checkbox corner shape.");
includes(responsive, "#tableHead :is(th.selectionCell, th.rowActionsCell)::before,\n  #progressionPage #tableHead :is(th.selectionCell, th.rowActionsCell)::after {\n    content: none;", "Selection/action headers must not emit stray pseudo-element dots.");
includes(releaseProjection, ':is(th.selectionCell, th.rowActionsCell)::before, ${mobileTableSemanticHead} :is(th.selectionCell, th.rowActionsCell)::after { content: none; display: none;', "The head first-paint contract must suppress selection/action pseudo artifacts before runtime.");
includes(mobileInteractions, 'Array.from(header.childNodes).forEach((node) => {', "Mobile selection headers must remove any residual non-checkbox node that could render as a dot.");
includes(mobileInteractions, 'header.replaceChildren();', "The empty mobile action header must remain structurally empty.");
includes(mobileInteractions, 'header.style.lineHeight = "0";', "Mobile selection/action headers must have no text line box that could render a residual dot.");
includes(mobileInteractions, 'header.style.color = "transparent";', "Mobile selection/action headers must neutralize residual currentColor artifacts.");
includes(mobileInteractions, 'const actionSize = phone ? 12 : 14;', "The playerTableActionsButton must scale further on mobile and phone widths.");
includes(mobileInteractions, 'const actionIconSize = phone ? 7 : 8;', "The playerTableActionsButton glyph must scale with its compact button.");
includes(mobileInteractions, 'const markerSize = phone ? 6 : 7;', "Retiring, retired, new-mint, and emoji markers must use explicit compact mobile dimensions.");
includes(mobileInteractions, 'marker.querySelectorAll("img, svg").forEach((icon) => {', "Retirement/new-mint child artwork must be explicitly scaled rather than relying on inherited geometry.");
excludes(mobileInteractions, 'marker.style.zoom = String(', "Retirement markers must not rely on zoom for mobile sizing.");
includes(mobileInteractions, 'const flagSize = phone ? 8 : 9;', "Mobile table flags must continue scaling with the compact row.");
includes(mobileInteractions, 'const noteSize = phone ? 6 : 7;', "Mobile player-note icons must scale down with the rest of table chrome.");
includes(mobileInteractions, 'const listingIconSize = phone ? 5 : 6;', "Mobile Listing icons must scale with the smaller square badge.");
includes(mobileInteractions, 'const raritySize = phone ? 2 : 3;', "Mobile rarity markers must scale with the shorter rows.");
includes(mobileInteractions, 'const sortArrowScale = phone ? 0.55 : 0.65;', "Mobile sort arrows must scale with the compact headers.");
includes(mobileInteractions, 'const syncMobileTable = () => window.__mflMobileTableInteractionsRuntime?.syncNow?.();', "Header and row rendering must apply compact mobile geometry synchronously before paint.");
includes(mobileInteractions, 'window.__mflMobileTableInteractionsRuntime = Object.freeze({ sync, syncNow, destroy });', "The render bridge must expose the synchronous mobile first-paint path.");
includes(mobileInteractions, "syncNow();\n})();", "The mobile table runtime must prime compact geometry before the route core renders rows.");

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
includes(mobileTablePresentation, 'const mobileTable = window.matchMedia("(max-width: 900px)").matches;', "Generated table presentation must explicitly gate mobile-only behavior to mobile widths.");
includes(mobileTablePresentation, 'positions: "POS"', "Generated phone table headers must render Positions as POS.");
for (const abbreviation of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]) {
  includes(mobileTablePresentation, `: "${abbreviation}"`, `Generated mobile table presentation must contain ${abbreviation}.`);
}
includes(mobileTablePresentation, 'column === "listing_price" || (column === agentColumn && state.currentPage === "mfl")', "Listing header blanking must remain mobile-only while the MFL Agent heading stays canonical.");
includes(mobileTablePresentation, "if (!mobileTable) {\n          const listingBadge = listingPriceBadgeHtml(row);", "Desktop Listing cells must preserve their canonical visible-price renderer.");
includes(mobileTablePresentation, 'const priceText = "$" + listingPriceFormatter.format(numericListingPrice);', "Mobile Listing tooltip text must be exactly $ followed by the formatted price.");
includes(mobileTablePresentation, "listingBadge.dataset.tooltip = priceText;", "Mobile Listing tooltip text must be exactly the formatted price.");
includes(mobileTablePresentation, 'listingBadge.setAttribute("aria-label", priceText);', "Mobile Listing accessibility text must match the price-only tooltip.");
excludes(mobileTablePresentation, "For Sale at", "The mobile-only Listing renderer must not introduce explanatory tooltip copy.");
includes(buildNormalizer, "const tablePresentationArtifacts = addMobileTablePresentation(tableArtifacts);", "Canonical core generation must apply mobile table presentation at build time.");
includes(appConfig, '"/mobile-table-interactions-runtime.js"', "Every table route must retain the render-geometry sync bridge.");

for (const source of [responsive, sharedTableUi, mobileInteractions, staticUi, dropdowns, mobileTablePresentation, evaluationChunk, releaseProjection]) {
  excludes(source, "!important", "Mobile table optimization must not introduce priority overrides.");
}
excludes(mobileInteractions, "MutationObserver", "Mobile table presentation must remain render/resize driven rather than mutation-polled.");

console.log("Table headings now have one width-aware owner: narrow phones use compact labels, wider mobile/tablet screens keep the real full header text, and the 900px shared runtime can no longer re-abbreviate them.");
