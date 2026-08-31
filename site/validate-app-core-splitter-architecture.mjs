import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const build = await read("./build-app-core.mjs");
invariant(build.includes("modules/core-sources"), "Application-core build must consume canonical split sources.");
invariant(!build.includes("app-core-build-normalizer"), "Application-core build must not depend on behavior-changing normalizers.");
invariant(!build.includes("replaceRequired"), "Application-core build must not perform source-string behavior rewrites.");
invariant(!build.includes("modules/app-core.js"), "Application-core build must not depend on the legacy monolith.");

const pairs = [
  ["shared.js", "app-core-runtime.js"],
  ["evaluation.js", "app-core-evaluation-runtime.js"],
  ["mfl-stats.js", "app-core-mfl-stats-runtime.js"],
  ["club.js", "app-core-club-runtime.js"],
  ["settings.js", "app-core-settings-runtime.js"],
  ["player.js", "app-core-player-runtime.js"],
  ["table.js", "app-core-table-runtime.js"],
  ["wallet.js", "app-core-wallet-runtime.js"],
  ["watchlist.js", "app-core-watchlist-runtime.js"],
];

for (const [sourceName, runtimeName] of pairs) {
  const [source, runtime] = await Promise.all([
    read(`./modules/core-sources/${sourceName}`),
    read(`./modules/${runtimeName}`),
  ]);
  const runtimeBody = runtime.replace(/^\/\/ Generated[^\n]*\n/, "");
  invariant(runtimeBody === source, `Generated ${runtimeName} must exactly match canonical ${sourceName}.`);
}

console.log("Canonical split application-core source ownership and generated equivalence validation passed.");
