import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [stylesBase, styles, dropdowns, runtime] = await Promise.all([
  read("./styles-base.css"),
  read("./styles.css"),
  read("./dropdowns.css"),
  read("./dropdowns-runtime.js"),
]);

for (const required of [
  "--mfl-dropdown-gap:",
  "--mfl-dropdown-max-height:",
  "--mfl-dropdown-chevron-inset:",
  'select[data-mfl-dropdown-enhanced="true"]:open',
  '#accountButton[aria-expanded="true"]',
  "#watchlistButton::after",
  ".watchlistButtonChevron {\n  display: none;",
  ".filtersDialog select::picker(select)",
  "#pageSizeSelect::picker(select)",
  "margin-block: var(--mfl-dropdown-gap);",
]) {
  invariant(dropdowns.includes(required), `dropdowns.css is missing canonical rule: ${required}`);
}

for (const duplicate of [
  "--mfl-dropdown-max-height:",
  "--mfl-dropdown-chevron-inset:",
  'select[data-mfl-dropdown-enhanced="true"]:open',
  '#accountButton[aria-expanded="true"]',
  "#watchlistButton::after",
  ".watchlistButtonChevron {",
  ".filtersDialog select::picker(select)",
  "#pageSizeSelect::picker(select)",
]) {
  invariant(!styles.includes(duplicate), `styles.css must not duplicate dropdown ownership through ${duplicate}`);
}

for (const legacySelector of [
  ".accountMenu",
  ".accountDropdown",
  ".accountDropdownItem",
  ".accountSettingsButton",
  ".accountUserButton",
  "#accountButton",
  "#linkWalletButton",
  ".watchlistButton",
  ".watchlistDropdown",
]) {
  invariant(
    !stylesBase.includes(legacySelector),
    `styles-base.css must not retain canonical dropdown selector ${legacySelector}.`,
  );
}

for (const runtimeStyleOwner of [
  'document.createElement("style")',
  "mflDropdownRuntimeAdjustments",
  "installRuntimeStyles",
  "style.textContent",
]) {
  invariant(!runtime.includes(runtimeStyleOwner), `dropdowns-runtime.js must not inject deterministic CSS through ${runtimeStyleOwner}`);
}

console.log("Canonical dropdown CSS ownership validation passed.");
