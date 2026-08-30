import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, expected, message) => {
  if (!source.includes(expected)) throw new Error(message);
};
const excludes = (source, unexpected, message) => {
  if (source.includes(unexpected)) throw new Error(message);
};

const [sharedUi, staticUi, discountUi, evaluationChunk, mobileTable, buildNormalizer, releaseProjection, bootstrap] = await Promise.all([
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./evaluation-discount-rate-ui-runtime.js"),
  read("./modules/app-core-evaluation-chunk.js"),
  read("./modules/app-core-mobile-table.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./sync-release-projections.mjs"),
  read("./bootstrap.js"),
]);

includes(sharedUi, 'const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");', "Mobile table behavior must be gated from desktop.");
includes(sharedUi, 'const PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");', "Compact phone geometry must use a dedicated narrow breakpoint.");
includes(sharedUi, 'const MOBILE_STYLE_ID = "mflInitialMobileTableStyle";', "Hydration must reuse the zero-request mobile presentation style owner.");
excludes(sharedUi, 'document.createElement("style")', "Shared mobile table behavior must not create a second runtime stylesheet.");
includes(sharedUi, "document.head.appendChild(style);", "The single mobile style owner must move after responsive.css during hydration.");
includes(sharedUi, "#progressionPage .playerTableScroller {\n    display: block;", "The real player table scroller must directly own mobile scrolling.");
includes(sharedUi, "overflow-x: auto;\n    overflow-y: hidden;", "The real player table scroller must pan horizontally.");
includes(sharedUi, "touch-action: auto;", "The player table must allow native touch panning on iOS.");
includes(sharedUi, "-webkit-mask-image: none;\n    mask-image: none;", "The hydrated iOS scroll layer must explicitly neutralize the legacy table mask.");
includes(sharedUi, "min-width: 820px;", "Tablet/mobile tables must remain wider than the viewport when needed.");
includes(sharedUi, "min-width: 680px;", "Phone tables must remain laterally pannable.");
includes(sharedUi, "min-width: 600px;", "Small phones must retain a real horizontal scroll range.");
includes(sharedUi, "--mfl-table-header-height: 32px;", "Mobile header height must match the visible 32px row box.");
includes(sharedUi, "--mfl-table-row-height: 28px;", "Mobile cell content must retain its compact 28px height.");
includes(sharedUi, "--mfl-table-row-outer-height: 32px;", "Mobile rows must retain their visible 32px outer height.");
includes(sharedUi, "--mfl-table-header-height: 28px;", "Phone header height must match the visible 28px row box.");
includes(sharedUi, "--mfl-table-row-height: 24px;", "Phone cell content must retain its compact 24px height.");
includes(sharedUi, "--mfl-table-row-outer-height: 28px;", "Phone rows must retain their visible 28px outer height.");
includes(sharedUi, "--mfl-table-header-height: 26px;", "Small-phone header height must match the visible 26px row box.");
includes(sharedUi, "--mfl-table-row-height: 22px;", "Small-phone cell content must retain its compact 22px height.");
includes(sharedUi, "--mfl-table-row-outer-height: 26px;", "Small-phone rows must retain their visible 26px outer height.");
includes(sharedUi, ".playerTableScroller th {\n    font-size: 10px;", "Mobile headers must use 10px text against 12px mobile rows.");
includes(sharedUi, "@media (max-width: 520px) {", "Phone table styling must retain the canonical 520px breakpoint.");
includes(sharedUi, ".playerTableScroller th {\n    font-size: 9px;", "Phone headers must use 9px text against 11px phone rows.");
includes(sharedUi, ".playerTableScroller th {\n    font-size: 8px;", "Tiny-screen headers must use 8px text against 10px rows.");
includes(sharedUi, "#tableHead .selectionCell input:disabled {\n    opacity: 0.45;", "Disabled header selection must look inactive throughout mobile loading.");
includes(sharedUi, ".playerTableActionsButton {\n    width: 18px;", "Player table action buttons must scale on mobile.");
includes(sharedUi, ".playerTableActionsButton {\n    width: 15px;", "Player table action buttons must scale again on phones.");
includes(sharedUi, ":is(.retirementMarker, .newMintMarker) {\n    flex: 0 0 11px;", "Retirement/new-mint markers must keep a readable 11px mobile layout box.");
includes(sharedUi, ".retirementMarker::before,\n  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img {\n    width: 11px;\n    height: 11px;", "Retired, retiring and new-mint artwork must match the readable mobile marker box.");
includes(sharedUi, "@media (max-width: 700px) {\n  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {\n    flex-basis: 10px;", "Status markers must scale to 10px before the phone breakpoint.");
includes(sharedUi, "flex-basis: 9px;\n    width: 9px;\n    min-width: 9px;\n    max-width: 9px;\n    height: 9px;", "Phone status markers must retain a readable 9px layout box.");
includes(sharedUi, "flex-basis: 8px;\n    width: 8px;\n    min-width: 8px;\n    max-width: 8px;\n    height: 8px;", "Very narrow status markers must retain a readable 8px layout box.");
includes(sharedUi, ".retirementMarker::before {\n    -webkit-mask-size: 100% 100%;\n    mask-size: 100% 100%;", "Retiring marker artwork must scale with its responsive layout box.");
excludes(sharedUi, ":is(.retirementMarker, .newMintMarker) {\n    transform: scale", "Status-marker scaling must not leave an oversized invisible layout box.");
includes(sharedUi, "td.col-age .tableControlCellContent {\n    gap: 1px;", "Age and player-status markers must use a minimal mobile gap.");
includes(sharedUi, ":is(th, td).selectionCell input,\n  #progressionPage .quickFilters input[type=\"checkbox\"]", "Table and Quick Filter checkboxes must share responsive sizing.");
includes(sharedUi, "flex: 0 0 13px;\n    width: 13px;\n    min-width: 13px;\n    max-width: 13px;\n    height: 13px;\n    min-height: 13px;\n    max-height: 13px;\n    aspect-ratio: 1 / 1;", "Mobile checkboxes must remain true squares even inside flex rows.");
includes(sharedUi, ".listingCellContent {\n    display: inline-flex;", "Mobile Listing badges must have explicit square geometry.");
includes(sharedUi, "justify-content: center;\n    width: 100%;\n    margin-inline: auto;", "Listing hosts must center the badge within the full Listing column.");
includes(sharedUi, 'const targetListing = TINY_TABLE_MEDIA.matches ? 3.6 : PHONE_TABLE_MEDIA.matches ? 3.8 : 4.2;', "The Listing column must narrow with screen width.");
includes(sharedUi, 'const basePositions = Number.parseFloat(baseStyle.getPropertyValue("--mfl-table-col-positions")) || 7.508786878261796;', "Mobile width rebalancing must derive Positions from the canonical Uniform Width value.");
includes(sharedUi, 'page.style.setProperty("--mfl-table-col-positions", `${basePositions + reclaimed}%`);', "Width reclaimed from Listing must move to Positions rather than widening Name.");
excludes(sharedUi, 'page.style.setProperty("--mfl-table-col-name", `${baseName + reclaimed}%`);', "Mobile Name must no longer absorb reclaimed Listing width.");
includes(sharedUi, 'const PLAYER_TABLE_FADE_LEFT_CLASS = "mflPlayerTableCanScrollLeft";', "Player tables must expose a left-scroll fade state.");
includes(sharedUi, 'const PLAYER_TABLE_FADE_RIGHT_CLASS = "mflPlayerTableCanScrollRight";', "Player tables must expose a right-scroll fade state.");
includes(sharedUi, "function setPlayerTableFadeDirections(scroller, canScrollLeft, canScrollRight)", "Player-table edge fading must track each scroll direction independently.");
includes(sharedUi, "setPlayerTableFadeDirections(scroller, canScrollLeft, canScrollRight);", "Player-table fades must update from native scroll position.");
includes(sharedUi, ".tableShell::before,\n  #progressionPage .tableShell::after {\n    content: \"\";\n    position: absolute;\n    top: var(--mfl-table-header-height);", "Player-table fades must begin below the header and cover only table body rows.");
includes(sharedUi, ".tableShell.${PLAYER_TABLE_FADE_LEFT_CLASS}::before,\n  #progressionPage .tableShell.${PLAYER_TABLE_FADE_RIGHT_CLASS}::after", "Player-table directional fades must render outside the native scroll layer.");
excludes(sharedUi, "@media (max-width: 843px)", "Player-table first-paint fading must not be guessed from viewport width.");
includes(sharedUi, "html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::before,\n  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after {\n    transition: none;", "Measured first-paint table fades must hand off without a fade animation.");
includes(sharedUi, "function fadeShadow(canScrollLeft, canScrollRight, strength = 56)", "View and Quick Filter overflow must retain dynamic edge fading.");
includes(sharedUi, 'applyFadeShadow(views, canScrollLeft, canScrollRight, views.matches(".quickFilters") ? 72 : 96);', "Views and Quick Filters must use stronger overflow fading.");
excludes(sharedUi, "MutationObserver", "Mobile table presentation must remain render/resize driven.");

