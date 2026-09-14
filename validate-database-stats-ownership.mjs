import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [dataHandler, databaseStats, dataViews] = await Promise.all([
  read("./api/data.js"),
  read("./api/_database-stats.js"),
  read("./api/_data-views.js"),
]);

invariant(
  dataHandler.includes('const { databaseStatsData } = require("./_database-stats");')
    && dataHandler.includes('else if (mode === "database-stats") data = databaseStatsData();'),
  "The /api/data Database Stats mode must delegate to the dedicated canonical backend owner.",
);
invariant(
  databaseStats.includes("function databaseStatsData()")
    && /module\.exports\s*=\s*\{[\s\S]*?\bdatabaseStatsData,?[\s\S]*?\};/.test(databaseStats),
  "_database-stats.js must remain the canonical Database Stats implementation/export.",
);
invariant(
  !dataViews.includes("function databaseStatsData()")
    && !dataViews.includes("databaseStatsData,"),
  "_data-views.js must not retain a duplicate/dead Database Stats implementation or export.",
);

console.log("Database Stats backend ownership is singular and delegated to _database-stats.js.");