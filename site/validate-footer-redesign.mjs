import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [indexHtml, footer, responsive, stylesBase, styles, staticUi, bootstrap, shared, selectionStack] = await Promise.all([
  read("./index.html"),
  read("./footer.css"),
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./styles.css"),
  read("./static-ui-runtime.js"),
  read("./bootstrap.js"),
  read("./modules/core-sources/shared.js"),
  read("./selection-stack-runtime.js"),
]);

for (const token of [
  '<footer class="siteFooterDetails" aria-labelledby="siteFooterDetailsTitle">',
  'Management, scouting, progression, and evaluation tools for MFL.',
  '<nav class="siteFooterDetailsNavigation" aria-label="Footer information">',
  '<span>Support</span>',
  '<span>Information</span>',
  '<a href="/privacy" data-page="privacy">Privacy</a>',
  '<button type="button" class="siteFooterDetailsSupportButton agentTableLink" data-bug-report-control="true" aria-haspopup="dialog" aria-controls="bugReportModal">Report a bug</button>',
  '<span>Creator</span>',
  'href="https://app.playmfl.com/users/0x9e5b126e993a771a"',
  'aria-label="FraGioco9 on MFL"',
  'class="siteFooterDetailsCreatorIcon siteFooterDetailsCreatorMflIcon" viewBox="0 0 463.6 135"',
  '<span>FraGioco9</span>',
  'aria-label="Discord #FraGioco9"',
  '<span>#FraGioco9</span>',
  'href="https://x.com/FraGioco9"',
  'aria-label="FraGioco9 on Twitter"',
  '<span>@FraGioco9</span>',
  '<span id="statusText">Updated -</span>',
  'Independent community tool. Not an official MFL product.',
  '© 2026 MFL Front Office',
]) {
  invariant(indexHtml.includes(token), `Single footer markup is missing: ${token}`);
}

invariant(
  /<a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="\/changelog" data-page="changelog">MFL Front Office v\d+\.\d+\.\d+<\/a>/.test(indexHtml),
  "The footer title must expose the generated version as its Changelog link.",
);
invariant((indexHtml.match(/href="\/changelog" data-page="changelog"/g) || []).length === 1, "The footer must expose exactly one Changelog link.");
invariant(!indexHtml.includes('<strong id="siteFooterDetailsTitle"'), "The footer title must be the Changelog link instead of a separate static label.");
invariant(!indexHtml.includes('>Source code</a>'), "The footer must not expose the repository source-code link.");
invariant(!indexHtml.includes('<span>Resources</span>'), "The footer must not keep the removed Resources group.");
invariant(!indexHtml.includes('<footer class="siteFooter">'), "The legacy compact footer must be removed from the DOM.");
invariant((indexHtml.match(/id="statusText"/g) || []).length === 1, "Data freshness must have exactly one footer owner.");

const detailsIndex = indexHtml.indexOf('<footer class="siteFooterDetails"');
const identityIndex = indexHtml.indexOf('<div class="siteFooterDetailsIdentity">', detailsIndex);
const versionIndex = indexHtml.indexOf('<a id="siteFooterDetailsTitle" class="siteFooterDetailsTitle" href="/changelog" data-page="changelog">MFL Front Office v', identityIndex);
const descriptionIndex = indexHtml.indexOf('Management, scouting, progression, and evaluation tools for MFL.', identityIndex);
const navigationIndex = indexHtml.indexOf('<nav class="siteFooterDetailsNavigation"', identityIndex);
const mainCloseIndex = indexHtml.indexOf("      </main>", detailsIndex);
invariant(detailsIndex >= 0 && mainCloseIndex > detailsIndex, "The sole footer must remain at the end of the main scroll surface.");
invariant(identityIndex >= 0 && versionIndex > identityIndex && descriptionIndex > versionIndex && navigationIndex > descriptionIndex, "The live version must be the product title above its description.");

