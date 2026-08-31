import { readFile, writeFile } from "node:fs/promises";

const validateUrl = new URL("./validate.mjs", import.meta.url);
let source = await readFile(validateUrl, "utf8");

const buildAssertionBefore = 'includes(buildCore, "modules/app-core-runtime.js", "The core build must write the generated shared runtime artifact.");';
const buildAssertionAfter = 'includes(buildCore, \'runtime: "app-core-runtime.js"\', "The core build must write the generated shared runtime artifact.");';
if (!source.includes(buildAssertionBefore)) throw new Error("Source-owned core runtime build assertion was not found.");
source = source.replace(buildAssertionBefore, buildAssertionAfter);

const coreAliasBefore = "const coreSource = canonicalSharedCore;";
const coreAliasAfter = `const coreSource = [
  canonicalSharedCore,
  await readSite("modules/core-sources/evaluation.js"),
  await readSite("modules/core-sources/mfl-stats.js"),
  await readSite("modules/core-sources/club.js"),
  await readSite("modules/core-sources/settings.js"),
  await readSite("modules/core-sources/player.js"),
  await readSite("modules/core-sources/table.js"),
  await readSite("modules/core-sources/wallet.js"),
  await readSite("modules/core-sources/watchlist.js"),
].join("\\n");`;
if (!source.includes(coreAliasBefore)) throw new Error("Shared-core validator alias was not found.");
source = source.replace(coreAliasBefore, coreAliasAfter);

await writeFile(validateUrl, source, "utf8");