includes(mobileTable, 'const mobileTable = window.matchMedia("(max-width: 900px)").matches;', "Generated table presentation must explicitly gate mobile-only behavior.");
includes(mobileTable, 'const compactTableHeadings = window.matchMedia("(max-width: 520px)").matches;', "Generated headings must switch only at the narrow breakpoint.");
includes(mobileTable, 'selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;', "Rebuilt headers must stay non-selectable until loaded row selection state is available.");
excludes(mobileTable, 'positions: "POS"', "Positions must not participate in width-dependent compact header scaling.");
includes(mobileTable, 'column === "positions"\n          ? "POSITIONS"', "Generated mobile tables must call the Positions column POSITIONS at every mobile width.");
for (const label of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY", "GK"]) {
  includes(mobileTable, `: "${label}"`, `Generated compact headings must include ${label}.`);
}
includes(mobileTable, "function compactMobilePlayerName(value)", "Mobile table generation must own N. Surname formatting.");
includes(mobileTable, 'const initial = Array.from(parts[0])[0] || "";', "Mobile names must derive the first-name initial.");
includes(mobileTable, "parts.at(-1)", "Mobile names must use the final surname token.");
includes(mobileTable, 'nameLink.textContent = window.matchMedia("(max-width: 900px)").matches', "Name compaction must remain mobile-only.");
includes(mobileTable, 'nameLink.setAttribute("aria-label", fullPlayerName);', "Compact mobile names must retain the full accessible name.");
includes(mobileTable, 'column === "listing_price" || (column === agentColumn && state.currentPage === "mfl")', "Listing header blanking must remain inside the mobile branch.");
includes(mobileTable, "if (!window.matchMedia(\"(max-width: 900px)\").matches) {", "Desktop Listing rendering must retain the canonical path.");
includes(mobileTable, 'const priceText = String(price?.textContent || "").trim();', "Mobile Listing tooltip must reuse the canonical formatted price.");
includes(mobileTable, "price?.remove();", "Mobile Listing price must not remain visible in the cell.");
includes(mobileTable, "badge.dataset.tooltip = priceText;", "Mobile Listing price must move to the tooltip.");
excludes(mobileTable, "For Sale at", "Mobile Listing tooltips must contain only the formatted price.");
includes(buildNormalizer, "const mobileTableArtifacts = addMobileTablePresentation(tableArtifacts);", "The canonical build must apply mobile table presentation after table splitting.");

