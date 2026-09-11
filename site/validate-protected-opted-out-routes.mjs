import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const appConfig = read("./modules/app-config.js");
const routing = read("./modules/core-sources/shared-routing.js");
const session = read("./modules/core-sources/shared-session.js");
const pageLifecycle = read("./modules/core-sources/shared-page-lifecycle.js");
const wallet = read("./modules/core-sources/wallet.js");
const access = read("./html-sources/access.html");
const firstPaint = read("./html-sources/first-paint.html");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

for (const [page, path] of [
  ["myplayers", "/my-players/opted-out"],
  ["my-clubs", "/my-clubs/opted-out"],
  ["watchlist", "/watchlist/opted-out"],
  ["settings", "/settings/opted-out"],
]) {
  const configKey = page.includes("-") ? `"${page}"` : page;
  invariant(appConfig.includes(`${configKey}: "${path}"`), `${page} must own canonical opted-out path ${path}.`);
  invariant(routing.includes(`options: { replaceUrl: optedOutPathForPage("${page}") }`), `${page} signed-out routes must canonicalize to their opted-out URL.`);
}

invariant(
  appConfig.includes("Object.entries(data.routes.protectedOptedOutPaths)")
    && appConfig.includes("return requestResult(path, optedOutEntry[0], { optedOut: true }, optedOutEntry[1]);"),
  "The pre-core canonical router must recognize every opted-out route instead of classifying it as not found.",
);
invariant(
  routing.includes("const optedOutPage = optedOutPageFromPath(cleanPath);")
    && routing.includes("if (optedOutPage) {")
    && routing.includes("const defaultPath = defaultProtectedRoutePath(optedOutPage);"),
  "The application router must preserve opted-out page identity and canonicalize signed-in visits to that page's default protected route.",
);
invariant(
  routing.includes('if (optedOutPageFromPath(pathName) === "watchlist") {\n    return { watchlistId: "", view: "" };'),
  "The Watchlist parser must never treat opted-out as a watchlist ID.",
);
invariant(
  routing.includes("const optedOutPath = optedOutPathForPage(pageName);\n    if (optedOutPath) return optedOutPath;"),
  "Protected navigation while signed out must use the canonical opted-out URL.",
);

const optOutStart = session.indexOf("function optOutWallet() {");
const optOutEnd = session.indexOf("\nfunction walletAccessMessage()", optOutStart);
invariant(optOutStart >= 0 && optOutEnd > optOutStart, "Wallet opt-out owner must exist.");
const optOut = session.slice(optOutStart, optOutEnd);
invariant(
  optOut.includes('const protectedReturnPath = `${window.location.pathname}${window.location.search}`;')
    && optOut.includes("const optedOutPath = optedOutPathForPage(lockedPage);")
    && optOut.includes("mflProtectedReturnPath: protectedReturnPath")
    && optOut.includes("window.history.replaceState("),
  "Protected opt-out must replace the live route with its canonical opted-out URL while remembering the exact return route.",
);
invariant(
  optOut.indexOf("window.history.replaceState(") < optOut.indexOf("setPage(lockedPage, false, { ...lockedOptions, preserveScroll: true });"),
  "The opted-out URL must become authoritative before the locked page is rendered.",
);

invariant(
  pageLifecycle.includes('if (options.replaceUrl && `${window.location.pathname}${window.location.search}` !== options.replaceUrl)')
    && pageLifecycle.includes("updatePageUrl(pageName, { ...options, updateUrl: updateHash && !options.replaceUrl });"),
  "Locked protected routes must participate in canonical replace/push URL handling rather than preserving authenticated URLs.",
);

invariant(
  wallet.includes("historyState.mflProtectedReturnPath")
    && wallet.includes("defaultProtectedRoutePath(protectedPage)")
    && wallet.includes("await setPage(protectedPage, false, targetOptions);")
    && wallet.includes('window.history.replaceState({}, "", restoredPath);'),
  "Opt-in from an opted-out page must restore its remembered route or page-specific default after the page loads.",
);

for (const copy of [
  'myplayers: ["My Players", "In order to see your players, you need to opt in."]',
  '"my-clubs": ["My Clubs", "In order to see your clubs, you need to opt in."]',
  'watchlist: ["Watchlist", "In order to use the watchlist, you need to opt in."]',
  'settings: ["Settings", "In order to view settings, you need to opt in."]',
]) {
  invariant(access.includes(copy), `Protected opted-out first paint must retain distinct copy: ${copy}`);
}
invariant(
  firstPaint.includes("root.dataset.initialLockedPage = initialLockedPage;")
    && firstPaint.includes('[data-initial-page^="watchlist"]')
    && firstPaint.includes('[data-initial-page^="my-players"]')
    && firstPaint.includes('[data-initial-page^="my-clubs"]')
    && firstPaint.includes('[data-initial-page="settings"]'),
  "First paint must continue selecting the locked shell from the requested protected route.",
);

console.log("Canonical protected opted-out route validation passed.");
