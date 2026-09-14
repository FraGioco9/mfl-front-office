import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");
const foundations = read("ui-foundations.css");
const base = read("styles-base.css");
const footer = read("footer.css");
const dialogs = read("html-sources/dialogs.html");
const staticHtml = read("html-sources/static.html");
const bugRuntime = read("bug-report-runtime.js");
const responsiveSources = [
  read("responsive-sources/parity.css.inc"),
  read("responsive-sources/tables-tablet.css.inc"),
  read("responsive-sources/tables-phone.css.inc"),
  read("responsive-sources/static-phone.css.inc"),
  read("responsive-sources/evaluation-phone.css.inc"),
  read("responsive-sources/filters-tablet.css.inc"),
  read("responsive-sources/compact.css.inc"),
].join("\n");

for (const token of [
  "--mfl-modal-backdrop-background: rgba(0, 0, 0, 0.45);",
  "--mfl-dialog-background: var(--surface);",
  "--mfl-dialog-border: 1px solid var(--border);",
  "--mfl-dialog-divider: 1px solid var(--border);",
  "--mfl-radius-dialog: 8px;",
  "--mfl-shadow-modal: 0 20px 80px rgba(0, 0, 0, 0.28);",
]) assert.ok(foundations.includes(token), `Missing shared dialog foundation: ${token}`);

assert.ok(base.includes(".modalBackdrop {\n  position: fixed;") && base.includes("background: var(--mfl-modal-backdrop-background);") && base.includes("transition: opacity var(--mfl-motion-standard) ease;"), "Modal backdrop must consume shared surface and canonical motion timing.");
assert.ok(base.includes(".modalBackdrop > section {\n  opacity: 0;\n  transform: translateY(8px) scale(0.98);\n  transition: opacity var(--mfl-motion-standard) ease, transform var(--mfl-motion-standard) ease;"), "Dialog entrance transform must consume canonical standard motion timing without changing geometry.");
assert.ok(base.includes(".mflDialog {\n  display: flex;\n  flex-direction: column;\n  border: var(--mfl-dialog-border);\n  border-radius: var(--mfl-radius-dialog);\n  background: var(--mfl-dialog-background);\n  box-shadow: var(--mfl-shadow-modal);"), "Ordinary dialog shells must share one semantic structure.");
assert.ok(base.includes(".mflDialogHeader,\n.mflDialogFooter {\n  display: flex;") && base.includes("border-bottom: var(--mfl-dialog-divider);") && base.includes(".mflDialogFooter {\n  justify-content: flex-end;\n  border-top: var(--mfl-dialog-divider);"), "Ordinary dialog header/footer chrome must share one semantic owner.");

for (const className of ["filtersDialog", "evaluationLoadDialog", "watchlistChoiceDialog", "addWatchlistDialog", "deleteWatchlistDialog", "advancedSettingsDialog"]) {
  assert.ok(dialogs.includes(`class="mflDialog ${className}"`), `Dialog markup must consume mflDialog: ${className}`);
}
assert.ok(staticHtml.includes('class="mflDialog searchDialog"'), "Search must consume mflDialog from canonical static HTML.");
assert.ok(bugRuntime.includes('class="mflDialog bugReportDialog"'), "Bug Report must consume mflDialog from its runtime-owned markup.");

const legacyHeader = ["filters", "Header"].join("");
const legacyFooter = ["filters", "Footer"].join("");
for (const [name, source] of [["dialogs", dialogs], ["static", staticHtml], ["bug runtime", bugRuntime], ["responsive", responsiveSources], ["base", base]]) {
  assert.ok(!source.includes(legacyHeader) && !source.includes(legacyFooter), `Filter-named classes must not remain accidental shared dialog primitives in ${name}.`);
}

for (const selector of [".filtersDialog", ".advancedSettingsDialog", ".deleteWatchlistDialog", ".addWatchlistDialog", ".searchDialog", ".evaluationLoadDialog", ".watchlistChoiceDialog"]) {
  const start = base.indexOf(`${selector} {`);
  const end = base.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, `Missing specialist dialog rule ${selector}`);
  const rule = base.slice(start, end + 2);
  for (const duplicate of ["border: 1px solid var(--border);", "border-radius: 8px;", "background: var(--surface);", "box-shadow: 0 20px 80px rgba(0, 0, 0, 0.28);"]) {
    assert.ok(!rule.includes(duplicate), `${selector} must not duplicate shared dialog shell declaration: ${duplicate}`);
  }
}
for (const duplicate of ["border: 1px solid var(--border);", "border-radius: var(--mfl-radius-dialog);", "background: var(--surface);", "box-shadow: var(--mfl-shadow-modal);"]) {
  const start = footer.indexOf(".bugReportDialog {");
  const end = footer.indexOf("\n}", start);
  assert.ok(!footer.slice(start, end + 2).includes(duplicate), `Bug Report must inherit shared dialog shell declaration: ${duplicate}`);
}

assert.ok(!base.includes("transition: opacity 180ms ease;"), "Modal backdrop must not duplicate the canonical 180ms motion literal.");
console.log("Ordinary modals share one semantic backdrop/shell/header/footer foundation while specialist dialog geometry and behavior remain independently owned.");
