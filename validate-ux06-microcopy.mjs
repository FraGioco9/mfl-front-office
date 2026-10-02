import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const source = path => readFileSync(resolve(root, path), "utf8");
const dialogs = source("html-sources/dialogs.html");
const planner = source("html-sources/planner.html");
const settings = source("modules/core-sources/settings.js");

const check = (text, pattern, message) => assert.match(text, pattern, message);
check(dialogs, /<h2 id="evaluationLoadTitle">Saved evaluations<\/h2>/, "Saved Evaluations picker uses a plural collection title.");
check(dialogs, /aria-label="Close saved evaluations"/, "Close button announces the same collection as its dialog.");
check(planner, /Viewing shared plan <strong id="plannerSharedPlanName"><\/strong> — read-only<\/span>/, "Planner labels the shared view read-only.");
check(planner, /id="plannerPlayerModalCloseButton"[^>]+aria-label="Close add players"/, "Planner Add players close control uses sentence case.");
check(settings, /settingsEmailSaveButton\.setAttribute\("aria-label", "Save settings changes"\)/, "Settings Save action has a consistent accessible name.");
assert.doesNotMatch(dialogs, /<h2 id="evaluationLoadTitle">Load saved evaluation<\/h2>/, "Stale singular list heading must not return.");
assert.doesNotMatch(planner, /— read only<\/span>/, "Stale read-only copy must not return.");
assert.doesNotMatch(settings, /"Save all Settings changes"/, "Stale Settings action label must not return.");

// Copy-only changes must not change dialog wiring, relevant action IDs or destructive semantics.
for (const id of ["evaluationLoadModal", "closeEvaluationLoadButton", "evaluationDeleteModal", "evaluationDeleteModalConfirmButton"]) {
  check(dialogs, new RegExp('id="' + id + '"'), id + " remains in the canonical dialog markup.");
}
for (const id of ["plannerSharedBanner", "plannerCopySharedPlanButton", "plannerPlayerModalCloseButton", "plannerPlanDeleteConfirmButton", "plannerPlanRevokeConfirmButton"]) {
  check(planner, new RegExp('id="' + id + '"'), id + " remains in the canonical Planner markup.");
}
check(settings, /showToast\("Settings saved\."\)/, "Save success message is unaffected.");
console.log("UX-06 microcopy canonical-source checks passed.");
