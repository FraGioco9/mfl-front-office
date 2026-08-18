import { readFile } from "node:fs/promises";

const [dataPage, dataQuery, styles, stylesBase, responsive, dropdowns, scrollbars, controlInteractions, filterControls] = await Promise.all([
  readFile(new URL("./api/_data-page.js", import.meta.url), "utf8"),
  readFile(new URL("./api/_data-query.js", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
  readFile(new URL("./styles-base.css", import.meta.url), "utf8"),
  readFile(new URL("./responsive.css", import.meta.url), "utf8"),
  readFile(new URL("./dropdowns.css", import.meta.url), "utf8"),
  readFile(new URL("./scrollbars.css", import.meta.url), "utf8"),
  readFile(new URL("./control-interactions-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("./filter-controls-runtime.js", import.meta.url), "utf8"),
]);

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

invariant(
  dataQuery.includes('const TABLE_SCOPES = new Set([\n  "database", "progression", "mfl", "agent", "myplayers", "watchlist",\n]);'),
  "MFL Stats must remain outside the table-only hidden joined-agency-date scope so those players can be categorized as Other.",
);

invariant(
  dataPage.includes("if (TABLE_SCOPES.has(scope)) {")
    && !dataPage.includes('TABLE_SCOPES.has(scope) && scope !== "mflstats"'),
  "Hidden joined-agency-date filtering must be owned only by the canonical TABLE_SCOPES classification.",
);

invariant(
  dataPage.includes('const pageSize = scope === "mflstats"\n    ? Math.max(1, totalRows)'),
  "MFL Stats must load its complete MFL-wallet population instead of inheriting a fixed page-size cap.",
);

const sharedControlSelector = ":is(.navButton, .viewButton:not([hidden]), .mflStatsFilterButton, .mflStatsDistributionModeButton)";
invariant(
  styles.includes(`${sharedControlSelector}:not(.active) {\n  cursor: pointer;\n}`),
  "Every non-active page, view, and Stats filter button must use the pointer cursor.",
);
invariant(
  styles.includes(`${sharedControlSelector}.active {\n  cursor: default;\n}`),
  "Every active page, view, and Stats filter button must use the default cursor.",
);
invariant(
  styles.includes(`${sharedControlSelector}:not(.active):hover:not(:disabled) {`),
  "Only non-active page, view, and Stats filter buttons may receive the shared hover highlight.",
);
invariant(
  styles.includes(`${sharedControlSelector}.active:hover {`),
  "Active page, view, and Stats filter buttons must retain their active paint while hovered.",
);

const statsFilterSizeRule = /\.mflStatsFilterButton\s*\{[^}]*\bwidth:\s*86px;[^}]*\bheight:\s*26px;/s;
const competingStatsFilterSizeRule = /\.mflStatsFilterButton\s*\{[^}]*\b(?:width|height|min-width|max-width)\s*:/s;

invariant(
  statsFilterSizeRule.test(stylesBase),
  "styles-base.css must remain the owner of the shared Stats Overall-filter intrinsic dimensions.",
);
invariant(
  /\.mflStatsFilterButton\s*\{[^}]*flex:\s*1 1 86px;[^}]*min-width:\s*86px;/s.test(styles),
  "Database Stats and MFL Stats Overall filters must share a fixed intrinsic flex basis while filling all available filter-box width.",
);

for (const [fileName, source] of [
  ["responsive.css", responsive],
  ["dropdowns.css", dropdowns],
  ["scrollbars.css", scrollbars],
]) {
  invariant(
    !competingStatsFilterSizeRule.test(source),
    `${fileName} must not assign a second size to Stats Overall-filter buttons.`,
  );
}

invariant(
  controlInteractions.includes('"#sidebar .navButton.active[data-page]"')
    && controlInteractions.includes('".viewButton.active[data-view]"')
    && controlInteractions.includes('".mflStatsFilterButton.active"')
    && controlInteractions.includes('".mflStatsDistributionModeButton.active"')
    && controlInteractions.includes("event.stopImmediatePropagation();"),
  "The universal interaction runtime must consume active page, view, and filter controls as no-op interactions.",
);
invariant(
  !filterControls.includes("consumeActiveStatsControlEvent")
    && !filterControls.includes("installActiveStatsViewNoop"),
  "Stats-specific active-control blocking must not compete with the universal interaction owner.",
);

console.log("MFL Stats data, stable filter geometry, and global page/view/filter interaction behavior are canonical.");
