import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [foundations, dropdowns, docs] = await Promise.all([
  read("./ui-foundations.css"),
  read("./dropdowns.css"),
  read("./docs/ui-foundations.md"),
]);

for (const token of [
  "--mfl-dropdown-background: var(--surface);",
  "--mfl-dropdown-border: 1px solid var(--border-strong);",
  "--mfl-dropdown-text-color: var(--text);",
  "--mfl-radius-dropdown: 8px;",
  "--mfl-shadow-dropdown: 0 12px 36px rgba(0, 0, 0, 0.16);",
  "--mfl-dropdown-option-background: transparent;",
  "--mfl-dropdown-option-text-color: var(--text);",
  "--mfl-radius-dropdown-option: 6px;",
  "--mfl-dropdown-option-hover-border-color: var(--border);",
  "--mfl-dropdown-option-hover-background: var(--row-hover);",
  "--mfl-dropdown-option-hover-text-color: var(--text);",
  "--mfl-dropdown-option-selected-background: color-mix(in srgb, var(--primary) 12%, var(--surface));",
  "--mfl-dropdown-option-selected-text-color: var(--primary);",
]) {
  includes(foundations, token, `Missing shared dropdown/menu visual foundation: ${token}`);
}

for (const token of [
  "border: var(--mfl-dropdown-border);",
  "border-radius: var(--mfl-radius-dropdown);",
  "background: var(--mfl-dropdown-background);",
  "color: var(--mfl-dropdown-text-color);",
  "box-shadow: var(--mfl-shadow-dropdown);",
  "border-radius: var(--mfl-radius-dropdown-option);",
  "background: var(--mfl-dropdown-option-background);",
  "color: var(--mfl-dropdown-option-text-color);",
  "background: var(--mfl-dropdown-option-hover-background);",
  "color: var(--mfl-dropdown-option-hover-text-color);",
  "background: var(--mfl-dropdown-option-selected-background);",
  "color: var(--mfl-dropdown-option-selected-text-color);",
]) {
  includes(dropdowns, token, `Canonical dropdown owner must consume shared visual foundation: ${token}`);
}

excludes(dropdowns, "--mfl-dropdown-shadow: 0 12px 36px rgba(0, 0, 0, 0.16);", "Dropdown shadow value must be foundation-owned rather than redefined by dropdown mechanics.");

for (const preserved of [
  "--mfl-dropdown-gap: 8px;",
  "--mfl-dropdown-max-height: min(320px, calc(100vh - 16px));",
  "--mfl-dropdown-chevron-inset: 10px;",
  "--mfl-dropdown-transition-duration: 150ms;",
  ".watchlistDropdownItem.active {",
  "#linkWalletButton.walletOptOut {",
  ".watchlistDropdownDelete {",
  ".playerTableActionMenu {",
  "z-index: var(--mfl-z-dropdown);",
]) {
  includes(dropdowns, preserved, `Dropdown specialist mechanics/state must remain dropdown-owned: ${preserved}`);
}

for (const token of [
  "## Dropdowns and menus",
  "`dropdowns.css` remains the sole owner of dropdown mechanics",
  "Watchlist active rows/actions",
]) {
  includes(docs, token, `Dropdown foundation ownership documentation is missing: ${token}`);
}

if (dropdowns.includes("!important")) throw new Error("Dropdown foundation migration must not introduce !important overrides.");

console.log("Shared dropdown/menu surfaces and ordinary option states consume semantic visual foundations while dropdown mechanics and specialist states remain independently owned.");
