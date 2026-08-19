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
