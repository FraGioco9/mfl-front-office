import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, generatedTable, bootstrap, styles, dropdowns] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
  read("./dropdowns.css"),
]);

for (const code of [source, generatedTable]) {
  invariant(
    code.includes('"col-select",\n    "col-actions",')
      && code.includes('actionsHeader.className = "rowActionsCell";')
      && code.includes('actionsContent.appendChild(createPlayerTableActionsButton(playerId));'),
    "Player table actions must own a real column between selection and ID in canonical and generated table code.",
  );
  invariant(
    code.includes('createPlayerTableActionItem("profile", "Player profile", "profile")')
      && code.includes('createPlayerTableActionItem("mfl", "MFL profile", "external")')
      && code.includes('createPlayerTableActionItem("evaluate", "Evaluate", "evaluate")')
      && code.includes('watchlistIsActive ? "Remove from watchlist" : "Add to watchlist"')
      && code.includes('watchlistIsActive ? "watchlistFilled" : "watchlist"')
      && code.includes('createPlayerTableActionItem("copy", `#${key}`, "copy")')
      && !code.includes('createPlayerTableActionItem("copy", "Copy ID", "copy")'),
    "Player table dropdown must expose the requested action labels and dynamic #ID copy label without the legacy Copy ID label.",
  );
  invariant(
    code.includes('void setPage("player", true, { playerId });')
      && code.includes('https://app.playmfl.com/players/${encodeURIComponent(playerId)}')
      && code.includes('void setPage("evaluation", true, { playerId });')
      && code.includes('toggleWatchlistPlayer(playerId, true);')
      && code.includes('copyPlayerId(playerId);'),
    "Player table dropdown actions must reuse canonical navigation, watchlist, and copy behavior.",
  );
  invariant(
    code.includes('PLAYER_TABLE_ACTION_ICONS = Object.freeze({')
      && code.includes('profile:')
      && code.includes('external:')
      && code.includes('evaluate:')
      && code.includes('watchlist:')
      && code.includes('watchlistFilled:')
      && code.includes('copy:'),
    "Each Player table action must retain its own icon.",
  );
  invariant(
    code.includes('M12 3v18')
      && code.includes('M17 7.5c-.8-1.4-2.4-2.2-5-2.2-3 0-5 1.3-5 3.4 0 2.4 2.4 3.1 5 3.4 3 .4 5 1.1 5 3.4 0 2.1-2 3.4-5 3.4-2.7 0-4.4-.9-5.3-2.5')
      && code.includes('let left = triggerRect.left;'),
    "Table Evaluate must use the exact Player-page valuation icon and the menu must anchor to the trigger left edge.",
  );
}

invariant(
  bootstrap.includes('["col-select", "col-actions", ...columns.map((column) => firstPaintTableColumnClass(column))]')
    && bootstrap.includes('actionsHeader.className = "rowActionsCell";'),
  "Static first-paint table structure must reserve the Player actions column before data loads.",
);

invariant(
  styles.includes("--mfl-table-col-actions: 2.35%;")
    && styles.includes("--mfl-table-col-name: 13.63%;")
    && styles.includes("col.col-actions { width: var(--mfl-table-col-actions); }"),
  "Uniform Width must own the new action column without overflowing the table width contract.",
);

invariant(
  dropdowns.includes(".playerTableActionMenu")
    && dropdowns.includes('[data-open="true"]')
    && dropdowns.includes("var(--mfl-motion-standard, 180ms)")
    && dropdowns.includes("border: 1px solid var(--primary);")
    && dropdowns.includes("background: var(--primary);")
    && dropdowns.includes(`.playerTableActionsButton[aria-expanded="true"] {\n  outline: 0;\n  border-color: var(--primary);\n  background: var(--primary);\n  color: #ffffff;`)
    && dropdowns.includes("width: 250px;")
    && dropdowns.includes("min-width: 250px;")
    && dropdowns.includes('.playerTableActionIcon svg[data-filled="true"]')
    && dropdowns.includes("fill: currentColor;")
    && dropdowns.includes("transform-origin: top left;")
    && dropdowns.includes(".playerTableActionItem:hover:not(:disabled)")
    && dropdowns.includes("background: var(--row-hover);")
    && dropdowns.includes("align-items: center;")
    && dropdowns.includes("align-self: center;")
    && dropdowns.includes("color: #ffffff;")
    && dropdowns.includes(".playerTableActionIcon"),
  "Player table actions must match active-view trigger styling, keep icons centered/white, fill the remove-watchlist star, keep the wider menu, reuse row-selector hover, preserve left-edge motion, and retain canonical timing.",
);

invariant(
  source.includes('document.addEventListener("pointerdown", (event) => {')
    && source.includes('event.key !== "Escape"')
    && source.includes('window.addEventListener("resize", () => closePlayerTableActionMenu());')
    && source.includes('.addEventListener("scroll", () => closePlayerTableActionMenu(), { passive: true });'),
  "Player table menu must close on outside press, Escape, resize, and table scroll.",
);

console.log("Player table actions validation passed.");
