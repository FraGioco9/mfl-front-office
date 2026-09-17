import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const responsive = read("./responsive.css");
const tableSource = read("./modules/core-sources/table.js");

const actionsHeaderStart = tableSource.indexOf('const actionsHeader = document.createElement("th");');
const actionsHeaderEnd = tableSource.indexOf("headerRow.appendChild(actionsHeader);", actionsHeaderStart);
assert.ok(actionsHeaderStart >= 0 && actionsHeaderEnd > actionsHeaderStart, "Player actions header construction must stay discoverable.");
const actionsHeaderBlock = tableSource.slice(actionsHeaderStart, actionsHeaderEnd);
assert.ok(
  actionsHeaderBlock.includes('actionsHeader.className = "rowActionsCell";')
    && !actionsHeaderBlock.includes("actionsHeader.appendChild("),
  "The Player actions header must remain structurally empty; row actions belong only to body rows.",
);

assert.ok(
  responsive.includes("#progressionPage #tableHead .rowActionsCell > * {\n    display: none;\n  }")
    && responsive.includes("#progressionPage #tableHead .rowActionsCell::before,\n  #progressionPage #tableHead .rowActionsCell::after {\n    content: none;\n    display: none;\n  }"),
  "Intermediate desktop table headers must suppress any visual action-menu content beside the selection checkbox.",
);

assert.ok(
  responsive.includes(".playerPage .playerHero {\n    padding-bottom: 4px;\n  }"),
  "Intermediate desktop Player heroes must keep bottom breathing room below the full-width Open link action row.",
);

console.log("Intermediate desktop final-smoke layout validation passed.");
