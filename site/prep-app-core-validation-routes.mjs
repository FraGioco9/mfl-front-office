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

async function migrateRoutePathOwnership(fileName, key, expectedPath) {
  const path = new URL(`./${fileName}`, import.meta.url);
  let source = await readFile(path, "utf8");
  const normalizerImport = 'import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";';
  const configImport = `${normalizerImport}\nimport { ROUTE_CORE_PATHS } from "./modules/app-config.js";`;
  if (!source.includes(normalizerImport)) throw new Error(`${fileName}: build normalizer import was not found.`);
  source = source.replace(normalizerImport, configImport);

  const oldAssertion = `includes(routeLoader, '${key}: "${expectedPath}"', "The route-core loader must map ${key === "club" ? "Club" : key === "settings" ? "Settings" : key === "player" ? "Player" : key === "table" ? "the Table chunk" : key === "wallet" ? "the Wallet action chunk" : "the Watchlist core"}${key === "club" || key === "settings" || key === "player" ? " to its generated chunk" : ""}.");`;
  const labels = {
    club: "The route-core loader must map Club to its generated chunk.",
    settings: "The route-core loader must map Settings to its generated chunk.",
    player: "The route-core loader must map Player to its generated chunk.",
    table: "The route-core loader must map the Table chunk.",
    wallet: "The route-core loader must map the Wallet action chunk.",
    watchlist: "Route loader must map the Watchlist core.",
  };
  const exactOldAssertion = `includes(routeLoader, '${key}: "${expectedPath}"', "${labels[key]}");`;
  const newAssertion = `invariant(ROUTE_CORE_PATHS.${key} === "${expectedPath}", "${labels[key]}");`;
  if (!source.includes(exactOldAssertion)) throw new Error(`${fileName}: legacy ${key} route path assertion was not found.`);
  source = source.replace(exactOldAssertion, newAssertion);
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

for (const [fileName, key, expectedPath] of [
  ["validate-club-route-core.mjs", "club", "/modules/app-core-club-runtime.js"],
  ["validate-settings-route-core.mjs", "settings", "/modules/app-core-settings-runtime.js"],
  ["validate-player-route-core.mjs", "player", "/modules/app-core-player-runtime.js"],
  ["validate-table-route-core.mjs", "table", "/modules/app-core-table-runtime.js"],
  ["validate-wallet-core.mjs", "wallet", "/modules/app-core-wallet-runtime.js"],
  ["validate-watchlist-route-core.mjs", "watchlist", "/modules/app-core-watchlist-runtime.js"],
]) {
  await migrateRoutePathOwnership(fileName, key, expectedPath);
}