for (const token of [
  'main {',
  '--mfl-footer-page-floor: 800px;',
  'display: flex;',
  'flex-direction: column;',
  'align-items: stretch;',
  'row-gap: 22px;',
  'main > .pageView {',
  'min-height: var(--mfl-footer-page-floor);',
  '.siteFooterDetails {',
  'margin-top: 0;',
  'html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main {',
  'grid-template-rows: minmax(var(--mfl-footer-page-floor), max-content) max-content;',
  'html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main > .siteFooterDetails {',
  '.siteFooterDetailsInner {',
  '.siteFooterDetailsNavigation {',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.siteFooterDetails a[href="/changelog"]',
  '.siteFooterDetails a[data-page="changelog"]',
  'font-size: 14px;',
  'font-weight: 800;',
  'cursor: default;',
  'transition: color var(--mfl-motion-fast, 120ms) ease;',
  'body:not([data-page="changelog"]) .siteFooterDetails a[href="/changelog"]:hover,',
  'body:not([data-page="changelog"]) .siteFooterDetails a[data-page="changelog"]:hover {',
  'color: var(--primary);',
  '.siteFooterDetailsGroup > :is(a, .siteFooterDetailsSupportButton) {',
  'margin: 0;',
  'color: var(--text-muted);',
  '.siteFooterDetailsCreatorLinks {',
  '.siteFooterDetailsCreatorLink {',
  '.siteFooterDetailsCreatorIcon {',
  '.siteFooterDetailsCreatorMflIcon {',
  '.siteFooterDetailsMeta {',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  '.siteFooterDetails #statusText {',
  'justify-self: start;',
  '.siteFooterDetailsDisclaimer {',
  'grid-column: 2;',
  '.siteFooterDetailsCopyright {',
  'justify-self: end;',
  'border-top: 1px solid var(--border);',
  'outline: 2px solid var(--primary);',
]) {
  invariant(footer.includes(token), `Canonical single-footer styling is missing: ${token}`);
}

const footerActionStart = footer.indexOf('.siteFooterDetailsGroup > :is(a, .siteFooterDetailsSupportButton) {');
const footerActionEnd = footer.indexOf('\n}', footerActionStart);
const footerActionBlock = footerActionStart >= 0 && footerActionEnd > footerActionStart
  ? footer.slice(footerActionStart, footerActionEnd)
  : '';
for (const token of [
  'display: block;',
  'align-self: start;',
  'justify-self: start;',
  'height: auto;',
  'min-height: 0;',
  'padding: 0;',
  'line-height: 1.15;',
]) {
  invariant(footerActionBlock.includes(token), `Footer Support and Information actions must share natural-height alignment: ${token}`);
}
invariant(!footerActionBlock.includes('height: 40px;'), "Footer actions must not inherit the global 40px button height.");
invariant(!footer.includes('.siteFooterDetailsGroup :is(a, .siteFooterDetailsSupportButton) {'), "Direct Support/Information geometry must not capture nested Creator links.");

