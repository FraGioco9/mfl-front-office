import { readFile } from "node:fs/promises";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, appConfig, routeLoader, buildCore, generatedWallet] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core-wallet-runtime.js"),
]);
const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const walletCore = String(artifacts.routeChunks?.wallet || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Wallet split.");
invariant(walletCore.length > 6_000, "The Wallet core is too small to represent the Dapper opt-in owner.");
new Function(sharedCore);
new Function(walletCore);

includes(sharedCore, "function walletAccessMessage() {", "Shared core must retain the stable wallet proof message used during startup restoration.");
includes(sharedCore, "function restoreLinkedWalletProof() {", "Saved wallet-proof restoration must remain in shared startup core.");
includes(sharedCore, "function optOutWallet() {", "Opt-out must remain immediately available without loading Wallet opt-in code.");
includes(sharedCore, "let __mflWalletLinkOwner = null;", "Shared core must retain stable Wallet facade state.");
includes(sharedCore, "async function linkWallet() {", "Shared core must retain the linkWallet facade for existing controls.");
includes(sharedCore, 'await window.__mflEnsureRouteCore("wallet");', "linkWallet must lazy-load Wallet ownership on demand.");

for (const forbidden of [
  "function walletAccessNonce() {",
  "function walletAccountProofFromUser(user, accountProof) {",
  "function configureFlowWallet(",
  "async function ensureFlowWallet() {",
  "async function dapperAuthnService(fcl) {",
  "async function authenticateWithDapper(fcl) {",
  "function walletLinkErrorMessage(error) {",
]) excludes(sharedCore, forbidden, `Wallet-only ownership leaked into shared startup core: ${forbidden}`);

for (const required of [
  "function walletAccessNonce() {",
  "function walletAccountProofFromUser(user, accountProof) {",
  "function configureFlowWallet(",
  "async function ensureFlowWallet() {",
  "async function dapperAuthnService(fcl) {",
  "async function authenticateWithDapper(fcl) {",
  "async function walletLinkOwner() {",
  "__mflWalletLinkOwner = walletLinkOwner;",
]) includes(walletCore, required, `Canonical Wallet core is missing ${required}`);
excludes(walletCore, "function restoreLinkedWalletProof() {", "Startup wallet-proof restoration must not become Wallet-only.");
excludes(walletCore, "function optOutWallet() {", "Opt-out must not depend on loading the Wallet core.");

includes(appConfig, 'wallet: "/modules/app-core-wallet-runtime.js"', "Canonical app config must map the Wallet action core.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "Route-core loader must consume canonical route-core paths.");
excludes(routeLoader, 'ensure("wallet")', "Wallet core must not be eagerly primed during startup.");
invariant(coreSourceByDomain.wallet?.source === "wallet.js" && coreSourceByDomain.wallet?.runtime === "app-core-wallet-runtime.js", "Core manifest must generate Wallet directly from canonical source.");
excludes(buildCore, "app-core-wallet-chunk.js", "Core build must not depend on the retired Wallet splitter.");

const walletBanner = "// Generated Wallet core from modules/core-sources/wallet.js. Do not edit directly.\n";
invariant(generatedWallet.startsWith(walletBanner), "Generated Wallet runtime must carry the build ownership banner.");
invariant(generatedWallet.slice(walletBanner.length).replace(/\s*$/, "") === walletCore.replace(/\s*$/, ""), "Generated Wallet runtime must exactly match canonical Wallet source.");

console.log("Wallet action-core ownership validation passed.");