includes(staticUi, 'const MOBILE_TOOLTIP_MEDIA = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");', "Global tooltip ownership must recognize mobile input.");
includes(staticUi, "function onTooltipClick(event)", "Mobile tooltips must be click/tap driven.");
includes(staticUi, "if (MOBILE_TOOLTIP_MEDIA.matches) return;", "Hover/focus tooltip paths must be inert on mobile.");
includes(staticUi, "if (!MOBILE_TOOLTIP_MEDIA.matches && tooltipTarget.matches(SPECIALIZED_TOOLTIP_SELECTOR)) return null;", "Specialized targets must fall through to the global tap owner only on mobile.");
includes(discountUi, "if (MOBILE_TOOLTIP_MEDIA.matches || !(metric instanceof HTMLElement)", "Discount-rate hover tooltip must be disabled on mobile.");
includes(evaluationChunk, 'window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches', "Evaluation action hover tooltips must be disabled on mobile.");

includes(bootstrap, 'const FIRST_PAINT_PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");', "Bootstrap must know the same compact heading breakpoint before first paint.");
excludes(bootstrap, 'positions: "POS"', "Bootstrap must not abbreviate Positions based on viewport width.");
for (const label of ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY", "GK"]) {
  includes(bootstrap, `: "${label}"`, `First-paint header generation must include canonical compact ${label}.`);
}
includes(bootstrap, "function firstPaintTableColumnLabel(page, column)", "Bootstrap must generate first-paint labels from viewport and column identity rather than CSS position.");
includes(bootstrap, 'if (column === "listing_price" || (column === agentColumn && normalizedPage === "mfl")) return "";', "First-paint mobile Listing and MFL agent headings must use the same blank-label contract as hydrated tables.");
includes(bootstrap, 'if (column === "positions") return "POSITIONS";', "Positions must already read POSITIONS before first paint on every mobile breakpoint.");
includes(bootstrap, "header.dataset.tableColumn = column;", "First-paint headers must expose the same column identity metadata as hydrated headers.");
includes(bootstrap, "label.dataset.mflFullTableLabel = fullLabel;", "First-paint headers must expose the canonical full label metadata.");
includes(bootstrap, "label.dataset.mflCompactTableLabel = compactLabel;", "First-paint headers must expose the canonical compact label metadata.");
includes(bootstrap, "label.textContent = firstPaintTableColumnLabel(normalizedPage, column);", "First-paint visible column names must already equal the final viewport-aware names.");
includes(bootstrap, 'const FIRST_PAINT_PLAYER_TABLE_FADE_LEFT_CLASS = "mflPlayerTableCanScrollLeft";', "Bootstrap must use the hydrated left-fade class before first paint.");
includes(bootstrap, 'const FIRST_PAINT_PLAYER_TABLE_FADE_RIGHT_CLASS = "mflPlayerTableCanScrollRight";', "Bootstrap must use the hydrated right-fade class before first paint.");
includes(bootstrap, "function primeFirstPaintPlayerTableFade()", "Bootstrap must measure player-table overflow before first paint.");
includes(bootstrap, "const maxScroll = canRender ? Math.max(0, scroller.scrollWidth - scroller.clientWidth) : 0;", "First-paint fading must derive from the actual player-table scroll range.");
includes(bootstrap, "primeFirstPaintPlayerTableFade();", "The measured player-table fade state must be applied before runtime loading begins.");

