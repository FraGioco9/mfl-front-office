import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [responsive, styles, bootstrap, staticUi, player, sharedTableUi, scrollbars, appConfig, responsiveDomain, routeDomain] = await Promise.all([
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./modules/core-sources/player.js"),
  read("./shared-table-ui-runtime.js"),
  read("./scrollbars.css"),
  read("./modules/app-config.js"),
  read("./validate-domain-responsive-ui.mjs"),
  read("./validate-domain-route-features.mjs"),
]);

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
invariant(!styles.includes(".playerPage {\n  max-width: 1180px;\n  min-height: 0;"), "Player page must retain its natural block height so mobile Notes and Pitch contribute to footer placement.");
invariant(styles.includes(".playerDetail {\n  display: grid;\n  gap: 6px;\n  margin-top: 0;\n}"), "Desktop Player first paint must start at the same zero top offset as settled runtime.");
invariant(responsive.includes(".playerDetail {\n  gap: var(--mfl-player-panel-gap);\n  margin-top: 0;\n}"), "Mobile Player first paint must start at the same zero top offset as settled runtime.");
const includes = (source, value, message) => invariant(source.includes(value), message);

for (const required of [
  "--mfl-player-box-height: clamp(38px, 8.4vw, 43px);",
  "--mfl-player-box-padding-inline: clamp(6px, 1.8vw, 10px);",
  "--mfl-player-contract-division-font-size: clamp(7.5px, 2vw, 10px);",
  "--mfl-player-profile-flag-size: calc(var(--mfl-player-value-font-size) * 1.25);",
  "--mfl-player-profile-icon-size: calc(var(--mfl-player-value-font-size) * 0.72);",
  "--mfl-player-age-icon-gap: clamp(1px, 0.35vw, 2px);",
  "--mfl-player-nationality-gap: calc(var(--mfl-player-age-icon-gap) + 2px);",
  ".detailGrid .contractDetailCard strong .playerContractTeam {",
  ".detailGrid .contractDetailCard strong .playerContractDivision {",
  "font-size: var(--mfl-player-contract-division-font-size);",
  ".playerInfoPanel .detailGrid .nationalityDetailCard strong {",
  "gap: var(--mfl-player-nationality-gap);",
  ".playerInfoPanel .detailGrid .nationalityDetailCard .flagImage {",
  "width: var(--mfl-player-profile-flag-size);",
  "height: var(--mfl-player-profile-flag-size);",
  ".detailGrid > div > span,\n.playerAttributeCard > span {",
  ".playerInfoPanel .detailGrid .playerAgeMarker {",
  "width: var(--mfl-player-profile-icon-size);",
  "-webkit-mask-size: var(--mfl-player-profile-icon-size) var(--mfl-player-profile-icon-size);",
  "mask-size: var(--mfl-player-profile-icon-size) var(--mfl-player-profile-icon-size);",
  "background: var(--retirement-marker-color);",
  ".playerInfoPanel .detailGrid strong .playerDetailAgeLine {",
  "gap: var(--mfl-player-age-icon-gap);",
  "overflow: visible;",
  "object-fit: contain;",
  ".playerInfoPanel .detailGrid > .playerInfoFullWidthCard {",
  ".detailGrid > div {",
  "padding: 3px var(--mfl-player-box-padding-inline);",
  "grid-template-rows: repeat(5, var(--mfl-player-box-height));",
  "--mfl-player-box-radius: clamp(5px, 1.2vw, 8px);",
  "--mfl-player-hero-overall-size: clamp(58px, 15vw, 84px);",
  "--mfl-player-hero-action-height: clamp(32px, 7vw, 36px);",
  "--mfl-player-attribute-view-height: clamp(24px, 5vw, 26px);",
  "--mfl-player-training-control-size: clamp(16px, 4vw, 20px);",
  "--mfl-player-training-control-gap: calc(var(--mfl-player-training-control-size) * 0.2);",
  "--mfl-player-training-control-radius: calc(var(--mfl-player-training-control-size) * 0.3);",
  "--mfl-player-training-reset-width: calc(var(--mfl-player-training-control-size) * 2.5);",
  "width: var(--mfl-player-training-control-size);",
  "height: var(--mfl-player-training-control-size);",
  "width: var(--mfl-player-training-reset-width);",
  ".playerAttributeViews.mflViewsOverflowing {",
  "box-shadow: inset -96px 0 96px -69px var(--page-bg);",
  "overscroll-behavior-x: none;",
  "touch-action: pan-x pan-y;",
  "height: var(--mfl-player-attribute-view-height);",
  "min-height: var(--mfl-player-attribute-view-height);",
  "max-height: var(--mfl-player-attribute-view-height);",
  "--mfl-player-portrait-height: clamp(66px, 17vw, 96px);",
  "--mfl-player-hero-media-width: clamp(182px, 47vw, 265px);",
  "grid-template-columns: var(--mfl-player-hero-media-width) minmax(0, 1fr);",
  "column-gap: var(--mfl-player-hero-section-gap);",
  "row-gap: var(--mfl-player-hero-section-gap);",
  "grid-template-columns: repeat(2, minmax(0, 1fr));",
  "height: var(--mfl-player-box-height);",
  "min-height: var(--mfl-player-box-height);",
  "max-height: var(--mfl-player-box-height);",
  ".playerAttributeCard.fullWidth {",
  "width: min(100%, clamp(240px, 70vw, 320px));",
  ".pitchPositionCircle,\n.pitchPositionBlank {",
  "width: clamp(33.333px, 9.722vw, 44.444px);",
  "height: clamp(33.333px, 9.722vw, 44.444px);",
  ".pitchPositionCircle strong {\n  font-size: clamp(12px, 3.5vw, 16px);\n}",
  ".pitchPositionCircle small {\n  font-size: clamp(7.333px, 2.139vw, 9.778px);\n}",
  ".playerPage,\n.playerDetail,\n.playerGrid,\n.playerStack,\n.playerPanel,\n.detailGrid,\n.attributeGrid {",
  "max-width: 100%;",
]) includes(responsive, required, "Unified Player mobile geometry is missing " + required);

