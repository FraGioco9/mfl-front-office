import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const responsive = read("./responsive.css");
const intermediateSource = read("./responsive-sources/intermediate-desktop.css.inc");
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

const bootstrapActionsStart = bootstrap.indexOf('if (classes.has("col-actions")) {');
const bootstrapActionsEnd = bootstrap.indexOf("return;", bootstrapActionsStart);
assert.ok(
  bootstrapActionsStart >= 0 && bootstrapActionsEnd > bootstrapActionsStart,
  "Bootstrap actions-header construction must stay discoverable.",
);
const bootstrapActionsBlock = bootstrap.slice(bootstrapActionsStart, bootstrapActionsEnd);
assert.ok(
  bootstrapActionsBlock.includes('button.className = "playerTableActionsButton";')
    && bootstrapActionsBlock.includes('button.setAttribute("aria-hidden", "true");'),
  "Bootstrap must keep its first-paint actions placeholder identifiable as the hidden player-table action button.",
);
assert.ok(
  intermediateSource.includes("#progressionPage #tableHead .rowActionsCell .playerTableActionsButton {\n  display: none;\n}"),
  "The actual bootstrap three-dot placeholder must be hidden directly in the table header rather than relying on the hydrated empty-header contract.",
);

assert.ok(
  responsive.includes(".playerPage .playerHero {\n    padding-bottom: 4px;\n  }"),
  "Intermediate desktop Player heroes must keep bottom breathing room below the full-width Open link action row.",
);

assert.ok(
  intermediateSource.includes("@media (min-width: 1041px) and (max-width: 1366px) {")
    && intermediateSource.includes("grid-template-columns: minmax(0, 1fr) minmax(180px, 320px) max-content;")
    && intermediateSource.includes("width: 72px;\n    min-width: 72px;")
    && intermediateSource.includes("flex: 0 0 96px;\n    width: 96px;"),
  "Intermediate desktop chrome must preserve the compact 1444px header geometry instead of re-expanding Players, Wallets, Search, or Account at <=1366px.",
);

assert.ok(
  intermediateSource.includes("@media (min-width: 901px) and (max-width: 1040px) {")
    && intermediateSource.includes("grid-template-columns: minmax(0, 1fr) 44px max-content;")
    && intermediateSource.includes("width: 68px;\n    min-width: 68px;")
    && intermediateSource.includes("flex-basis: 44px;\n    width: 44px;"),
  "The late intermediate-desktop layer must preserve the narrower 1040px header geometry after the broad 1366px Player rules.",
);

console.log("Intermediate desktop final-smoke layout validation passed.");
