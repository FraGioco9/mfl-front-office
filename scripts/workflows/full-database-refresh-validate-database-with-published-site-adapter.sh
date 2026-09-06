#!/usr/bin/env bash
set -euo pipefail
node - <<'NODE'
const path = require("node:path");

const publishedDatabase = require(path.resolve("production-site/site/api/_database.js"));
const database = publishedDatabase.getDatabase();
const playerCount = Number(database.prepare("SELECT count(*) AS count FROM players").get()?.count ?? -1);
const walletCount = Number(database.prepare("SELECT count(*) AS count FROM wallets").get()?.count ?? -1);
const generatedAt = String(
  database.prepare("SELECT value FROM runtime_metadata WHERE key = 'generated_at' LIMIT 1").get()?.value || "",
).trim();

if (!Number.isFinite(playerCount) || playerCount <= 0) {
  throw new Error(`Published adapter could not read a valid player count: ${playerCount}`);
}
if (!Number.isFinite(walletCount) || walletCount <= 0) {
  throw new Error(`Published adapter could not read a valid wallet count: ${walletCount}`);
}
if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
  throw new Error(`Published adapter could not read a valid generated_at value: ${generatedAt}`);
}

console.log(
  `Published site adapter accepted fresh database: ${playerCount} players, ${walletCount} wallets, generatedAt ${generatedAt}.`,
);
NODE