const mobileHeroStart = responsive.indexOf(".playerHero {\n  display: grid;");
const mobileHeroEnd = mobileHeroStart >= 0 ? responsive.indexOf("}", mobileHeroStart) : -1;
invariant(mobileHeroStart >= 0 && mobileHeroEnd > mobileHeroStart, "Mobile Player hero geometry block is missing.");
const mobileHeroBlock = responsive.slice(mobileHeroStart, mobileHeroEnd + 1);
invariant(mobileHeroBlock.includes("column-gap: var(--mfl-player-hero-section-gap);") && mobileHeroBlock.includes("row-gap: var(--mfl-player-hero-section-gap);"), "Player hero first paint and hydrated runtime must use the same responsive section gap on both grid axes.");
invariant(!mobileHeroBlock.includes("column-gap: clamp(8px, 2vw, 14px);"), "Player hero first paint must not retain a larger pre-hydration column gap than settled runtime.");
const mobileViewsOverflowStart = responsive.indexOf(".playerAttributeViews.mflViewsOverflowing {");
const mobileViewsOverflowEnd = mobileViewsOverflowStart >= 0 ? responsive.indexOf("}", mobileViewsOverflowStart) : -1;
invariant(mobileViewsOverflowStart >= 0 && mobileViewsOverflowEnd > mobileViewsOverflowStart, "Mobile Player overflow styling block is missing.");
const mobileViewsOverflowBlock = responsive.slice(mobileViewsOverflowStart, mobileViewsOverflowEnd + 1);
invariant(mobileViewsOverflowBlock.includes("box-shadow: inset -96px 0 96px -69px var(--page-bg);"), "Player Attribute view fading must already be painted by the parser-owned overflow class before shared runtime hydration.");

