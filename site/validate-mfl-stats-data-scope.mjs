import { readFile } from "node:fs/promises";

const [dataPage, dataQuery, styles, stylesBase, responsive, dropdowns, scrollbars, filterControls] = await Promise.all([
  readFile(new URL("./api/_data-page.js", import.meta.url), "utf8"),
  readFile(new URL("./api/_data-query.js", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
  readFile(new URL("./styles-base.css", import.meta.url), "utf8"),
  readFile(new URL("./responsive.css", import.meta.url), "utf8"),
  readFile(new URL("./dropdowns.css", import.meta.url), "utf8"),
  readFile(new URL("./scrollbars.css", import.meta.url), "utf8"),
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

invariant(
  /\.viewButton:not\(\[hidden\]\):not\(\.active\)\s*\{[^}]*cursor:\s*pointer;/s.test(styles),
  "Non-active view buttons must use the pointer cursor.",
);

invariant(
  /\.viewButton\.active,\s*\.mflStatsFilterButton,\s*\.mflStatsDistributionModeButton\s*\{[^}]*cursor:\s*default;/s.test(styles),
  "Active views and Stats selection controls must keep the default cursor.",
);

const statsFilterSizeRule = /\.mflStatsFilterButton\s*\{[^}]*\bwidth:\s*86px;[^}]*\bheight:\s*26px;/s;
const competingStatsFilterSizeRule = /\.mflStatsFilterButton\s*\{[^}]*\b(?:width|height|min-width|max-width)\s*:/s;

invariant(
  statsFilterSizeRule.test(stylesBase),
  "styles-base.css must remain the single owner of the shared Stats Overall-filter intrinsic dimensions.",
);

for (const [fileName, source] of [
  ["styles.css", styles],
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
  /\.mflStatsFilterButton\s*\{[^}]*flex:\s*1 1 auto;/s.test(styles),
  "Database Stats and MFL Stats Overall filters must share the same flex-growth rule and fill the available filter-box width.",
);

invariant(
  filterControls.includes('".mflStatsFilterButton.active, .mflStatsDistributionModeButton.active"')
    && filterControls.includes("event.stopImmediatePropagation();"),
  "Active Overall filters and Overall/Age controls must be consumed as no-op interactions.",
);

console.log("MFL Stats data, shared filter layout, control interaction, and view-button cursors are canonical.");
