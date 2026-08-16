// @ts-check

function extractRequiredWalletSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split Wallet application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

function renameRequiredWalletOwner(source, functionName, ownerName) {
  const asyncMarker = `async function ${functionName}(`;
  const marker = `function ${functionName}(`;
  if (source.includes(asyncMarker)) {
    return source.replace(asyncMarker, `async function ${ownerName}(`);
  }
  if (source.includes(marker)) {
    return source.replace(marker, `function ${ownerName}(`);
  }
  throw new Error(`Could not delegate Wallet application core owner: ${functionName}.`);
}

const WALLET_FACADE_BLOCK = `let __mflWalletLinkOwner = null;

async function linkWallet() {
  if (typeof __mflWalletLinkOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("wallet");
  }
  if (typeof __mflWalletLinkOwner !== "function") {
    throw new Error("Wallet opt-in owner is unavailable.");
  }
  return __mflWalletLinkOwner.apply(this, arguments);
}`;

const WALLET_OWNER_ASSIGNMENTS = `__mflWalletLinkOwner = walletLinkOwner;`;

export function splitWalletApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(routeChunks.wallet || "").trim()) return artifacts;

  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split Wallet ownership from an empty application core.");
  }

  const walletParts = [];
  const proofHelpers = extractRequiredWalletSection(
    core,
    "function walletAccessNonce() {",
    "function restoreLinkedWalletProof() {",
    "Wallet account-proof and signing helpers",
  );
  core = proofHelpers.core;
  walletParts.push(proofHelpers.chunk);

  const optInOwner = extractRequiredWalletSection(
    core,
    "function configureFlowWallet(",
    "function openAccountMenu() {",
    "Wallet Flow authentication and opt-in owner",
  );
  core = optInOwner.core;
  walletParts.push(optInOwner.chunk);

  const facadeMarker = "function restoreLinkedWalletProof() {";
  const facadeIndex = core.indexOf(facadeMarker);
  if (facadeIndex < 0) {
    throw new Error("Could not locate the Wallet facade insertion point.");
  }
  core = `${core.slice(0, facadeIndex)}${WALLET_FACADE_BLOCK}\n\n${core.slice(facadeIndex)}`;

  let wallet = walletParts.join("\n\n").replace(/\s*$/, "");
  wallet = renameRequiredWalletOwner(wallet, "linkWallet", "walletLinkOwner");
  wallet = `${wallet}\n\n${WALLET_OWNER_ASSIGNMENTS}`;

  const normalizedCore = core.replace(/\s*$/, "");
  if (!wallet.trim() || !normalizedCore) {
    throw new Error("Wallet application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, wallet: wallet.replace(/\s*$/, "") }),
  });
}