invariant(!responsive.includes(".attributeGrid:has(.trainingCard) .playerAttributeCard"), "Training must not change the mobile Attribute card width contract.");
invariant(!responsive.includes(".playerAttributeCard.trainingCard {"), "Training cards must use the same mobile outer-card geometry as every other Attribute view.");
invariant(responsive.includes("max-width: var(--mfl-player-training-control-size);"), "Training +/- controls must remain square while scaling.");
invariant(responsive.includes("max-width: var(--mfl-player-training-reset-width);"), "Training Reset must keep its proportional width while scaling.");
invariant(styles.includes(".playerAttributeCard {\n  min-height: 30px;\n  padding: 3px 10px;\n}"), "Desktop Attribute card padding must remain the canonical alignment reference.");
const mobileAttributeCardStart = responsive.indexOf(".playerAttributeCard,\n.playerAttributeCard.featured {");
const mobileAttributeCardEnd = mobileAttributeCardStart >= 0 ? responsive.indexOf("}", mobileAttributeCardStart) : -1;
invariant(mobileAttributeCardStart >= 0 && mobileAttributeCardEnd > mobileAttributeCardStart, "Mobile Attribute card sizing block is missing.");
const mobileAttributeCardBlock = responsive.slice(mobileAttributeCardStart, mobileAttributeCardEnd + 1);
invariant(mobileAttributeCardBlock.includes("padding: 3px var(--mfl-player-box-padding-inline);"), "Mobile Attribute cards must keep desktop 3px vertical padding while scaling only horizontal padding.");
invariant(!mobileAttributeCardBlock.includes("align-content:"), "Mobile Attribute cards must inherit desktop grid alignment instead of defining a separate align-content rule.");
invariant(responsive.includes("--mfl-player-box-height: clamp(38px, 8.4vw, 43px);"), "Mobile Player boxes must reserve enough block size for scaled labels, descender-safe values, borders, padding, and Training controls without clipping their top or bottom edges.");
invariant(responsive.includes(".detailGrid > div > span,\n.playerAttributeCard > span {\n  font-size: var(--mfl-player-label-font-size);\n  line-height: 1.1;\n}"), "Mobile Player labels must reserve descender-safe line height.");
invariant(responsive.includes(".playerAttributeCard strong {\n  flex-wrap: nowrap;\n  gap: 3px;\n  overflow: hidden;\n  font-size: var(--mfl-player-attribute-font-size);\n  line-height: 1.1;\n}"), "Mobile Player Attribute values must reserve descender-safe line height.");
invariant(responsive.includes(".playerAttributeCard .attributeValueText {\n  line-height: inherit;\n}"), "Attribute value text must inherit the descender-safe mobile line height instead of the desktop 1.0 line box.");
invariant(player.includes('return `<span class="nextOverallValue neutral">NO OVR IMPACT</span>`;'), "Player Next Overall neutral copy must stay uppercase like desktop.");
invariant(!player.includes('>No OVR impact</span>'), "Mixed-case No OVR impact copy must not return.");
const mobileFlagStart = responsive.indexOf(".playerInfoPanel .detailGrid .nationalityDetailCard .flagImage {");
const mobileFlagEnd = mobileFlagStart >= 0 ? responsive.indexOf("}", mobileFlagStart) : -1;
invariant(mobileFlagStart >= 0 && mobileFlagEnd > mobileFlagStart, "Mobile Player flag sizing block is missing.");
const mobileFlagBlock = responsive.slice(mobileFlagStart, mobileFlagEnd + 1);
invariant(!/(?:align-self|vertical-align|margin|transform|position|top|bottom)/.test(mobileFlagBlock), "Mobile Player flag may resize only; desktop owns its alignment.");
invariant(responsive.includes(".playerInfoPanel .detailGrid .nationalityDetailCard strong {\n    gap: var(--mfl-player-nationality-gap);\n  }"), "Mobile Player Nationality may scale only its horizontal gap.");
invariant(styles.includes(".detailGrid div {\n  min-height: 32px;\n  padding: 3px 10px;\n}"), "Desktop Profile card padding must remain the canonical vertical alignment reference.");
invariant(styles.includes(".detailGrid strong {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}"), "Desktop Profile value flex centering must remain canonical.");
invariant(styles.includes(".detailGrid .nationalityDetailCard .playerNationalityText {\n  display: contents;\n}"), "Desktop Nationality text must remain layout-transparent.");
invariant(styles.includes(".detailGrid .nationalityDetailCard strong {\n  gap: 4px;\n}"), "Desktop Player nationality must match the rendered 4px Age-to-icon distance (2px line gap plus the canonical 2px marker margin).");
invariant(!responsive.includes("playerNationalityText {\n    display:"), "Mobile must not redefine Nationality text layout.");
invariant(styles.includes(".playerAgeMarker {\n  display: inline-flex;\n  align-items: center;\n  margin-left: 2px;\n  line-height: 1;\n  transform: translateY(1px);"), "Desktop Age marker placement must remain canonical.");
const mobileAgeMarkerStart = responsive.indexOf(".playerInfoPanel .detailGrid .playerAgeMarker {");
const mobileAgeMarkerEnd = mobileAgeMarkerStart >= 0 ? responsive.indexOf("}", mobileAgeMarkerStart) : -1;
invariant(mobileAgeMarkerStart >= 0 && mobileAgeMarkerEnd > mobileAgeMarkerStart, "Mobile Age marker sizing block is missing.");
const mobileAgeMarkerBlock = responsive.slice(mobileAgeMarkerStart, mobileAgeMarkerEnd + 1);
invariant(!/(?:margin-left|align-self|vertical-align|transform)/.test(mobileAgeMarkerBlock), "Mobile Age marker may resize only; desktop owns its placement.");
invariant(styles.includes(".playerContractLine {\n  display: inline-flex;\n  align-items: baseline;\n  gap: 4px;"), "Desktop Contract Team and Division must share one typographic baseline.");
invariant(styles.includes(".playerContractDivision {\n  display: inline-flex;\n  align-items: baseline;"), "Contract Division must inherit baseline alignment from the canonical desktop owner.");
invariant(!responsive.includes(".detailGrid .contractDetailCard strong .playerContractLine {"), "Mobile must not redefine Contract line alignment.");
invariant(!responsive.includes(".detailGrid .contractDetailCard {"), "Mobile must not redefine Contract card vertical padding/alignment.");
invariant(!responsive.includes(".playerInfoPanel .detailGrid > div {\n  grid-template-rows:"), "Mobile must not create a separate Profile vertical-track alignment system.");
invariant(!responsive.includes(".playerInfoPanel .detailGrid > div > span,\n.playerInfoPanel .detailGrid > div > strong"), "Mobile must not stretch Profile label/value rows independently of desktop.");
invariant(!responsive.includes(".navButton,\n  .playerAttributeViewButton,\n  .pager button {\n    min-height: 44px;"), "Player Attribute view boxes must not be overridden by the generic coarse-pointer 44px minimum.");
invariant(!styles.includes(".detailGrid span,\n.playerAttributeCard span {"), "Profile nested value spans must not inherit desktop label typography.");
invariant(!responsive.includes(".detailGrid span,\n.playerAttributeCard span {"), "Profile nested value spans must not inherit mobile label sizing.");
invariant(!player.includes("const ageMarkerHtml = playerAgeMarkerHtml(ageMarker);"), "Hydrated Player render must not call the first-paint helper outside its scope.");
invariant(!player.includes('["Nationality", playerNationalityHtml(rawNationality, nationality)]'), "Hydrated Nationality render must use the exported first-paint helper instead of an out-of-scope call.");

