import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [playerSplitter, generatedPlayer] = await Promise.all([
  read("./modules/app-core-player-chunk.js"),
  read("./modules/app-core-player-runtime.js"),
]);

const neutralUnknownShell = 'if (!context.positions.length) return ["overall"];';
invariant(
  playerSplitter.includes(neutralUnknownShell),
  "Canonical Player loading must not assume outfield Attributes when positions are unknown.",
);
invariant(
  generatedPlayer.includes(neutralUnknownShell),
  "Generated Player runtime must retain the neutral Overall-only unknown-position Attributes shell.",
);

console.log("Player unknown-position loading shell stays neutral until the player type is known.");
