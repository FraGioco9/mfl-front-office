import { readFile, writeFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const write = async (path, content) => writeFile(new URL(path, import.meta.url), content);

let indexHtml = await read("./index.html");
let responsive = await read("./responsive.css");
let staticUi = await read("./static-ui-runtime.js");
let bootstrap = await read("./bootstrap.js");
let shared = await read("./modules/core-sources/shared.js");
let selectionStack = await read("./selection-stack-runtime.js");
let controlValidator = await read("./validate-control-style-ownership.mjs");
let domainValidator = await read("./validate-domain-shared-ui.mjs");

const oldFooter = `        <section id="changelogPage" class="pageView changelogPage" hidden>\n          <h2>Changelog</h2>\n          <p>All pushed updates for MFL Front Office, newest first.</p>\n          <ol class="changelogList" hidden data-history-loading="true"></ol>\n        </section>\n      </main>\n    </div>\n\n    <footer class="siteFooter">\n      <a href="/changelog" data-page="changelog">MFL Front Office v1.127.8</a>\n      <span id="statusText">Updated -</span>\n    </footer>`;
const newFooter = `        <section id="changelogPage" class="pageView changelogPage" hidden>\n          <h2>Changelog</h2>\n          <p>All pushed updates for MFL Front Office, newest first.</p>\n          <ol class="changelogList" hidden data-history-loading="true"></ol>\n        </section>\n\n        <footer class="siteFooterDetails" aria-labelledby="siteFooterDetailsTitle">\n          <div class="siteFooterDetailsInner">\n            <div class="siteFooterDetailsIdentity">\n              <strong id="siteFooterDetailsTitle" class="siteFooterDetailsTitle">MFL Front Office</strong>\n              <p>Management, scouting, progression, and evaluation tools for MFL.</p>\n            </div>\n\n            <nav class="siteFooterDetailsNavigation" aria-label="Footer information">\n              <div class="siteFooterDetailsGroup">\n                <span>Resources</span>\n                <a href="/changelog" data-page="changelog">MFL Front Office v1.127.8</a>\n                <a href="https://github.com/FraGioco9/mfl-front-office" target="_blank" rel="noreferrer">Source code</a>\n              </div>\n              <div class="siteFooterDetailsGroup">\n                <span>Support</span>\n                <a href="https://github.com/FraGioco9/mfl-front-office/issues/new" target="_blank" rel="noreferrer">Report a bug</a>\n              </div>\n              <div class="siteFooterDetailsGroup">\n                <span>Creator</span>\n                <a href="https://github.com/FraGioco9" target="_blank" rel="noreferrer">FraGioco9</a>\n              </div>\n            </nav>\n\n            <div class="siteFooterDetailsMeta">\n              <span id="statusText">Updated -</span>\n              <span class="siteFooterDetailsDisclaimer">Independent community tool. Not an official MFL product.</span>\n              <span class="siteFooterDetailsCopyright">© 2026 MFL Front Office</span>\n            </div>\n          </div>\n        </footer>\n      </main>\n    </div>`;
if (!indexHtml.includes(oldFooter)) throw new Error("Could not find latest-main compact footer markup.");
indexHtml = indexHtml.replace(oldFooter, newFooter);

const marker = "/* Issue #603: intentional responsive footer presentation. */";
if (responsive.includes(marker)) throw new Error("Responsive footer block already exists unexpectedly.");
responsive = responsive.trimEnd() + `\n\n\n${marker}\n@media (max-width: 900px) {\n  .siteFooterDetails {\n    margin-top: 18px;\n    padding: 16px 0 12px;\n  }\n\n  .siteFooterDetailsInner {\n    grid-template-columns: minmax(200px, 0.9fr) minmax(0, 1.1fr);\n    gap: 18px;\n  }\n\n  .siteFooterDetailsNavigation {\n    gap: 12px;\n  }\n\n  .siteFooterDetailsIdentity p,\n  .siteFooterDetailsGroup a {\n    font-size: 10px;\n  }\n}\n\n@media (max-width: 520px) {\n  .siteFooterDetails {\n    margin-top: 14px;\n    padding: 14px 0 10px;\n  }\n\n  .siteFooterDetailsInner {\n    grid-template-columns: 1fr;\n    gap: 10px;\n  }\n\n  .siteFooterDetailsNavigation {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 10px;\n  }\n\n  .siteFooterDetailsTitle {\n    font-size: 12px;\n  }\n\n  .siteFooterDetailsIdentity p {\n    max-width: none;\n    font-size: 9px;\n  }\n\n  .siteFooterDetailsGroup > span {\n    font-size: 8px;\n  }\n\n  .siteFooterDetailsGroup a {\n    font-size: 9px;\n  }\n\n  .siteFooterDetails a[href=\"/changelog\"],\n  .siteFooterDetails a[data-page=\"changelog\"] {\n    font-size: 10px;\n  }\n\n  .siteFooterDetailsMeta {\n    grid-template-columns: minmax(0, 1fr) auto;\n    gap: 5px 10px;\n    font-size: 8px;\n  }\n\n  .siteFooterDetailsDisclaimer {\n    grid-column: 1 / -1;\n    grid-row: 2;\n    text-align: left;\n  }\n}\n\n@media (max-width: 380px) {\n  .siteFooterDetails {\n    margin-top: 12px;\n    padding: 12px 0 9px;\n  }\n\n  .siteFooterDetailsInner {\n    gap: 8px;\n  }\n\n  .siteFooterDetailsNavigation {\n    gap: 7px;\n  }\n\n  .siteFooterDetailsTitle {\n    font-size: 11px;\n  }\n\n  .siteFooterDetailsIdentity p,\n  .siteFooterDetailsGroup a {\n    font-size: 8px;\n  }\n\n  .siteFooterDetails a[href=\"/changelog\"],\n  .siteFooterDetails a[data-page=\"changelog\"] {\n    font-size: 9px;\n  }\n\n  .siteFooterDetailsGroup > span {\n    font-size: 7px;\n  }\n\n  .siteFooterDetailsMeta {\n    grid-template-columns: 1fr;\n    gap: 3px;\n    font-size: 8px;\n  }\n\n  .siteFooterDetailsDisclaimer {\n    grid-column: 1;\n    grid-row: auto;\n  }\n}\n`;

const oldBehaviorSelector = '.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]';
const newBehaviorSelector = '.siteFooterDetails a[href="/changelog"], .siteFooterDetails a[data-page="changelog"]';
for (const [name, source] of [["static UI", staticUi], ["bootstrap", bootstrap], ["shared core", shared]]) {
  if (!source.includes(oldBehaviorSelector)) throw new Error(`Could not find ${name} compact-footer selector.`);
}
staticUi = staticUi.replaceAll(oldBehaviorSelector, newBehaviorSelector);
bootstrap = bootstrap.replaceAll(oldBehaviorSelector, newBehaviorSelector);
shared = shared.replaceAll(oldBehaviorSelector, newBehaviorSelector);

if (!selectionStack.includes('document.querySelector(".siteFooter")')) throw new Error("Could not find selection compact-footer selector.");
selectionStack = selectionStack.replace('document.querySelector(".siteFooter")', 'document.querySelector(".siteFooterDetails")');

const oldControlTokens = `  '.siteFooter a[href="/changelog"]',\n  '.siteFooter a[data-page="changelog"]',\n  "font-size: 14px;",`;
const newControlTokens = `  '.siteFooterDetails a[href="/changelog"]',\n  '.siteFooterDetails a[data-page="changelog"]',\n  "font-size: 11px;",`;
if (!controlValidator.includes(oldControlTokens)) throw new Error("Could not find compact-footer control ownership tokens.");
controlValidator = controlValidator.replace(oldControlTokens, newControlTokens);

if (!domainValidator.includes('  "validate-theme-icons.mjs",\n];')) throw new Error("Could not find shared UI validator tail.");
domainValidator = domainValidator.replace('  "validate-theme-icons.mjs",\n];', '  "validate-theme-icons.mjs",\n  "validate-footer-redesign.mjs",\n];');

await Promise.all([
  write("./index.html", indexHtml),
  write("./responsive.css", responsive),
  write("./static-ui-runtime.js", staticUi),
  write("./bootstrap.js", bootstrap),
  write("./modules/core-sources/shared.js", shared),
  write("./selection-stack-runtime.js", selectionStack),
  write("./validate-control-style-ownership.mjs", controlValidator),
  write("./validate-domain-shared-ui.mjs", domainValidator),
]);