invariant(responsive.includes("width: clamp(33.333px, 9.722vw, 44.444px);"), "Mobile Player pitch circles must preserve the desktop 50/360 marker-to-pitch ratio.");
invariant(responsive.includes("font-size: clamp(12px, 3.5vw, 16px);"), "Mobile Player pitch rating text must preserve the desktop 18/360 text-to-pitch ratio.");
invariant(responsive.includes("font-size: clamp(7.333px, 2.139vw, 9.778px);"), "Mobile Player pitch position text must preserve the desktop 11/360 text-to-pitch ratio.");
invariant(!responsive.includes("width: clamp(32px, 9vw, 44px);"), "Player pitch circles must not retain the old hand-tuned mobile scale.");
invariant(styles.includes(".pitchPositionCircle strong {\n  font-size: 18px;\n}"), "Desktop Player pitch rating text must remain unchanged.");
invariant(styles.includes(".pitchPositionCircle small {\n  margin-top: 0;\n  font-size: 11px;"), "Desktop Player pitch position text must remain unchanged.");
invariant(player.includes('class="pitchPositionCircle ${familiarity}"'), "Hydrated Player pitch markers must keep the shared pitchPositionCircle class used by responsive scaling.");
invariant(player.includes('class="pitchPositionBlank" aria-hidden="true"'), "Pending Player pitch slots must keep the shared pitchPositionBlank class so first-paint and settled marker geometry match.");

