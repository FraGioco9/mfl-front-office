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

  const insertPlayer = database.prepare(`
    INSERT INTO players (
      player_id,
      wallet_address,
      wallet_name,
      name,
      positions,
      age,
      nationality,
      retirement_years,
      owned_since,
      player_seasons,
      overall,
      pace,
      shooting,
      passing,
      dribbling,
      defense,
      physical,
      goalkeeping
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPlayer.run(
    "1",
    "0xff8d2bbed8164db0",
    "MFL Browser Agent",
    "Nicolò Barella",
    "CM",
    "29",
    "Italy",
    "2",
    "1700000000",
    "1",
    "84",
    "78",
    "76",
    "86",
    "85",
    "77",
    "80",
    "10",
  );
  insertPlayer.run(
    "2",
    "0x2222222222222222",
    "Browser Agent",
    "Alessandro Bastoni",
    "CB",
    "27",
    "Italy",
    "2",
    "1710000000",
    "2",
    "82",
    "74",
    "55",
    "80",
    "76",
    "86",
    "84",
    "10",
  );
  database.exec(`
    INSERT INTO wallets (wallet_address) VALUES ('0xff8d2bbed8164db0');
    INSERT INTO wallets (wallet_address) VALUES ('0x2222222222222222');
  `);
} finally {
  database.close();
}

console.log(target);
