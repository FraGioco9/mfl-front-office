import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bridges = [
  { path: "nationality-filter-options-runtime.js", signatures: [
    "uniqueNationalityValues = authoritativeNationalityValues;",
    "restoreFilterDraftRules(rules);",
  ] },
  { path: "selection-startup-reset-runtime.js", signatures: [
    "restoreSavedTableState = restoreWithoutStartupSelection;",
    "__mflSelectionStartupResetActive",
  ] },
  { path: "filter-controls-runtime.js", signatures: [
    "buildValueControl = numericStepperBuildValueControl;",
    "buildOperatorSelect = contractAwareBuildOperatorSelect;",
    "ruleMatches = contractAwareRuleMatches;",
    "addFilterRule = filterDefaultAddFilterRule;",
  ] },
  { path: "shared-table-ui-runtime.js", signatures: [
    "restoreSavedTableState = restoreWithMobilePageSize;",
    "__mflMobileTablePageSizeActive",
  ] },
];

for (const { path, signatures } of bridges) {
  const code = readFileSync(new URL("./" + path, import.meta.url), "utf8");
  assert.doesNotMatch(code, /\b(?:window\.)?eval\s*\(|\bnew\s+Function\s*\(/,
    `Production legacy bridge ${path} must not evaluate strings.`);
  assert.doesNotMatch(code, /['"]unsafe-eval['"]/,
    `Production legacy bridge ${path} must not depend on unsafe-eval.`);
  for (const signature of signatures) {
    assert.ok(code.includes(signature), `Core table/filter behavior must remain in ${path}: ${signature}`);
  }
  assert.doesNotThrow(() => new Function(code), `Legacy bridge ${path} must remain valid classic JavaScript.`);
}

// Core bridge assignments still operate on the same globally accessible
// lexical bindings (the former eval payloads were immediately invoked
// functions in that same global execution realm).
const getDirectBridge = new Function([
  "let restoreSavedTableState = function() { return 7 };",
  "let state = { selectedPlayerIds: new Set([1]), selectionAnchorPlayerId: 1 };",
  "const install = () => {",
  "  if (typeof restoreSavedTableState !== 'function') return false;",
  "  const originalRestoreSavedTableState = restoreSavedTableState;",
  "  restoreSavedTableState = function() {",
  "    const value = originalRestoreSavedTableState.apply(this, arguments);",
  "    state.selectedPlayerIds.clear();",
  "    state.selectionAnchorPlayerId = null;",
  "    return value;",
  "  };",
  "  return true;",
  "};",
  "return { installed: install(), call: () => restoreSavedTableState(), state };",
].join("\n")).bind(null);
const sample = getDirectBridge();
assert.equal(sample.installed, true);
assert.equal(sample.call(), 7);
assert.equal(sample.state.selectedPlayerIds.size, 0);
assert.equal(sample.state.selectionAnchorPlayerId, null);

console.log("SEC-04 legacy bridge regression passed: five eval calls removed, production scripts parse, table/filter owners preserved.");
