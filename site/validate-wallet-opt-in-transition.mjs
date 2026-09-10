import fs from "node:fs";

const walletSource = fs.readFileSync(
  new URL("./modules/core-sources/wallet.js", import.meta.url),
  "utf8",
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const ownerStart = walletSource.indexOf("async function walletLinkOwner() {");
const ownerEnd = walletSource.indexOf("\n}\n\n__mflWalletLinkOwner = walletLinkOwner;", ownerStart);
invariant(ownerStart >= 0 && ownerEnd > ownerStart, "Wallet opt-in owner must remain in the canonical wallet source.");
const owner = walletSource.slice(ownerStart, ownerEnd);

const captureIndex = owner.indexOf("const protectedRoutePath =");
const progressIndex = owner.indexOf("state.walletOptInInProgress = true;");
invariant(
  captureIndex >= 0 && captureIndex < progressIndex,
  "Protected route intent must be captured before asynchronous wallet opt-in begins.",
);
invariant(
  owner.includes('["myplayers", "watchlist", "settings"].includes(state.currentPage)'),
  "Protected route capture must cover every opt-in-gated page.",
);

const proofIndex = owner.indexOf("state.linkedWalletProof = linkedWalletProof;");
const hideIndex = owner.indexOf("hideToast();", proofIndex);
const recordIndex = owner.indexOf("const optInRecord = await recordWalletOptIn();");
invariant(
  proofIndex >= 0 && hideIndex > proofIndex && recordIndex > hideIndex,
  "The sticky Opting in toast must be cleared immediately after wallet proof succeeds, before slower post-opt-in sync.",
);

const targetIndex = owner.indexOf("const protectedTarget = pageTargetFromPath(protectedRoutePath);");
const pageLoadIndex = owner.indexOf("await setPage(protectedTarget.pageName, false, protectedTarget.options || {});");
invariant(
  targetIndex >= 0 && pageLoadIndex > targetIndex,
  "Successful opt-in must parse and load the captured protected route through the canonical router.",
);
invariant(
  !owner.includes("!myPlayersLockedPage.hidden"),
  "Protected-route reload must not depend on delayed locked-shell visibility.",
);

console.log("Wallet opt-in protected-route transition validation passed.");
