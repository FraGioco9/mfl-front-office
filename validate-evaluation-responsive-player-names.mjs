import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [shared, styles, responsive] = await Promise.all([
  readFile(new URL("./modules/core-sources/evaluation.js", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
  readFile(new URL("./responsive.css", import.meta.url), "utf8"),
]);

assert.ok(
  shared.includes('const playerName = formatCellValue(row, "name");'),
  "Evaluation must retain the canonical full player name.",
);
assert.ok(
  shared.includes('const compactPlayerName = playerName.replace('),
  "Evaluation must derive a compact player-name form from the full name.",
);
assert.ok(
  shared.includes('evaluationPlayerNameFull') && shared.includes('evaluationPlayerNameCompact'),
  "Evaluation table rendering must carry both full and compact player-name variants.",
);
assert.ok(
  !shared.includes('const playerName = formatCellValue(row, "name").replace('),
  "Evaluation must not abbreviate the canonical player name unconditionally.",
);
assert.ok(
  styles.includes('.evaluationPlayerNameCompact {\n  display: none;\n}'),
  "Compact Evaluation names must be hidden by default on non-small screens.",
);
assert.ok(
  responsive.includes('#evaluationPage .evaluationPlayerNameFull {\n    display: none;\n  }') &&
    responsive.includes('#evaluationPage .evaluationPlayerNameCompact {\n    display: inline;\n  }'),
  "The canonical 900px mobile breakpoint must swap full Evaluation names for compact names.",
);

console.log("Evaluation responsive player-name validation passed.");
