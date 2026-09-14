const { mkdirSync, rmSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PLAYER_COLUMNS } = require("../../api/_database.js");

const target = resolve(process.argv[2] || "");
if (!target) throw new Error("SQLite smoke fixture path is required.");

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { force: true });

const database = new DatabaseSync(target);
try {
  const playerColumns = PLAYER_COLUMNS.map((column) => `"${column}" TEXT`).join(", ");
  database.exec(`
    CREATE TABLE players (${playerColumns});
    CREATE TABLE wallets (wallet_address TEXT);
    CREATE TABLE runtime_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO runtime_metadata (key, value)
    VALUES ('generated_at', '2026-09-14T00:00:00.000Z');
  `);
} finally {
  database.close();
}

console.log(target);
