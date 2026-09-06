import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => { if (!source.includes(token)) throw new Error(message); };

const [indexHtml, appConfig, shared, club, bootstrap, staticUi, bugReportRuntime, titles, styles, footer] = await Promise.all([
  read("./index.html"),
  read("./modules/app-config.js"),
  read("./modules/core-sources/shared.js"),
  read("./modules/core-sources/club.js"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./bug-report-runtime.js"),
  read("./document-title-runtime.js"),
  read("./styles-base.css"),
  read("./footer.css"),
]);

for (const token of [
  '<section id="privacyPage" class="pageView privacyPage" hidden>',
  '<h2>Privacy</h2>',
  '<span>Information</span>',
  '<a href="/privacy" data-page="privacy">Privacy</a>',
  'Data used by the site',
  'Browser data',
  'Shared and submitted content',
  'Public and reference data',
  'information you provide, choices you make, and identifiers',
  'browser\'s site-data controls',
  'public link can be viewed by people who have that link',
]) includes(indexHtml, token, `Privacy page contract is missing: ${token}`);

includes(appConfig, 'requestResult(path, "privacy", {}, "/privacy")', "Canonical app config must own /privacy.");
includes(shared, 'const privacyPage = document.querySelector("#privacyPage");', "Application core must own the Privacy page element.");
includes(shared, 'privacyPage.hidden = pageName !== "privacy";', "Application core must show Privacy only on the Privacy route.");
includes(club, 'privacyPage.hidden = true;', "Club navigation must hide Privacy when leaving the static route.");
includes(bootstrap, 'initialPage === "privacy"', "Bootstrap must resolve Privacy on direct first paint.");
includes(staticUi, 'state.page === "privacy"', "Static UI must resolve Privacy before app-core hydration.");
includes(titles, 'privacy: "Privacy"', "Document-title runtime must name Privacy.");
includes(styles, '/* Privacy static page. */', "Privacy must have one canonical static-page style owner.");
includes(styles, 'data-initial-page="privacy"', "Privacy direct refresh must have a first-paint CSS contract.");
includes(footer, 'grid-template-columns: repeat(3, minmax(0, 1fr));', "Desktop footer must provide a dedicated Information column.");
includes(footer, 'body[data-page="privacy"] .siteFooterDetails a[data-page="privacy"] {', "Active Privacy footer link must have a route-scoped non-interactive state.");
includes(footer, 'cursor: default;', "Active Privacy footer link must not show the pointer cursor.");
includes(footer, 'pointer-events: none;', "Active Privacy footer link must not accept pointer clicks.");

for (const token of [
  'const PRIVACY_LINK_SELECTOR = \' .siteFooterDetails a[href="/privacy"][data-page="privacy"]\';'.replace("' .", "'."),
  'function privacyLinkFromTarget(target)',
  'function handlePrivacyNavigation(event)',
  'event.preventDefault();',
  'event.stopImmediatePropagation();',
  'const setPage = Reflect.get(window, "setPage");',
  'void Promise.resolve(setPage("privacy", true));',
  'document.addEventListener("click", handlePrivacyNavigation, true);',
  'document.removeEventListener("click", handlePrivacyNavigation, true);',
]) includes(bugReportRuntime, token, `Privacy footer SPA navigation is missing: ${token}`);

if (styles.includes('.privacyPage.privacyPage') || styles.includes('!important')) throw new Error("Privacy styling must not use specificity overrides or !important.");

console.log("Privacy page, direct routing, first-paint, title, footer link, and in-app no-repaint navigation validation passed.");
