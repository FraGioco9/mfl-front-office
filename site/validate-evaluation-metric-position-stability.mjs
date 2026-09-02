import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [styles, responsive, indexHtml] = await Promise.all([
  readFile(new URL("./styles-base.css", import.meta.url), "utf8"),
  readFile(new URL("./responsive.css", import.meta.url), "utf8"),
  readFile(new URL("./index.html", import.meta.url), "utf8"),
]);

assert.ok(
  styles.includes(".evaluationActions {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) max-content;"),
  "Desktop Evaluation must give the metric group its own intrinsic right-hand track so action-button visibility cannot move it.",
);
assert.ok(
  styles.includes(".evaluationMetrics {\n  justify-content: flex-end;\n  justify-self: end;\n}"),
  "Desktop Evaluation metrics must remain anchored to the right edge of their dedicated track.",
);
assert.ok(
  indexHtml.indexOf('id="evaluationButtons"') < indexHtml.indexOf('class="evaluationMetrics"'),
  "Evaluation actions and metrics must keep their canonical sibling order.",
);
assert.match(
  responsive,
  /\.evaluationActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  "Tablet/mobile Evaluation must collapse actions to the canonical single-column layout.",
);
assert.ok(
  responsive.includes("#evaluationPage .evaluationMetrics {\n    grid-column: 2 / -1;\n    grid-row: 2;"),
  "Small-phone Evaluation metrics must stay pinned to row 2 independently of selected-player action buttons.",
);
assert.ok(
  responsive.includes("#evaluationPage .evaluationButtons {\n    display: grid;\n    grid-column: 1 / -1;\n    grid-row: 4;"),
  "Small-phone selected-player actions must remain on their separate row below the search.",
);
assert.match(
  responsive,
  /#evaluationPage \.evaluationSearchGroup:has\(#evaluationLoadButton:not\(\[hidden\]\)\) \.evaluationSearch \{[\s\S]*?grid-row: 3;[\s\S]*?width: calc\(100% - 82px\);/,
  "Small-phone empty Evaluation must keep the search on row 3 with space reserved for Load.",
);
assert.match(
  responsive,
  /#evaluationPage \.evaluationButtons:has\(#evaluationLoadButton:not\(\[hidden\]\)\) \{[\s\S]*?grid-row: 3;[\s\S]*?width: 76px;[\s\S]*?justify-self: end;/,
  "Small-phone empty Evaluation must keep Load in its canonical row-3 slot beside the search.",
);

console.log("Evaluation metric position stability validation passed.");
