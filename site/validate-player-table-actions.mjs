import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [source, generatedTable, bootstrap, styles, dropdowns, baseStyles, playerRuntime] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-table-runtime.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
  read("./dropdowns.css"),
  read("./styles-base.css"),
  read("./modules/app-core-player-runtime.js"),
]);

for (const code of [source, generatedTable]) {
  invariant(
    code.includes('"col-select",\n    "col-actions",')
      && code.includes('actionsHeader.className = "rowActionsCell";')
      && code.includes('actionsContent.appendChild(createPlayerTableActionsButton(playerId));'),
    "Player table actions must own a real column between selection and the player data columns in canonical and generated table code.",
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
      && code.includes('const playerRow = state.rows.find((row) => String(getValue(row, "player_id")) === playerId);')
      && code.includes('const playerName = playerRow ? formatCellValue(playerRow, "name") : "";')
      && code.includes('rememberEvaluationResult(playerId);')
      && code.includes('state.evaluationPlayerId = playerId;')
      && code.includes('evaluationSearchInput.value = playerName;')
      && code.includes('sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${playerId}`, playerName);')
      && code.includes('clearEvaluationSearchFocus();')
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
    code.includes('r="1.25"')
      && code.includes('M12 3v18')
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
  styles.includes("--mfl-table-col-actions: 2.5029289594205983%;")
    && styles.includes("--mfl-table-col-name: 14.516987964639473%;")
    && !styles.includes("--mfl-table-col-id:")
    && !styles.includes("--mfl-table-col-link:")
    && styles.includes("col.col-actions { width: var(--mfl-table-col-actions); }"),
  "Uniform Width must own the action column inside the rebuilt no-Link table width contract.",
);

invariant(
  dropdowns.includes(".playerTableActionMenu")
    && dropdowns.includes('[data-open="true"]')
    && dropdowns.includes("var(--mfl-motion-standard, 180ms)")
    && dropdowns.includes("border: 1px solid var(--primary);")
    && dropdowns.includes("background: var(--primary);")
    && dropdowns.includes("border-color: var(--primary-hover);")
    && dropdowns.includes("background: var(--primary-hover);")
    && dropdowns.includes(`.playerTableActionsButton[aria-expanded="true"],`)
    && dropdowns.includes("width: 200px;")
    && dropdowns.includes("min-width: 200px;")
    && dropdowns.includes("height: 29px;")
    && dropdowns.includes("font-size: 12px;")
    && dropdowns.includes("font-weight: 600;")
    && dropdowns.includes('.playerTableActionIcon svg[data-filled="true"]')
    && dropdowns.includes("fill: currentColor;")
    && dropdowns.includes("transform-origin: top left;")
    && dropdowns.includes(".playerTableActionItem:hover:not(:disabled)")
    && dropdowns.includes("background: var(--row-hover);")
    && dropdowns.includes("align-items: center;")
    && dropdowns.includes("align-self: center;")
    && dropdowns.includes("color: #ffffff;")
    && dropdowns.includes(".playerTableActionIcon"),
  "Player table actions must match active-view trigger styling, keep icons centered/white, fill the remove-watchlist star, use compact menu typography, first-open motion, and account-button hover, reuse row-selector hover, preserve left-edge motion, and retain canonical timing.",
);

const playerTableActionIconStart = dropdowns.indexOf(".playerTableActionIcon {");
const playerTableActionIconEnd = dropdowns.indexOf(".playerTableActionIcon svg {", playerTableActionIconStart);
const playerTableActionIconCss = playerTableActionIconStart >= 0 && playerTableActionIconEnd > playerTableActionIconStart
  ? dropdowns.slice(playerTableActionIconStart, playerTableActionIconEnd)
  : "";
invariant(
  playerTableActionIconCss.includes("color: var(--text);")
    && !playerTableActionIconCss.includes("color: #ffffff;"),
  "Player table action icons must use the theme-aware text color at rest so they remain visible in light and dark dropdown surfaces.",
);

invariant(
  dropdowns.includes('.playerTableActionItem:hover:not(:disabled) .playerTableActionIcon,\n.playerTableActionItem:focus-visible:not(:disabled) .playerTableActionIcon {\n  color: #ffffff;'),
  "Player table action icons must remain white only in the highlighted hover/focus state.",
);

invariant(
  playerRuntime.includes('item.style.background = "var(--row-hover)";')
    && playerRuntime.includes('item.style.borderColor = "var(--border)";')
    && dropdowns.includes('#pageSizeSelect option {\n    box-sizing: border-box;\n    border: 1px solid transparent;')
    && dropdowns.includes('#pageSizeSelect option:hover,\n  #pageSizeSelect option:focus-visible {\n    outline: 0;\n    border-color: var(--border);\n    background: var(--row-hover);')
    && dropdowns.includes('padding: 0 8px;\n  border: 1px solid transparent;\n  font-size: 12px;')
    && dropdowns.includes('.playerTableActionItem:hover:not(:disabled),\n.playerTableActionItem:focus-visible:not(:disabled) {\n  outline: 0;\n  border-color: var(--border);\n  background: var(--row-hover);'),
  "Player table action items and row selector options must match the Player hero action menu hover border/background contract.",
);

invariant(
  dropdowns.includes('.accountDropdownItem {\n  box-sizing: border-box;\n  border: 1px solid transparent;')
    && dropdowns.includes('.accountDropdown button.accountDropdownItem:hover:not(:disabled),\n.accountDropdown button.accountDropdownItem:focus-visible:not(:disabled) {\n  border-color: var(--border);\n  outline: 0;\n  background: var(--row-hover);')
    && dropdowns.includes('.accountDropdown .accountSettingsButton,\n.accountDropdown .accountSettingsButton:not(:disabled) {\n  border-color: transparent;')
    && !dropdowns.includes('.accountDropdown .accountSettingsButton:hover:not(:disabled)')
    && source.includes('linkWalletButton.removeAttribute("title");')
    && !source.includes('linkWalletButton.title = walletLinked ? "Opt out of Dapper wallet access" : "Opt in with Dapper";'),
  "Account dropdown items must match the Player hero action-menu hover contract and Opt In/Out must not expose title tooltips.",
);

invariant(
  source.includes('menu.dataset.open = "false";')
    && source.includes('void menu.offsetWidth;')
    && source.includes('if (playerTableActionTrigger !== trigger || !trigger.isConnected) return;')
    && source.includes('menu.dataset.open = "true";')
    && generatedTable.includes('void menu.offsetWidth;'),
  "Player table menu must paint its closed state before opening so first use gets the canonical transition.",
);

invariant(
  baseStyles.includes('#tableBody tr:hover button:not(.playerTableActionsButton):hover')
    && baseStyles.includes('#tableBody tr.tableRowHovered button:not(.playerTableActionsButton):hover'),
  "Table row hover cleanup must not suppress the Player action trigger account-style hover state.",
);

for (const code of [source, generatedTable]) {
  invariant(
    code.includes("function currentPlayerTableActionRenderSignature(")
      && code.includes("function restorePlayerTableActionMenuAfterRender(renderSignature)")
      && code.includes('const preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"')
      && code.includes("restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);")
      && !code.includes('function renderTable() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;\n  closePlayerTableActionMenu();'),
    "Passive table rerenders must preserve and re-anchor an open Player action menu instead of unconditionally closing it.",
  );
}

invariant(
  source.includes('document.addEventListener("pointerdown", (event) => {')
    && source.includes('event.key !== "Escape"')
    && source.includes('window.addEventListener("resize", handlePlayerTableActionWindowResize);')
    && source.includes('const realWindowResize = Boolean(')
    && source.includes('handlePlayerTableActionScrollerScroll(tableScroller)'),
  "Player table menu must still close on outside press, Escape, real window resize, and real table scroll while ignoring internal layout-only resize events.",
);

console.log("Player table actions validation passed.");