const phoneStart = responsive.indexOf("@media (max-width: 520px)");
const tinyStart = responsive.indexOf("@media (max-width: 380px)");
invariant(phoneStart >= 0 && tinyStart > phoneStart, "Expected responsive breakpoints are missing.");
const phoneSection = responsive.slice(phoneStart, tinyStart);
const tinySection = responsive.slice(tinyStart);
invariant(!phoneSection.includes("--mfl-player-"), "Player geometry must not fork into a separate 520px token system.");
invariant(!tinySection.includes("--mfl-player-"), "Player geometry must not fork into a separate 380px token system.");
invariant(!phoneSection.includes(".playerAttributeCard"), "520px must not independently resize Player cards.");
invariant(!tinySection.includes(".playerAttributeCard"), "380px must not independently resize Player cards.");
invariant(!phoneSection.includes(".detailGrid {\n    grid-template-columns: 1fr;"), "Player Profile must remain two cards per row at 520px.");
invariant(!tinySection.includes(".detailGrid {\n    grid-template-columns: 1fr;"), "Player Profile must remain two cards per row below 380px.");

for (const required of [
  ".playerContractDivision {",
  "font-size: 10px;",
  "text-transform: uppercase;",
  ".detailGrid strong {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}",
  ".flagImage {\n  width: 20px;\n  height: 20px;",
  ".detailGrid > div > span,\n.playerAttributeCard > span {",
  ".playerHeroMedia {",
  "width: var(--mfl-player-hero-media-width, 320px);",
  ".playerHeroOverall {",
  "width: var(--mfl-player-hero-overall-size, 100px);",
  ".playerHeroPortraitFrame {",
  "height: var(--mfl-player-portrait-height, 112px);",
]) includes(styles, required, "Render-blocking Player geometry is missing " + required);

for (const required of [
  '<div class="playerHeroMedia">',
  '<div class="playerHeroIdentity">',
  '<div class="playerHeroActionMenu">',
  'class="playerHeroOverall isPending"',
  '["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract", "Rev Share"].map((label) => {',
  'contractDetailCard playerInfoFullWidthCard',
  'revShareDetailCard playerInfoFullWidthCard',
  'sessionStorage.getItem("mfl-player-first-paint-v1:" + playerId)',
  'class="playerDetailAgeLine"',
  'retirementMarker--retiring-${retirementYears}',
  'retirementMarker--retired',
  'scroller.matches("#playerDetail .playerAttributeViews")',
  'document.querySelector("#playerDetail .playerAttributeViews")',
]) includes(bootstrap, required, "Player first paint must reserve final responsive Profile/hero structure, cached Age marker, and Attribute-view overflow cues: " + required);

for (const required of [
  'const profileLabels = ["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract", "Rev Share"];',
  'card.classList.add("nationalityDetailCard");',
  'card.classList.add("contractDetailCard", "playerInfoFullWidthCard");',
  'card.classList.add("revShareDetailCard", "playerInfoFullWidthCard");',
]) includes(staticUi, required, "Static Player first paint must preserve final Profile card order/classes: " + required);

