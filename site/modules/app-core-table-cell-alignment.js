// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

export function normalizeTableControlCellAlignment(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const table = String(routeChunks.table || "");
  if (!table) throw new Error("Cannot normalize table control-cell alignment without the Table route chunk.");

  let normalizedTable = replaceRequired(
    table,
    `    selectionCell.appendChild(selectionInput);\n    tableRow.appendChild(selectionCell);`,
    `    const selectionContent = document.createElement("span");\n    selectionContent.className = "tableControlCellContent tableControlCellContentCentered";\n    selectionContent.appendChild(selectionInput);\n    selectionCell.appendChild(selectionContent);\n    tableRow.appendChild(selectionCell);`,
    "checkbox content uses the shared centered row wrapper",
  );

  normalizedTable = replaceRequired(
    normalizedTable,
    `      } else if (column === flagColumn) {\n        cell.classList.add("flagCell");\n        cell.innerHTML = countryFlagHtml(getValue(row, "nationality"));\n      } else if (column === "player_id") {\n        cell.appendChild(createCopyPlayerIdButton(playerId, formatCellValue(row, column)));`,
    `      } else if (column === flagColumn) {\n        cell.classList.add("flagCell");\n        cell.innerHTML = countryFlagHtml(getValue(row, "nationality"));\n        const flagContent = document.createElement("span");\n        flagContent.className = "tableControlCellContent tableControlCellContentCentered";\n        while (cell.firstChild) flagContent.appendChild(cell.firstChild);\n        cell.appendChild(flagContent);\n      } else if (column === "player_id") {\n        const idContent = document.createElement("span");\n        idContent.className = "tableControlCellContent";\n        idContent.appendChild(createCopyPlayerIdButton(playerId, formatCellValue(row, column)));\n        cell.appendChild(idContent);`,
    "flag and player ID use the shared row wrapper",
  );

  routeChunks.table = normalizedTable;
  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze(routeChunks),
  });
}
