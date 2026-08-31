import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, generatedTable, styles, tableStyles] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-table-runtime.js"),
  read("./styles-base.css"),
  read("./styles.css"),
]);

for (const code of [source, generatedTable]) {
  invariant(
    code.includes('getValue(row, "player_seasons") !== 1')
      && code.includes('svg: "newPlayer"')
      && code.includes('label: "New mint"'),
    "New-player marker must preserve the one-season eligibility rule and New mint semantics.",
  );
  invariant(
    !code.includes('\\u{1F195}')
      && !code.includes('emoji: "🆕"')
      && code.includes('document.createElementNS("http://www.w3.org/2000/svg", "svg")')
      && code.includes('markerIcon.classList.add("newMintIcon")')
      && code.includes('markerIcon.setAttribute("viewBox", "0 0 24 24")')
      && code.includes('m12 3-1.9 5.8')
      && code.includes('M5 3v4')
      && code.includes('M3 5h4'),
    "New-player marker must use the canonical inline sparkle SVG and must not regress to the Unicode NEW emoji.",
  );
  invariant(
    code.includes('retirement || newMintMarker(row)')
      && code.includes('retirement ? "retirementMarker" : "newMintMarker"'),
    "Retirement markers must retain precedence over the new-player marker.",
  );
}

invariant(
  styles.includes('.newMintMarker {\n  color: var(--primary);\n}')
    && styles.includes('.newMintIcon {\n  display: block;\n  width: 16px;\n  height: 16px;')
    && styles.includes('fill: none;')
    && styles.includes('stroke: var(--primary);')
    && styles.includes('stroke-width: 2;')
    && styles.includes('stroke-linecap: round;')
    && styles.includes('stroke-linejoin: round;'),
  "New-player sparkle must keep the canonical primary color and outline icon language at 16px.",
);

invariant(
  tableStyles.includes("background: var(--retirement-marker-color);")
    && tableStyles.includes("--retirement-marker-color: #910000;")
    && tableStyles.includes("--retirement-marker-color: #ff2020;")
    && tableStyles.includes("--retirement-marker-color: #ff7a00;")
    && tableStyles.includes("--retirement-marker-color: #ffdd33;")
    && !tableStyles.includes(".retirementMarker::before {\n  content: \"\";\n  display: block;\n  width: 16px;\n  height: 16px;\n  background: currentColor;"),
  "Retirement and retiring icon drawings must keep their status colors while hovered or focused.",
);

console.log("New-player icon validation passed.");
