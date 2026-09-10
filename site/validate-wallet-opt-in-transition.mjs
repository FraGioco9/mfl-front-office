import fs from "node:fs";

const walletSource = fs.readFileSync(
  new URL("./modules/core-sources/wallet.js", import.meta.url),
  "utf8",
);
const routeGateSource = fs.readFileSync(
  new URL("./modules/core-sources/shared-route-runtime-gate.js", import.meta.url),
  "utf8",
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const ownerStart = walletSource.indexOf("async function walletLinkOwner() {");
const ownerEnd = walletSource.indexOf("\n}\n\n__mflWalletLinkOwner = walletLinkOwner;", ownerStart);
invariant(ownerStart >= 0 && ownerEnd > ownerStart, "Wallet opt-in owner must remain in the canonical wallet source.");
const owner = walletSource.slice(ownerStart, ownerEnd);

const routePageIndex = owner.indexOf("const optedOutPage = optedOutPageFromPath(window.location.pathname);");
const rememberedRouteIndex = owner.indexOf("historyState.mflProtectedReturnPath", routePageIndex);
const progressIndex = owner.indexOf("state.walletOptInInProgress = true;");
invariant(
  routePageIndex >= 0 && rememberedRouteIndex > routePageIndex && rememberedRouteIndex < progressIndex,
  "Protected opted-out route intent must be captured before asynchronous wallet opt-in begins.",
);
invariant(
  owner.includes('const protectedPages = ["myplayers", "watchlist", "settings"];'),
  "Protected route capture must cover every opt-in-gated page.",
);

const stickyIndex = owner.indexOf('showToast("Opting in...", { sticky: true });');
const proofIndex = owner.indexOf("state.linkedWalletProof = linkedWalletProof;");
const preferencesIndex = owner.indexOf("await loadWalletPreferences();");
const successIndex = owner.indexOf('showToast(optInRecord?.warning ? "Successful opt-in. Supabase opt-in list was not updated." : "Successful opt-in.");');
invariant(
  stickyIndex >= 0 && proofIndex > stickyIndex && preferencesIndex > proofIndex && successIndex > preferencesIndex,
  "The sticky Opting in toast must remain active through proof and post-auth synchronization until final success.",
);
invariant(
  !owner.includes("hideToast();"),
  "Wallet opt-in must not clear the sticky in-progress toast before success or failure is known.",
);

const fallbackIndex = owner.indexOf("defaultProtectedRoutePath(protectedPage)");
const targetIndex = owner.indexOf("protectedTarget = pageTargetFromPath(targetPath);");
const pageLoadIndex = owner.indexOf("await setPage(protectedPage, false, targetOptions);");
invariant(
  fallbackIndex >= 0 && targetIndex > fallbackIndex && pageLoadIndex > targetIndex,
  "Successful opt-in must parse and load the remembered or default protected route through the canonical page loader.",
);
invariant(
  !owner.includes("!myPlayersLockedPage.hidden"),
  "Protected-route reload must not depend on delayed locked-shell visibility.",
);

const gateStart = routeGateSource.indexOf("async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {");
const linkedUpgradeIndex = routeGateSource.indexOf("const optedOutUpgradePage = hasWalletOptIn() ? optedOutPageFromPath(window.location.pathname) : \"\";", gateStart);
const replaceTargetIndex = routeGateSource.indexOf("? { ...suppliedOptions, replaceUrl: pagePath(pageName, suppliedOptions) }", linkedUpgradeIndex);
const transitionIndex = routeGateSource.indexOf('return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);', replaceTargetIndex);
invariant(
  gateStart >= 0 && linkedUpgradeIndex > gateStart && replaceTargetIndex > linkedUpgradeIndex && transitionIndex > replaceTargetIndex,
  "A linked opted-out route must replace its URL with the signed-in destination before the route transition starts, so the navigation guard cannot cancel content loading on an opted-out URL mismatch.",
);

console.log("Wallet opt-in protected-route transition validation passed.");
