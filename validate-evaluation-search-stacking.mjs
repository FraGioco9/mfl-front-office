import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const siteRoot = dirname(fileURLToPath(import.meta.url));
const stacking = await readFile(join(siteRoot, "stacking.css"), "utf8");
const base = await readFile(join(siteRoot, "styles-base.css"), "utf8");

function ruleFor(source, selector) {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) return "";
  const end = source.indexOf("}\n", start);
  return end >= 0 ? source.slice(start, end + 2) : "";
}

const searchRule = ruleFor(base, ".evaluationSearch");
const resultsRule = ruleFor(base, ".evaluationSearchResults");
const stackingRule = ruleFor(stacking, ".evaluationSearch");

invariant(searchRule.includes("position: relative;"), "Evaluation search must remain the positioned anchor for its results dropdown.");
invariant(resultsRule.includes("position: absolute;"), "Evaluation search results must remain absolutely anchored to the search control.");
invariant(stackingRule.includes("z-index: 1;"), "Evaluation search must stay one local stacking layer above later table titles and table content.");
invariant(!resultsRule.includes("z-index:"), "Evaluation results must inherit the search component stacking context instead of owning a separate layer.");
invariant(!stackingRule.includes("!important"), "Evaluation search stacking must not use !important.");

console.log("Evaluation search stacking validation passed: the search component owns local layer 1 and its absolute results remain above later table titles/content without a separate override layer.");
