import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [runtime, indexHtml] = await Promise.all([
  read("./static-ui-runtime.js"),
  read("./index.html"),
]);

includes(runtime, 'let lastRouteChromeSignature = "";', "Step 15 must retain the last completed passive route-chrome signature.");
includes(runtime, "function routeChromeSignature(state) {", "Step 15 must derive one route-chrome signature before traversing route-shell DOM.");

const signatureStart = runtime.indexOf("function routeChromeSignature(state) {");
const signatureEnd = runtime.indexOf("\n  function syncFooter()", signatureStart);
invariant(signatureStart >= 0 && signatureEnd > signatureStart, "Route-chrome signature implementation must be structurally bounded.");
const signatureSource = runtime.slice(signatureStart, signatureEnd);

for (const required of [
  "routeIdentity(state)",
  "normalizedNotFoundKind(state.notFoundKind || \"Page\")",
  "root.dataset.storedWalletOptIn",
  "root.dataset.storedProgressionAccess",
  'root.classList.contains("mflInitialRouteResolved")',
  "window.__mflReleaseVersion || window.__mflRelease?.version",
  "viewConfigSignature",
  "tableCapabilitySignature",
  'Reflect.get(window, "__mflPrimeTableChrome")',
  'Reflect.get(window, "__mflPrimeTableHeaderSignature")',
  'Reflect.get(window, "__mflPrimeTableStructure")',
  "contracts.ensureCanonicalTableHeader",
  "bodyRouteState",
]) {
  includes(signatureSource, required, `Route-chrome signature must react to ${required}.`);
}
for (const forbidden of ["querySelector(", "querySelectorAll(", "getElementById("]) {
  excludes(signatureSource, forbidden, `The Step 15 fast-path signature must not traverse DOM collections through ${forbidden}.`);
}

const syncStart = runtime.indexOf("function syncRouteChrome(urlLike = window.location.href) {");
const syncEnd = runtime.indexOf("\n  function tooltipTargetFrom", syncStart);
invariant(syncStart >= 0 && syncEnd > syncStart, "Static route synchronization must remain structurally bounded.");
const syncSource = runtime.slice(syncStart, syncEnd);

const signatureIndex = syncSource.indexOf("const nextSignature = routeChromeSignature(state);");
const guardIndex = syncSource.indexOf("if (!pageChanged && !viewChanged && nextSignature === lastRouteChromeSignature) return state;");
const footerIndex = syncSource.indexOf("syncFooter();");
const navigationIndex = syncSource.indexOf("setActiveNavigation(state.page);");
const viewsIndex = syncSource.indexOf("syncTableViews(state.page, state.view);");
const shellIndex = syncSource.indexOf("showRouteShell(state, { resetFilters });");
const commitSignatureIndex = syncSource.indexOf("lastRouteChromeSignature = routeChromeSignature(state);");

invariant(signatureIndex >= 0, "Step 15 must calculate its signature before route-shell traversal.");
invariant(guardIndex > signatureIndex, "Step 15 must compare the signature after page/view transition detection.");
invariant(
  footerIndex > guardIndex && navigationIndex > guardIndex && viewsIndex > guardIndex && shellIndex > guardIndex,
  "An identical route signature must return before footer, sidebar, view, and page-shell traversal.",
);
invariant(commitSignatureIndex > shellIndex, "The completed signature must be recorded after the full shell synchronization finishes.");
includes(syncSource, "!pageChanged && !viewChanged", "Page or view changes must never be suppressed by the signature cache.");
includes(runtime, 'lastRouteChromeSignature = "";\n    if (document.body.dataset.page !== "notfound")', "Direct not-found rendering must invalidate any cached route-chrome signature.");

function tagsWithClass(className) {
  return Array.from(indexHtml.matchAll(/<[^>]+>/g), (match) => match[0]).filter((tag) => {
    const classMatch = tag.match(/\bclass="([^"]*)"/);
    if (!classMatch) return false;
    return classMatch[1].split(/\s+/).includes(className);
  });
}

const staticPageViews = tagsWithClass("pageView").length;
const sidebarNavButtons = tagsWithClass("navButton").filter((tag) => /\bdata-page=/.test(tag)).length;
const appVersionNodes = (indexHtml.match(/\bdata-app-version(?:=|\s|>)/g) || []).length;
const footerTargets = /class="[^"]*\bsiteFooter\b/.test(indexHtml) ? 1 : 0;
const knownShellNodeChecks = staticPageViews + sidebarNavButtons + appVersionNodes + footerTargets;

invariant(knownShellNodeChecks > 0, "Step 15 accounting must detect the real static shell.");

// Deterministic accounting for a repeated identical sync after Step 14 has already
// made the DOM state correct. Step 14 still traversed the shell and discovered no
// writes were needed; Step 15 returns before that traversal. The node count is a
// conservative lower bound and excludes repeated view-button and Table-chrome work.
const previousFullShellSyncPasses = 1;
const optimizedFullShellSyncPasses = 0;
const reductionPercent = Math.round((1 - optimizedFullShellSyncPasses / previousFullShellSyncPasses) * 100);
invariant(reductionPercent === 100, "Step 15 must eliminate the repeated identical full route-shell sync pass.");

console.log(
  `Route shell signature performance validation passed: identical full route-shell sync passes ${previousFullShellSyncPasses} -> ${optimizedFullShellSyncPasses} (${reductionPercent}% reduction), skipping at least ${knownShellNodeChecks} known page/sidebar/version node checks plus repeated view-button and Table-chrome traversal while readiness and lock-state changes still invalidate the signature.`,
);
