import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, walletSplitter, appConfig, routeLoader, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-wallet-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const walletCore = String(artifacts.routeChunks?.wallet || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Wallet split.");
invariant(walletCore.length > 6_000, "The Wallet core chunk is too small to represent the Dapper opt-in owner.");
new Function(sharedCore);
new Function(walletCore);

includes(walletSplitter, '"Wallet account-proof and signing helpers"', "The Wallet splitter must extract account-proof/signing helpers.");
includes(walletSplitter, '"Wallet Flow authentication and opt-in owner"', "The Wallet splitter must extract Flow authentication and opt-in ownership.");
includes(walletSplitter, "finalizeSplitArtifacts(", "The Wallet splitter must use canonical split-result finalization.");
includes(walletSplitter, '"wallet"', "The Wallet splitter must publish the Wallet chunk through canonical finalization.");

includes(sharedCore, "function walletAccessMessage() {", "The shared core must retain the stable wallet proof message used during startup restoration.");
includes(sharedCore, "function restoreLinkedWalletProof() {", "Saved wallet-proof restoration must remain in shared startup core.");
includes(sharedCore, "function optOutWallet() {", "Opt-out must remain immediately available without loading the Wallet opt-in chunk.");
includes(sharedCore, "let __mflWalletLinkOwner = null;", "The shared core must retain the stable Wallet facade state.");
includes(sharedCore, "async function linkWallet() {", "The shared core must retain the stable linkWallet facade for existing controls.");
includes(sharedCore, 'await window.__mflEnsureRouteCore("wallet");', "The linkWallet facade must lazy-load Wallet ownership on demand.");

excludes(sharedCore, "function walletAccessNonce() {", "Wallet account-proof nonce generation must not run in shared startup core.");
excludes(sharedCore, "function walletAccountProofFromUser(user, accountProof) {", "Wallet account-proof parsing must not remain in shared startup core.");
excludes(sharedCore, "function configureFlowWallet(", "Flow wallet configuration must not remain in shared startup core.");
excludes(sharedCore, "async function ensureFlowWallet() {", "Flow module loading must not remain in shared startup core.");
excludes(sharedCore, "void ensureFlowWallet();", "Application startup must not call a Wallet-chunk-only Flow owner before the chunk is loaded.");
excludes(sharedCore, "async function dapperAuthnService(fcl) {", "Dapper discovery must not remain in shared startup core.");
excludes(sharedCore, "async function authenticateWithDapper(fcl) {", "Dapper authentication must not remain in shared startup core.");
excludes(sharedCore, "function walletLinkErrorMessage(error) {", "Wallet opt-in error handling must not remain in shared startup core.");

includes(walletCore, "function walletAccessNonce() {", "The Wallet chunk must own account-proof nonce generation.");
includes(walletCore, "function walletAccountProofFromUser(user, accountProof) {", "The Wallet chunk must own account-proof parsing.");
includes(walletCore, "function configureFlowWallet(", "The Wallet chunk must own Flow wallet configuration.");
includes(walletCore, "async function ensureFlowWallet() {", "The Wallet chunk must own Flow module loading.");
includes(walletCore, "async function dapperAuthnService(fcl) {", "The Wallet chunk must own Dapper discovery.");
includes(walletCore, "async function authenticateWithDapper(fcl) {", "The Wallet chunk must own Dapper authentication.");
includes(walletCore, "async function walletLinkOwner() {", "The Wallet chunk must own the opt-in implementation.");
includes(walletCore, "__mflWalletLinkOwner = walletLinkOwner;", "The Wallet chunk must publish the private opt-in owner through the shared facade.");
excludes(walletCore, "function restoreLinkedWalletProof() {", "Startup wallet-proof restoration must not become Wallet-chunk-only.");
excludes(walletCore, "function optOutWallet() {", "Opt-out must not depend on loading the Wallet opt-in chunk.");

includes(appConfig, 'wallet: "/modules/app-core-wallet-runtime.js"', "Canonical app config must map the Wallet action chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
excludes(routeLoader, 'ensure("wallet")', "The Wallet chunk must not be eagerly primed during startup.");

includes(buildCore, 'runtime: "app-core-wallet-runtime.js"', "The build must emit a generated Wallet runtime.");
includes(buildCore, 'source: "wallet.js"', "The build must consume the Wallet artifact.");

const generatedWallet = await read("./modules/app-core-wallet-runtime.js");
const walletBanner = "// Generated Wallet core from modules/core-sources/wallet.js. Do not edit directly.\n";
invariant(generatedWallet.startsWith(walletBanner), "Generated Wallet runtime must carry the build ownership banner.");
invariant(generatedWallet.slice(walletBanner.length).replace(/\s*$/, "") === walletCore.replace(/\s*$/, ""), "Generated Wallet runtime must exactly match the Wallet build artifact.");

console.log("Wallet action-core splitting validation passed.");
