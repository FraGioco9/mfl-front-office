import { readFileSync } from "node:fs";

const read = (path) => String(readFileSync(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

export function readCanonicalCoreArtifacts(source = "") {
  void source;
  return {
    core: read("./modules/core-sources/shared.js"),
    routeChunks: {
      evaluation: read("./modules/core-sources/evaluation.js"),
      mflstats: read("./modules/core-sources/mfl-stats.js"),
      club: read("./modules/core-sources/club.js"),
      settings: read("./modules/core-sources/settings.js"),
      player: read("./modules/core-sources/player.js"),
      table: read("./modules/core-sources/table.js"),
      wallet: read("./modules/core-sources/wallet.js"),
      watchlist: read("./modules/core-sources/watchlist.js"),
    },
  };
}
