import { readdir, readFile, writeFile } from "node:fs/promises";

const canonicalCoreRead = `Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\\n"))`;

const names = (await readdir(new URL("./", import.meta.url)))
  .filter((name) => /^validate.*\.mjs$/.test(name));

let changed = 0;
for (const name of names) {
  const url = new URL(`./${name}`, import.meta.url);
  let source = await readFile(url, "utf8");
  const original = source;
  source = source.replaceAll('read("./modules/app-core.js")', canonicalCoreRead);
  source = source.replaceAll("read('./modules/app-core.js')", canonicalCoreRead);
  if (source !== original) {
    await writeFile(url, source, "utf8");
    changed += 1;
  }
}

console.log(`Migrated ${changed} validator files away from retired app-core.js reads.`);
