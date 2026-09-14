import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { renderProgressionEmailPortraitPng } = require("./api/_progression-email-portrait.js");

const outputDirectory = resolve(process.argv[2] || "");
const playerIds = String(process.argv[3] || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!process.argv[2]) throw new Error("An output directory is required.");
if (!playerIds.length) throw new Error("At least one player ID is required.");
if (playerIds.some((playerId) => !/^\d{1,20}$/.test(playerId))) {
  throw new Error("Player IDs must contain digits only.");
}

await mkdir(outputDirectory, { recursive: true });

for (const playerId of playerIds) {
  const png = await renderProgressionEmailPortraitPng(playerId);
  if (!png?.length) {
    throw new Error(`Could not render progression email portrait for player #${playerId}.`);
  }
  await writeFile(resolve(outputDirectory, `${playerId}.png`), png);
  console.log(`Rendered progression email portrait for player #${playerId}.`);
}
