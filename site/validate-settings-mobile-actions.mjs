import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [responsive, bootstrap, stylesBase] = await Promise.all([
  read("./responsive.css"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
]);

invariant(
  bootstrap.includes('actions.setAttribute("data-settings-page-actions", "true");'),
  "Settings first paint must keep a stable page-actions marker for responsive layout ownership.",
);

invariant(
  responsive.includes(".settingsDateFormatOptions,\n  .settingsEmailAddressRow:not([data-settings-page-actions]) {\n    display: grid;\n    grid-template-columns: 1fr;\n  }"),
  "Small-screen Settings field rows must keep their existing one-column layout without stacking the page actions.",
);

invariant(
  responsive.includes(".settingsEmailAddressRow[data-settings-page-actions] {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 8px;\n  }"),
  "Small-screen Settings Discard and Save actions must share one two-column row.",
);

invariant(
  responsive.includes(".settingsEmailAddressRow[data-settings-page-actions] .settingsEmailActionButton {\n    min-width: 0;\n    padding-inline: 12px;\n  }"),
  "Small-screen Settings actions must be allowed to narrow within their two-column row.",
);

invariant(
  stylesBase.includes(".settingsEmailActionButton {\n  height: 38px;\n  min-width: 84px;"),
  "Settings action buttons must preserve the canonical desktop height and minimum width outside the responsive override.",
);

invariant(
  !responsive.includes(".settingsEmailAddressRow[data-settings-page-actions] {\n    display: grid;\n    grid-template-columns: 1fr;"),
  "Settings page actions must never collapse back to one column on small screens.",
);

invariant(!responsive.includes("!important"), "Responsive Settings actions must not introduce !important overrides.");

console.log("Small-screen Settings keeps Discard and Save on one compact row while desktop and field-row geometry remain unchanged.");
