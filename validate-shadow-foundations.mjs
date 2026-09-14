import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};

const [foundations, stylesBase, styles, dropdowns, mobileChrome, docs] = await Promise.all([
  read("./ui-foundations.css"),
  read("./styles-base.css"),
  read("./styles.css"),
  read("./dropdowns.css"),
  read("./responsive-sources/chrome-tablet.css.inc"),
  read("./docs/ui-foundations.md"),
]);

const shadowFoundations = [
  "--mfl-shadow-tooltip: 0 10px 26px rgba(0, 0, 0, 0.28);",
  "--mfl-shadow-dropdown: 0 12px 36px rgba(0, 0, 0, 0.16);",
  "--mfl-shadow-modal: 0 20px 80px rgba(0, 0, 0, 0.28);",
  "--mfl-shadow-mobile-navigation: 0 10px 28px rgba(0, 0, 0, 0.18);",
];
for (const token of shadowFoundations) {
  includes(foundations, token, `Missing shared shadow foundation: ${token}`);
}

includes(styles, "box-shadow: var(--mfl-shadow-tooltip);", "Tooltip surface must consume the shared tooltip shadow foundation.");
includes(dropdowns, "box-shadow: var(--mfl-shadow-dropdown);", "Dropdown surfaces must consume the shared dropdown shadow foundation.");
includes(stylesBase, "box-shadow: var(--mfl-shadow-modal);", "Ordinary dialog shell must consume the shared modal shadow foundation.");
includes(mobileChrome, "box-shadow: var(--mfl-shadow-mobile-navigation);", "Mobile navigation rail must consume the shared mobile-navigation shadow foundation.");

excludes(mobileChrome, "box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);", "Mobile navigation must not duplicate the shared shadow literal outside ui-foundations.css.");

includes(docs, "tooltip, dropdown, modal, and mobile-navigation shadows", "UI-foundation documentation must preserve the intentionally distinct shadow roles.");
includes(docs, "Dropdown visual surface/radius/shadow values are foundation-owned", "Dropdown documentation must distinguish visual foundations from dropdown mechanics ownership.");

console.log("Tooltip, dropdown, modal, and mobile-navigation shadows each consume their canonical semantic foundation without flattening distinct roles.");
