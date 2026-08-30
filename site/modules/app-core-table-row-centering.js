// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

export function addTableRowVerticalCentering(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  let table = String(routeChunks.table || "").replace(/\r\n?/g, "\n");
  if (!String(input.core || "").trim()) {
    throw new Error("Cannot add table row vertical centering before the application core exists.");
  }
  if (!table.trim()) {
    throw new Error("Cannot add table row vertical centering before the Table route chunk exists.");
  }

  table = replaceRequired(
    table,
    "function tableRenderTableOwner() {",
    `function tableCenterCellContents(cell) {
  if (!(cell instanceof HTMLTableCellElement)) return cell;
  const existingHost = cell.childNodes.length === 1
    && cell.firstElementChild instanceof HTMLElement
    && cell.firstElementChild.classList.contains("tableControlCellContent")
    ? cell.firstElementChild
    : null;
  if (existingHost) return cell;

  const contentHost = document.createElement("span");
  contentHost.className = "tableControlCellContent";
  while (cell.firstChild) contentHost.appendChild(cell.firstChild);
  cell.appendChild(contentHost);
  return cell;
}

function tableRenderTableOwner() {`,
    "shared table-row vertical-centering helper",
  );

  table = replaceRequired(
    table,
    "    tableRow.appendChild(selectionCell);",
    "    tableRow.appendChild(tableCenterCellContents(selectionCell));",
    "selection cell vertical-centering contract",
  );

  table = replaceRequired(
    table,
    "    tableRow.appendChild(actionsCell);",
    "    tableRow.appendChild(tableCenterCellContents(actionsCell));",
    "actions cell vertical-centering contract",
  );

  table = replaceRequired(
    table,
    "      tableRow.appendChild(cell);",
    "      tableRow.appendChild(tableCenterCellContents(cell));",
    "all rendered table cells vertical-centering contract",
  );

  return Object.freeze({
    ...input,
    routeChunks: Object.freeze({ ...routeChunks, table }),
  });
}