for (const required of [
  "function playerCssLength(customProperty, fallbackPx) {",
  "probe.style.width = playerCssLength(customProperty, fallbackPx);",
  'playerCssPixels("--mfl-player-portrait-height", PLAYER_PORTRAIT_DISPLAY_HEIGHT_PX)',
  'playerCssLength("--mfl-player-hero-overall-size", PLAYER_HERO_OVERALL_SIZE_PX)',
  'class="playerDetailAgeLine"',
  'function retirementMarkerFromKnownValue(value) {',
  'playerAgeMarkerHtml,',
  'playerNationalityHtml,',
  'function playerNationalityFlagHtml(rawNationality) {',
  '.replace(/\\sdata-tooltip="[^"]*"/, "")',
  'const existingAttributeViews = playerDetail.querySelector(".playerAttributeViews");',
  'const existingAttributeViewsShell = existingAttributeViews?.closest(".viewsScrollerShell");',
  'existingAttributeViews.innerHTML = viewButtons;',
  'renderedAttributeViews.replaceWith(preservedAttributeViewsHost);',
  'const playerRuntime = window.__mflPlayerFirstPaintRuntime;',
  'playerRuntime?.playerAgeMarkerHtml?.(ageMarker)',
  'playerRuntime?.playerNationalityHtml?.(rawNationality, nationality)',
  'class="playerNationalityText"',
  'if (label === "Nationality") card.className = "nationalityDetailCard";',
  'nationalityDetailCard',
  'contractDetailCard playerInfoFullWidthCard',
  'revShareDetailCard playerInfoFullWidthCard',
  'if (label === "Rev Share") card.className = "revShareDetailCard playerInfoFullWidthCard";',
  'window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();',
]) includes(player, required, "Canonical Player runtime must consume fluid CSS geometry, Profile structure, and refresh shared Attribute-view cues after every render: " + required);

for (const required of [
  'playerPre: Object.freeze([\n    "/shared-table-ui-runtime.js",\n  ]),',
  'if (page === "player") preCore.push(...data.routes.runtimeScripts.playerPre);',
]) includes(appConfig, required, "Player routes must actually load the shared horizontal-cue runtime before the Player core: " + required);

for (const required of [
  'function playerAttributeViews() {',
  'document.querySelector("#playerDetail .playerAttributeViews")',
  'return [tableViews(), tableQuickFilters(), playerAttributeViews()]',
  'if (views.matches("#playerDetail .playerAttributeViews")) return "attribute views";',
  'ensureViewScrollers();\n    tableHorizontalScrollers().forEach(syncViewScroller);',
  'target.matches("#progressionPage .views, #progressionPage .quickFilters, #playerDetail .playerAttributeViews")',
  'target.closest("#progressionPage .views, #progressionPage .quickFilters, #playerDetail .playerAttributeViews")',
  'if (scroller.isConnected) return;',
  'if (!overflowing) {\n      setViewScrollButtonVisible(button, false);\n      setViewScrollButtonVisible(leftButton, false);',
]) includes(sharedTableUi, required, "Player Attribute views must reuse shared table horizontal cue ownership and survive dynamic Player rerenders: " + required);

for (const required of [
  ".views,\n    .quickFilters,\n    .playerAttributeViews,\n    .filtersDialog .filterBuilder {",
  ".views::-webkit-scrollbar,\n  .quickFilters::-webkit-scrollbar,\n  .playerAttributeViews::-webkit-scrollbar,",
]) includes(scrollbars, required, "Player Attribute views must hide native scrollbar chrome through scrollbars.css: " + required);

invariant(responsiveDomain.includes('"validate-player-mobile-scaling.mjs"'), "Player mobile regression must live in the responsive validator domain.");
invariant(!routeDomain.includes('"validate-player-mobile-scaling.mjs"'), "Player mobile regression must not remain in the route-feature domain.");
invariant(!player.includes("!important"), "Player mobile scaling must not use !important.");
invariant(!player.includes('matchMedia("(max-width:'), "Player sizing must stay CSS-owned without runtime viewport branches.");
invariant(!sharedTableUi.includes("setViewScrollButtonVisible(button, false);\n    setViewScrollButtonVisible(leftButton, false);\n    const overflowing"), "Horizontal view cues must not be transiently hidden before every direction recomputation, otherwise arrows/fades visibly reappear after Player hydration or view switches.");
invariant(player.includes('return countryFlagHtml(rawNationality).replace(/\\sdata-tooltip="[^"]*"/, "");'), "Individual Player nationality flags must suppress the shared visual tooltip while keeping shared flag rendering elsewhere.");

console.log("Player mobile layout keeps final Profile ordering while inheriting desktop Profile vertical alignment unchanged: desktop card padding, strong-row flex centering, Nationality layout, Age-marker placement, and Contract baseline alignment stays canonical; Player flags have no visual tooltip, nationality spacing matches Age-to-icon spacing, and mobile only scales sizes, widths, and requested horizontal gaps.");
