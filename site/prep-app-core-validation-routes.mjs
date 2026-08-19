import { readFile, writeFile } from "node:fs/promises";

async function migrateValidator(fileName, bindingBefore, bindingAfter, readBefore, readAfter = "") {
  const path = new URL(`./${fileName}`, import.meta.url);
  let source = await readFile(path, "utf8");
  if (!source.includes(bindingBefore)) throw new Error(`${fileName}: route-normalizer binding was not found.`);
  source = source.replace(bindingBefore, bindingAfter);
  if (!source.includes(readBefore)) throw new Error(`${fileName}: route-normalizer read was not found.`);
  source = source.replace(readBefore, readAfter);
  source = source.replaceAll("routeNormalizer", "coreSource");
  await writeFile(path, source, "utf8");
}

async function migrateRoutePathOwnership(fileName, key, expectedPath, label) {
  const path = new URL(`./${fileName}`, import.meta.url);
  let source = await readFile(path, "utf8");
  const normalizerImport = 'import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";';
  const configImport = `${normalizerImport}\nimport { ROUTE_CORE_PATHS } from "./modules/app-config.js";`;
  if (!source.includes(normalizerImport)) throw new Error(`${fileName}: build normalizer import was not found.`);
  source = source.replace(normalizerImport, configImport);

  const oldAssertion = `includes(routeLoader, '${key}: "${expectedPath}"', "${label}");`;
  const newAssertion = `invariant(ROUTE_CORE_PATHS.${key} === "${expectedPath}", "${label}");`;
  if (!source.includes(oldAssertion)) throw new Error(`${fileName}: legacy ${key} route path assertion was not found.`);
  source = source.replace(oldAssertion, newAssertion);
  await writeFile(path, source, "utf8");
}

async function migrateGenericStartupOwnership(fileName, oldBlock, routeLabel) {
  const path = new URL(`./${fileName}`, import.meta.url);
  let source = await readFile(path, "utf8");
  const genericBlock = [
    'includes(coreSource, "const initialRouteTarget = pageTargetFromPath(window.location.pathname);", "Direct startup must classify the initial route before startApp.");',
    `includes(coreSource, "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});", "Direct ${routeLabel} startup must load its canonical route-core dependency chain before startApp.");`,
    'includes(coreSource, "return startApp();", "Application startup must begin only after the initial route-core owner is ready.");',
  ].join("\n");
  if (!source.includes(oldBlock)) throw new Error(`${fileName}: legacy direct-startup block was not found.`);
  source = source.replace(oldBlock, genericBlock);
  await writeFile(path, source, "utf8");
}

await migrateValidator(
  "validate-club-route-core.mjs",
  "const [coreSource, routeChunksSource, routeLoader, appEntry, routeNormalizer, buildCore] = await Promise.all([",
  "const [coreSource, routeChunksSource, routeLoader, appEntry, buildCore] = await Promise.all([",
  '  read("./modules/app-core-route-runtime-normalizer.js"),\n',
);

await migrateValidator(
  "validate-settings-route-core.mjs",
  "const [coreSource, settingsSplitter, routeLoader, routeNormalizer, buildCore] = await Promise.all([",
  "const [coreSource, settingsSplitter, routeLoader, buildCore] = await Promise.all([",
  '  read("./modules/app-core-route-runtime-normalizer.js"),\n',
);

await migrateValidator(
  "validate-player-route-core.mjs",
  "const [coreSource, playerSplitter, routeLoader, routeNormalizer, buildCore] = await Promise.all([",
  "const [coreSource, playerSplitter, routeLoader, buildCore] = await Promise.all([",
  '  read("./modules/app-core-route-runtime-normalizer.js"),\n',
);

await migrateValidator(
  "validate-table-route-core.mjs",
  "const [coreSource, tableSplitter, routeLoader, routeNormalizer, buildCore, appEntry] = await Promise.all([",
  "const [coreSource, tableSplitter, routeLoader, buildCore, appEntry] = await Promise.all([",
  '  read("./modules/app-core-route-runtime-normalizer.js"),\n',
);

await migrateValidator(
  "validate-watchlist-route-core.mjs",
  "  routeNormalizer,\n",
  "",
  '  read("./modules/app-core-route-runtime-normalizer.js"),\n',
);

for (const [fileName, key, expectedPath, label] of [
  ["validate-club-route-core.mjs", "club", "/modules/app-core-club-runtime.js", "The route-core loader must map Club to its generated chunk."],
  ["validate-settings-route-core.mjs", "settings", "/modules/app-core-settings-runtime.js", "The route-core loader must map Settings to its generated chunk."],
  ["validate-player-route-core.mjs", "player", "/modules/app-core-player-runtime.js", "The route-core loader must map Player to its generated chunk."],
  ["validate-table-route-core.mjs", "table", "/modules/app-core-table-runtime.js", "The route-core loader must map the Table chunk."],
  ["validate-wallet-core.mjs", "wallet", "/modules/app-core-wallet-runtime.js", "The route-core loader must map the Wallet action chunk."],
  ["validate-watchlist-route-core.mjs", "watchlist", "/modules/app-core-watchlist-runtime.js", "Route loader must map the Watchlist core."],
]) {
  await migrateRoutePathOwnership(fileName, key, expectedPath, label);
}

await migrateGenericStartupOwnership(
  "validate-club-route-core.mjs",
  [
    'includes(coreSource, \'await window.__mflEnsureRouteCore("club");\', "Direct Club startup must load the Club route owner before startApp.");',
    'includes(coreSource, "return startApp();", "Application startup must begin only after an initial Club owner is ready.");',
  ].join("\n"),
  "Club",
);

await migrateGenericStartupOwnership(
  "validate-settings-route-core.mjs",
  [
    'includes(coreSource, \'await window.__mflEnsureRouteCore("settings");\', "Direct Settings startup must load Settings rendering before startApp.");',
    'includes(coreSource, "return startApp();", "Application startup must begin only after any direct Settings owner is ready.");',
  ].join("\n"),
  "Settings",
);

await migrateGenericStartupOwnership(
  "validate-player-route-core.mjs",
  [
    'includes(coreSource, \'await window.__mflEnsureRouteCore("player");\', "Direct Player startup must load Player helpers before startApp.");',
    'includes(coreSource, \'/^\\\\/players\\\\/[^/]+\\\\/?$/i\', "Direct Player startup must recognize canonical /players/<id> routes.");',
  ].join("\n"),
  "Player",
);

await migrateGenericStartupOwnership(
  "validate-table-route-core.mjs",
  [
    'includes(coreSource, "const directTableRoute = (", "Direct startup must classify table routes before startApp.");',
    'includes(coreSource, \'await window.__mflEnsureRouteCore("table");\', "Direct table startup must load the Table core before startApp.");',
    'matches(coreSource, /!\\/\\^.*database.*stats.*test\\(initialRoutePath\\)/, "Direct Database Stats startup must stay outside the Table core.");',
  ].join("\n"),
  "Table",
);

await migrateGenericStartupOwnership(
  "validate-watchlist-route-core.mjs",
  [
    'includes(coreSource, "const directWatchlistRoute =", "Direct startup must identify Watchlist routes separately.");',
    'includes(coreSource, \'await window.__mflEnsureRouteCore("watchlist");\', "Direct Watchlist startup must load Table and Watchlist ownership before startApp.");',
  ].join("\n"),
  "Watchlist",
);
