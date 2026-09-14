import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [styles, phone, foundations, statsValidator, docs] = await Promise.all([
  read("./styles.css"),
  read("./responsive-sources/evaluation-phone.css.inc"),
  read("./ui-foundations.css"),
  read("./validate-database-stats-lazy-runtime.mjs"),
  read("./docs/ui-foundations.md"),
]);

for (const token of [
  "--mfl-dropdown-border: 1px solid var(--border-strong);",
  "--mfl-radius-dropdown: 8px;",
  "--mfl-dropdown-background: var(--surface);",
  "--mfl-dropdown-text-color: var(--text);",
  "--mfl-shadow-dropdown: 0 12px 36px rgba(0, 0, 0, 0.16);",
  "--mfl-radius-dialog: 8px;",
]) {
  includes(foundations, token, `Final UI audit requires semantic foundation ${token}`);
}

const customMenuStart = styles.indexOf("#databaseStatsPage #databaseStatsCustomFilter {");
const customMenuEnd = styles.indexOf("\n}", customMenuStart);
const customMenu = customMenuStart >= 0 && customMenuEnd > customMenuStart
  ? styles.slice(customMenuStart, customMenuEnd + 2)
  : "";
for (const token of [
  "border: var(--mfl-dropdown-border);",
  "border-radius: var(--mfl-radius-dropdown);",
  "background: var(--mfl-dropdown-background);",
  "color: var(--mfl-dropdown-text-color);",
  "box-shadow: var(--mfl-shadow-dropdown);",
]) {
  includes(customMenu, token, `Database Stats Custom menu must consume dropdown visual foundation ${token}`);
  includes(statsValidator, `"${token}"`, `Database Stats regression validation must require ${token}`);
}

const retiredShadow = "--mfl-dropdown-" + "shadow";
excludes(styles, retiredShadow, "Production styles must not reference the retired dropdown-shadow token.");
excludes(statsValidator, retiredShadow, "Validators must not preserve the retired dropdown-shadow token.");
excludes(customMenu, "var(--mfl-radius-dialog)", "Database Stats Custom is a dropdown surface and must not consume the dialog radius.");

const phoneDialogFrame = "#advancedSettingsModal .advancedSettingsDialog,\n  #evaluationLoadModal .evaluationLoadDialog {\n    width: min(100%, 420px);\n    max-width: 420px;\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));\n  }";
includes(phone, phoneDialogFrame, "Phone dialogs must retain their existing responsive frame geometry.");
excludes(
  phone,
  "#advancedSettingsModal .advancedSettingsDialog,\n  #evaluationLoadModal .evaluationLoadDialog {\n    width: min(100%, 420px);\n    max-width: 420px;\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));\n    border-radius: 8px;",
  "Responsive dialog geometry must not re-own the shared dialog radius.",
);

for (const token of [
  "Database Stats Custom keeps specialist layout/positioning while its ordinary menu shell consumes the shared dropdown visual foundations.",
  "Responsive dialog owners may change dimensions but must not re-declare the shared dialog shell radius/surface/border/shadow.",
]) {
  includes(docs, token, `Final UI audit ownership documentation is missing: ${token}`);
}

console.log("Final UI foundations audit passed: no retired dropdown shadow owner, Database Stats consumes dropdown visuals, and responsive dialogs keep geometry-only ownership.");
