import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const responsive = read("./responsive.css");
const intermediateSource = read("./responsive-sources/intermediate-desktop.css.inc");
const chromeSource = read("./responsive-sources/chrome-tablet.css.inc");
const tableSource = read("./modules/core-sources/table.js");
const bootstrap = read("./bootstrap.js");

const actionsHeaderStart = tableSource.indexOf('const actionsHeader = document.createElement("th");');
const actionsHeaderEnd = tableSource.indexOf("headerRow.appendChild(actionsHeader);", actionsHeaderStart);
assert.ok(actionsHeaderStart >= 0 && actionsHeaderEnd > actionsHeaderStart, "Player actions header construction must stay discoverable.");
const actionsHeaderBlock = tableSource.slice(actionsHeaderStart, actionsHeaderEnd);
assert.ok(
  actionsHeaderBlock.includes('actionsHeader.className = "rowActionsCell";')
    && !actionsHeaderBlock.includes("actionsHeader.appendChild("),
  "The hydrated Player actions header must remain structurally empty; row actions belong only to body rows.",
);

const bootstrapHeaderStart = bootstrap.indexOf('const actionsHeader = document.createElement("th");');
const bootstrapHeaderEnd = bootstrap.indexOf("row.appendChild(actionsHeader);", bootstrapHeaderStart);
assert.ok(
  bootstrapHeaderStart >= 0 && bootstrapHeaderEnd > bootstrapHeaderStart,
  "Bootstrap actions-header construction must stay discoverable.",
);
const bootstrapHeaderBlock = bootstrap.slice(bootstrapHeaderStart, bootstrapHeaderEnd);
assert.ok(
  bootstrapHeaderBlock.includes('actionsHeader.className = "rowActionsCell";')
    && !bootstrapHeaderBlock.includes("actionsHeader.appendChild("),
  "The first-paint Player actions header must remain structurally empty; loading row action skeletons are body content, not header content.",
);

assert.ok(
  !intermediateSource.includes("#progressionPage #tableHead .rowActionsCell"),
  "Intermediate desktop CSS must not special-case an already-empty Player actions header.",
);

assert.ok(
  !chromeSource.includes(".stats > div > span {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }"),
  "Desktop header counters must never turn Players/Wallets values into ellipses when space tightens.",
);

for (const compactCounterRule of [
  "width: 72px;\n    min-width: 72px;",
  "width: 76px;\n    min-width: 76px;",
  "width: 68px;\n    min-width: 68px;",
]) {
  assert.ok(
    !chromeSource.includes(compactCounterRule),
    `Responsive chrome must keep the normal Players/Wallets box width instead of applying ${compactCounterRule.split(";")[0]}.`,
  );
  assert.ok(
    !intermediateSource.includes(compactCounterRule),
    `Late intermediate CSS must not reintroduce compact Players/Wallets geometry via ${compactCounterRule.split(";")[0]}.`,
  );
}

assert.ok(
  responsive.includes(".playerPage .playerHero {\n    padding-bottom: 4px;\n  }"),
  "Intermediate desktop Player heroes must keep bottom breathing room below the full-width Open link action row.",
);

assert.ok(
  intermediateSource.includes("@media (min-width: 1041px) and (max-width: 1366px) {")
    && intermediateSource.includes("grid-template-columns: minmax(0, 1fr) minmax(180px, 320px) max-content;")
    && intermediateSource.includes("flex: 0 0 96px;\n    width: 96px;"),
  "Intermediate desktop chrome must preserve the 1444px Search/Account geometry after the broad 1366px Player rules.",
);

assert.ok(
  intermediateSource.includes("@media (min-width: 901px) and (max-width: 1040px) {")
    && intermediateSource.includes("grid-template-columns: minmax(0, 1fr) 44px max-content;")
    && intermediateSource.includes("flex-basis: 44px;\n    width: 44px;"),
  "The late intermediate-desktop layer must preserve the narrower 1040px Search/Account geometry after the broad 1366px Player rules.",
);

console.log("Intermediate desktop final-smoke layout validation passed.");