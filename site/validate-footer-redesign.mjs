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
  '<strong id="siteFooterDetailsTitle" class="siteFooterDetailsTitle">MFL Front Office</strong>',
  'Management, scouting, progression, and evaluation tools for MFL.',
  '<nav class="siteFooterDetailsNavigation" aria-label="Footer information">',
  '<span>Resources</span>',
  '>Source code</a>',
  '<span>Support</span>',
  '>Report a bug</a>',
  '<span>Creator</span>',
  '>FraGioco9</a>',
  '<span id="statusText">Updated -</span>',
  'Independent community tool. Not an official MFL product.',
  '© 2026 MFL Front Office',
]) {
  invariant(indexHtml.includes(token), `Single footer markup is missing: ${token}`);
}

invariant(
  /<a href="\/changelog" data-page="changelog">MFL Front Office v\d+\.\d+\.\d+<\/a>/.test(indexHtml),
  "The sole footer must expose the generated version as its Changelog link.",
);
invariant(!indexHtml.includes('<footer class="siteFooter">'), "The legacy compact footer must be removed from the DOM.");
invariant((indexHtml.match(/id="statusText"/g) || []).length === 1, "Data freshness must have exactly one footer owner.");

const detailsIndex = indexHtml.indexOf('<footer class="siteFooterDetails"');
const mainCloseIndex = indexHtml.indexOf("      </main>", detailsIndex);
invariant(detailsIndex >= 0 && mainCloseIndex > detailsIndex, "The sole footer must remain at the end of the main scroll surface.");

for (const token of [
  '.siteFooterDetails {',
  '.siteFooterDetailsInner {',
  '.siteFooterDetailsNavigation {',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.siteFooterDetails a[href="/changelog"]',
  '.siteFooterDetails a[data-page="changelog"]',
  'font-size: 11px;',
  '.siteFooterDetailsMeta {',
  'grid-template-columns: auto minmax(0, 1fr) auto;',
  '.siteFooterDetails #statusText {',
  'border-top: 1px solid var(--border);',
  'outline: 2px solid var(--primary);',
]) {
  invariant(footer.includes(token), `Canonical single-footer styling is missing: ${token}`);
}
invariant(!footer.includes('.siteFooter a['), "footer.css must not retain the removed compact footer owner.");

for (const token of [
  '@media (max-width: 900px)',
  '@media (max-width: 520px)',
  '@media (max-width: 380px)',
  '.siteFooterDetailsInner {\n    grid-template-columns: 1fr;',
  '.siteFooterDetailsNavigation {\n    grid-template-columns: repeat(3, minmax(0, 1fr));',
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
