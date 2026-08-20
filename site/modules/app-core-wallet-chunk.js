// @ts-check

import {
  extractRequiredSections,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  renameRequiredFunctionOwner,
} from "./app-core-splitter-utils.js";

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

const WALLET_ROUTE_ONLY_FUNCTIONS = [
  "appOrigin",
  "recordWalletOptIn",
  "loadWalletNames",
  "refreshLinkedWalletAgentName",
  "authenticatedWalletUser",
  "signatureWalletAddress",
  "mergeGuestWatchlistIntoAccount",
  "refreshWatchlistPageAfterWalletSync",
  "upgradeCurrentPageAfterWalletOptIn",
];

const WALLET_SECTIONS = [
  ["function walletAccessNonce() {", "function restoreLinkedWalletProof() {", "Wallet account-proof and signing helpers"],
  ["function configureFlowWallet(", "function openAccountMenu() {", "Wallet Flow authentication and opt-in owner"],
];

export function splitWalletApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core: inputCore } = normalizeSplitterInput(
    artifacts,
    "wallet",
    "Wallet ownership",
  );
  if (alreadySplit) return artifacts;

  const routeOnly = extractRequiredFunctions(inputCore, WALLET_ROUTE_ONLY_FUNCTIONS, "Wallet route-only helper");
  const extracted = extractRequiredSections(routeOnly.core, WALLET_SECTIONS);
  let core = insertBeforeRequiredMarker(
    extracted.core,
    "function restoreLinkedWalletProof() {",
    WALLET_FACADE_BLOCK,
    "Wallet facade",
  );

  let wallet = [...routeOnly.chunks, ...extracted.chunks].join("\n\n").replace(/\s*$/, "");
  wallet = renameRequiredFunctionOwner(wallet, "linkWallet", "walletLinkOwner", "Wallet linkWallet");
  wallet = `${wallet}\n\n${WALLET_OWNER_ASSIGNMENTS}`;

  return finalizeSplitArtifacts(core, routeChunks, "wallet", wallet, "Wallet");
}