invariant(
  footer.includes(`main {
  --mfl-footer-page-floor: 800px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  row-gap: 22px;
}`),
  "The footer must follow actual page content in normal flow while every route shares the responsive floor.",
);
const tableScrollerStart = styles.indexOf('#progressionPage .playerTableScroller {');
const tableScrollerEnd = styles.indexOf('\n}', tableScrollerStart);
const tableScrollerBlock = tableScrollerStart >= 0 && tableScrollerEnd > tableScrollerStart ? styles.slice(tableScrollerStart, tableScrollerEnd) : '';
invariant(
  tableScrollerBlock && !tableScrollerBlock.includes('min-height:') && !tableScrollerBlock.includes('var(--mfl-table-row-outer-height)'),
  "Footer placement must not be derived from table row geometry.",
);
invariant(
  footer.includes(`.siteFooterDetails {
  flex: 0 0 auto;
  width: 100%;
  margin-top: 0;`),
  "The footer must remain a normal-flow item after the visible route content.",
);
invariant(
  footer.includes(`main > .pageView {
  flex: 0 0 auto;
  min-height: var(--mfl-footer-page-floor);
}`),
  "Every application page must contribute its natural height while retaining the shared floor.",
);
invariant(
  footer.includes(`html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(var(--mfl-footer-page-floor), max-content) max-content;
  align-content: start;
}`),
  "Unresolved non-Player first paint must own an explicit minimum content track before route resolution.",
);
invariant(
  footer.includes(`html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main > .pageView {
  grid-column: 1;
  grid-row: 1;
}`)
    && footer.includes(`html:not(.mflInitialRouteResolved):not([data-initial-entity-route="player"]) body > #appShell > main > .siteFooterDetails {
  grid-column: 1;
  grid-row: 2;
}`),
  "Unresolved non-Player route shells and the footer must stay on explicit fallback rows.",
);
invariant(
  !footer.includes('html:not(.mflInitialRouteResolved) body > #appShell > main {'),
  "Direct Player loading must remain in base flex flow so its actual bottom-most box pushes the footer down.",
);
invariant(!footer.includes('main:not(:has(> .pageView:not([hidden])))'), "Refresh first paint must not infer visibility from hidden attributes.");
invariant(
  !footer.includes('min-height: max(calc(100% - 22px), calc(100dvh - var(--pinned-topbar-height) - 22px));'),
  "Footer placement must not use the superseded route-owned viewport floor.",
);
invariant(
  footer.includes('body:not([data-page="changelog"]) .siteFooterDetails a[href="/changelog"]:hover,\nbody:not([data-page="changelog"]) .siteFooterDetails a[data-page="changelog"]:hover {\n  color: var(--primary);\n  cursor: pointer;\n}'),
  "The Changelog title must show a pointer cursor only while hovering outside the active Changelog page.",
);
invariant(!footer.includes('.siteFooterDetails a[href="/changelog"]:hover,\n.siteFooterDetails a[data-page="changelog"]:hover {'), "The Changelog title hover must not animate while Changelog is the active page.");
invariant(!footer.includes('transform: translateY(-1px);'), "The footer title hover must not shift vertically.");
invariant(!footer.includes('transition: color var(--mfl-motion-fast, 120ms) ease, transform'), "The footer title hover must not animate transforms.");
invariant(!footer.includes('margin-top: clamp(40px, 6vh, 64px);'), "Footer spacing must be anchored from the page viewport, not inflated after the preceding content.");
invariant(!footer.includes('grid-template-columns: auto minmax(0, 1fr) auto;'), "Desktop footer metadata must not size its side columns from changing content.");
invariant(!footer.includes('.siteFooter a['), "footer.css must not retain the removed compact footer owner.");

for (const token of [
  '@media (max-width: 900px)',
  '@media (max-width: 520px)',
  '@media (max-width: 380px)',
  '.siteFooterDetailsCreatorDiscord,',
  '.siteFooterDetailsInner {\n    grid-template-columns: 1fr;',
  '.siteFooterDetailsNavigation {\n    grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.siteFooterDetailsMeta {\n    grid-template-columns: minmax(0, 1fr) auto;',
  '.siteFooterDetailsMeta {\n    grid-template-columns: 1fr;',
]) {
  invariant(responsive.includes(token), `Responsive single-footer contract is missing: ${token}`);
}

for (const owner of [staticUi, bootstrap, shared]) {
  invariant(owner.includes('.siteFooterDetails a[href="/changelog"], .siteFooterDetails a[data-page="changelog"]'), "Version/Changelog behavior must target the sole footer.");
  invariant(!owner.includes('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]'), "Legacy compact-footer behavior must be removed.");
}
invariant(selectionStack.includes('document.querySelector(".siteFooterDetails")'), "Selection overlays must avoid the sole footer when it enters the viewport.");
invariant(!selectionStack.includes('document.querySelector(".siteFooter")'), "Selection overlays must not retain the removed footer owner.");

invariant(!footer.includes("!important"), "Footer redesign must not introduce !important.");
invariant(!responsive.includes(".siteFooterDetails.siteFooterDetails"), "Footer redesign must not use specificity-boosting override selectors.");
invariant(!stylesBase.includes(".siteFooterDetails"), "Single-footer structure must remain owned by footer.css, not styles-base.css.");

console.log("Single bottom footer validation passed with direct Player loading in real normal flow, non-Player unresolved fallback geometry, and independent Creator row alignment.");
