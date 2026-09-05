import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [indexHtml, footer, responsive, stylesBase, staticUi, bootstrap, shared, selectionStack] = await Promise.all([
  read("./index.html"),
  read("./footer.css"),
  read("./responsive.css"),
  read("./styles-base.css"),
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
  '>Report a bug</a>',
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
  'main > .pageView:not([hidden]) {',
  'min-height: max(calc(100% - 22px), calc(100dvh - var(--pinned-topbar-height) - 22px));',
  '.siteFooterDetails {',
  'margin-top: 22px;',
  '.siteFooterDetailsInner {',
  '.siteFooterDetailsNavigation {',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.siteFooterDetails a[href="/changelog"]',
  '.siteFooterDetails a[data-page="changelog"]',
  'margin-top: 0;',
  'font-size: 14px;',
  'font-weight: 800;',
  'cursor: default;',
  'transition: color var(--mfl-motion-fast, 120ms) ease;',
  'body:not([data-page="changelog"]) .siteFooterDetails a[href="/changelog"]:hover,',
  'body:not([data-page="changelog"]) .siteFooterDetails a[data-page="changelog"]:hover {',
  'color: var(--primary);',
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
invariant(
  !footer.includes('min-height: calc(100% - 22px);'),
  "Footer placement must not rely only on the active route's percentage height; short routes such as Player pages need the shared viewport floor.",
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

console.log("Single bottom footer validation passed.");