includes(releaseProjection, 'mobileTableFirstPaintStyle.id = "mflInitialMobileTableStyle";', "Zero-request first paint must prime the reusable mobile table presentation owner.");
includes(releaseProjection, "#progressionPage { --mfl-table-header-height: 32px; --mfl-table-row-height: 28px; --mfl-table-row-outer-height: 32px;", "Mobile first-paint geometry must remain active during the initial-route handoff.");
includes(releaseProjection, "#progressionPage { --mfl-table-header-height: 28px; --mfl-table-row-height: 24px; --mfl-table-row-outer-height: 28px;", "Phone first-paint geometry must remain active during the initial-route handoff.");
includes(releaseProjection, "#progressionPage { --mfl-table-header-height: 26px; --mfl-table-row-height: 22px; --mfl-table-row-outer-height: 26px;", "Tiny-screen first-paint geometry must remain active during the initial-route handoff.");
includes(releaseProjection, "#progressionPage .playerTableScroller th { font-size: 10px; }", "Mobile first paint must apply the final 10px header metric against 12px rows.");
includes(releaseProjection, "#progressionPage .playerTableScroller th { font-size: 9px; }", "Phone first paint must apply the final 9px header metric against 11px rows.");
includes(releaseProjection, "#progressionPage .playerTableScroller th { font-size: 8px; }", "Tiny-screen first paint must apply the final 8px header metric against 10px rows.");
excludes(releaseProjection, "#tableHead > tr { height: var(--mfl-table-header-height); }", "First paint must not create a temporary header-row height owner that disappears during hydration.");
excludes(releaseProjection, "#tableHead > tr > th { height: var(--mfl-table-header-height); min-height: var(--mfl-table-header-height); line-height: var(--mfl-table-header-height); }", "First paint must not create temporary header-cell geometry that disappears during hydration.");
includes(releaseProjection, "#tableHead th > span:first-child { font-size: 10px; }", "Mobile first paint header labels must use 10px text against 12px rows.");
includes(releaseProjection, "#tableHead th > span:first-child { font-size: 9px; }", "Phone first paint header labels must use 9px text against 11px rows.");
includes(releaseProjection, "#tableHead th > span:first-child { font-size: 8px; }", "Tiny-screen first paint header labels must use 8px text against 10px rows.");
includes(releaseProjection, "#tableHead .selectionCell input:disabled { opacity: 0.45; }", "First paint must already show header selection as graphically disabled.");
includes(releaseProjection, ".playerTableScroller :is(th, td).selectionCell input, #appShell #progressionPage .quickFilters input[type=\\\"checkbox\\\"] { box-sizing: border-box; flex: 0 0 13px;", "First-paint checkbox sizing must remain active through the initial-route handoff.");
excludes(releaseProjection, "[data-initial-table-page] #progressionPage { --mfl-table-header-height:", "Mobile header geometry must not disappear when the initial route resolves.");
excludes(releaseProjection, "#appShell #progressionPage > .quickFilters input[type=\\\"checkbox\\\"]", "First-paint Quick Filter sizing must not depend on Quick Filters remaining a direct progression-page child.");
excludes(releaseProjection, "@media (max-width: 843px)", "First-paint table fading must never be forced from a viewport-width assumption.");
includes(releaseProjection, ".tableShell::before, html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after { content: \\\"\\\"; position: absolute; top: var(--mfl-table-header-height); bottom: 0;", "First-paint fading must begin below the table header on both edges.");
includes(releaseProjection, ".tableShell.mflPlayerTableCanScrollLeft::before, html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell.mflPlayerTableCanScrollRight::after { opacity: 0.94; visibility: visible; }", "First paint must render exactly the measured left/right table fade state.");
includes(releaseProjection, "--mfl-table-col-listing: 4.2%; --mfl-table-col-positions: 9.699243795931409%;", "Tablet/mobile first paint must use the final Listing and Positions widths.");
includes(releaseProjection, "--mfl-table-col-listing: 3.8%; --mfl-table-col-positions: 10.099243795931411%;", "Phone first paint must use the final Listing and Positions widths.");
includes(releaseProjection, "--mfl-table-col-listing: 3.6%; --mfl-table-col-positions: 10.29924379593141%;", "Very narrow first paint must use the final Listing and Positions widths.");
includes(releaseProjection, ".playerTableScroller .sortArrow { transform: scale(0.75); transform-origin: center; }", "Mobile first paint must size the sort arrow exactly like hydration.");
includes(releaseProjection, ".playerTableScroller .sortArrow { transform: scale(0.62); }", "Phone first paint must size the sort arrow exactly like hydration.");
includes(releaseProjection, ".playerTableScroller .sortArrow { transform: scale(0.54); }", "Very narrow first paint must size the sort arrow exactly like hydration.");
excludes(releaseProjection, "box-shadow: inset -64px", "First paint must not fade the header through a scroller-wide box shadow.");
excludes(releaseProjection, "#appShell #progressionPage > .quickFilters { height: 28px; min-height: 28px; margin-bottom: 18px;", "First paint must not replace the canonical 46px Quick Filters box with a synthetic row-plus-margin approximation.");
excludes(releaseProjection, "#appShell #progressionPage > .quickFilters { height: 26px; min-height: 26px; margin-bottom: 16px;", "Phone first paint must keep the canonical 42px Quick Filters box instead of synthesizing its footprint with margin.");
includes(releaseProjection, "@media (min-width: 521px) and (max-width: 900px)", "Tablet first paint must explicitly keep canonical full header text.");
includes(releaseProjection, "#tableHead th > span:first-child::after { content: none; display: none; }", "First paint must suppress legacy positional pseudo-labels and display the canonical header text generated by bootstrap.");
includes(releaseProjection, "@media (max-width: 520px)", "First-paint compact labels must use the same phone breakpoint.");
excludes(releaseProjection, "content: \\\"OVR\\\"", "First-paint compact headings must no longer be invented by positional CSS pseudo-elements.");
excludes(releaseProjection, "content: \\\"POS\\\"", "First-paint compact headings must no longer be invented by positional CSS pseudo-elements.");
includes(releaseProjection, "-webkit-mask-image: none; mask-image: none;", "First paint must disable the legacy scroll-layer mask before touch interaction.");

for (const source of [sharedUi, staticUi, discountUi, evaluationChunk, mobileTable, releaseProjection, bootstrap]) {
  excludes(source, "!important", "Mobile table retry must not introduce !important overrides.");
}

console.log("Mobile table retry validation passed.");
