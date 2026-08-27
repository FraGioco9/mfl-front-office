import { readFile, writeFile } from "node:fs/promises";

async function patch(path, edits) {
  let text = await readFile(path, "utf8");
  for (const [label, oldText, newText] of edits) {
    const count = text.split(oldText).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
    text = text.replace(oldText, newText);
  }
  await writeFile(path, text);
}

await patch("modules/app-core.js", [[
  "first-open lifecycle",
  `  menu.replaceChildren(...items);\n  menu.dataset.open = "true";\n  positionPlayerTableActionMenu();\n  requestAnimationFrame(() => {\n    if (playerTableActionTrigger === trigger && trigger.isConnected) positionPlayerTableActionMenu();\n  });\n  return true;`,
  `  menu.replaceChildren(...items);\n  menu.dataset.open = "false";\n  positionPlayerTableActionMenu();\n  void menu.offsetWidth;\n  requestAnimationFrame(() => {\n    if (playerTableActionTrigger !== trigger || !trigger.isConnected) return;\n    menu.dataset.open = "true";\n    positionPlayerTableActionMenu();\n  });\n  return true;`,
]]);

await patch("dropdowns.css", [[
  "menu width",
  `  width: 210px;\n  min-width: 210px;`,
  `  width: 200px;\n  min-width: 200px;`,
]]);

await patch("styles-base.css", [[
  "row hover button ownership",
  `#tableBody tr:hover .playerNameLink:hover,\n#tableBody tr:hover a:hover,\n#tableBody tr:hover button:hover,\n#tableBody tr.tableRowHovered .playerNameLink:hover,\n#tableBody tr.tableRowHovered a:hover,\n#tableBody tr.tableRowHovered button:hover {`,
  `#tableBody tr:hover .playerNameLink:hover,\n#tableBody tr:hover a:hover,\n#tableBody tr:hover button:not(.playerTableActionsButton):hover,\n#tableBody tr.tableRowHovered .playerNameLink:hover,\n#tableBody tr.tableRowHovered a:hover,\n#tableBody tr.tableRowHovered button:not(.playerTableActionsButton):hover {`,
]]);

await patch("validate-player-table-actions.mjs", [
  [
    "validator sources",
    `const [source, generatedTable, bootstrap, styles, dropdowns] = await Promise.all([`,
    `const [source, generatedTable, bootstrap, styles, dropdowns, baseStyles] = await Promise.all([`,
  ],
  [
    "validator base styles",
    `  read("./dropdowns.css"),\n]);`,
    `  read("./dropdowns.css"),\n  read("./styles-base.css"),\n]);`,
  ],
  [
    "validator width",
    `    && dropdowns.includes("width: 210px;")\n    && dropdowns.includes("min-width: 210px;")`,
    `    && dropdowns.includes("width: 200px;")\n    && dropdowns.includes("min-width: 200px;")`,
  ],
  [
    "validator lifecycle insertion",
    `invariant(\n  source.includes('document.addEventListener("pointerdown", (event) => {')`,
    `invariant(\n  source.includes('menu.dataset.open = "false";')\n    && source.includes('void menu.offsetWidth;')\n    && source.includes('if (playerTableActionTrigger !== trigger || !trigger.isConnected) return;')\n    && source.includes('menu.dataset.open = "true";')\n    && generatedTable.includes('void menu.offsetWidth;'),\n  "Player table menu must paint its closed state before opening so first use gets the canonical transition.",\n);\n\ninvariant(\n  baseStyles.includes('#tableBody tr:hover button:not(.playerTableActionsButton):hover')\n    && baseStyles.includes('#tableBody tr.tableRowHovered button:not(.playerTableActionsButton):hover'),\n  "Table row hover cleanup must not suppress the Player action trigger account-style hover state.",\n);\n\ninvariant(\n  source.includes('document.addEventListener("pointerdown", (event) => {')`,
  ],
  [
    "validator message",
    `use compact menu typography and account-button hover`,
    `use compact menu typography, first-open motion, and account-button hover`,
  ],
]);
