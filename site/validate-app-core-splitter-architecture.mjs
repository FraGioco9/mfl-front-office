import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const utilityPath = "./modules/app-core-splitter-utils.js";
const splitterPaths = [
  "./modules/app-core-route-chunks.js",
  "./modules/app-core-settings-chunk.js",
  "./modules/app-core-player-chunk.js",
  "./modules/app-core-table-chunk.js",
  "./modules/app-core-wallet-chunk.js",
  "./modules/app-core-watchlist-route-chunk.js",
];
const [utility, ...splitters] = await Promise.all([utilityPath, ...splitterPaths].map(read));

for (const helper of [
  "normalizeApplicationCoreSource",
  "normalizeSplitterInput",
  "extractRequiredSection",
  "extractRequiredSections",
  "insertBeforeRequiredMarker",
  "replaceRequired",
  "replaceRequiredFunction",
  "renameRequiredFunctionOwner",
  "finalizeSplitArtifacts",
]) {
  invariant(utility.includes(`export function ${helper}(`), `Shared splitter utility must own ${helper}.`);
}

splitterPaths.forEach((path, index) => {
  const source = splitters[index];
  invariant(
    source.includes('from "./app-core-splitter-utils.js";'),
    `${path} must consume the shared splitter utility.`,
  );
  invariant(
    !/function\s+extractRequired(?:Player|Settings|Table|Wallet|WatchlistRoute)?Section\s*\(/.test(source),
    `${path} must not reintroduce a private required-section extractor.`,
  );
  invariant(
    !/function\s+renameRequired(?:Table|Wallet|WatchlistRoute)Owner\s*\(/.test(source),
    `${path} must not reintroduce a private owner-renaming helper.`,
  );
});

invariant(
  splitters.some((source) => source.includes("extractRequiredSections(")),
  "Declarative multi-section extraction must remain in active splitter use.",
);
invariant(
  splitters.some((source) => source.includes("finalizeSplitArtifacts(")),
  "Shared split-result finalization must remain in active splitter use.",
);

console.log("Application-core splitters share canonical extraction and owner-delegation primitives.");
