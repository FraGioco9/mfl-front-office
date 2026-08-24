// Temporary one-shot source placement migration; removed by its workflow before commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "modules/app-core.js");
const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const block = `let evaluationPageCacheReady = false;

function preparePlainEvaluationReentry() {
  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  state.evaluationPlayerId = null;
  state.evaluationOverallRows = {};
  state.evaluationSummaryPositions = {};
  evaluationSearchInput.value = "";
  renderEmptyEvaluationSelection(false, true);
}`;
const misplaced = `${block}\n\nasync function setPage(pageName, updateHash = true, options = {}) {`;
const tableBoundary = `function tableTitleForPage(pageName) {`;
if (!source.includes(misplaced)) throw new Error("Could not find Evaluation cache block immediately before setPage.");
if (!source.includes(tableBoundary)) throw new Error("Could not find Table destination-shell boundary.");
let migrated = source.replace(misplaced, `async function setPage(pageName, updateHash = true, options = {}) {`);
migrated = migrated.replace(tableBoundary, `${block}\n\n${tableBoundary}`);
await writeFile(path, migrated);
console.log("Evaluation cache state now stays in shared core before the Table extraction boundary.");
