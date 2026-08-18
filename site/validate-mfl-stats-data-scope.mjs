import { readFile } from "node:fs/promises";

const [dataPage, dataQuery, styles] = await Promise.all([
  readFile(new URL("./api/_data-page.js", import.meta.url), "utf8"),
  readFile(new URL("./api/_data-query.js", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
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
  styles.includes('.viewButton:not([hidden]) {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  line-height: 1;\n  text-align: center;\n  cursor: default;\n}'),
  "View buttons must define the default cursor in their canonical rule instead of through an active-state override.",
);

console.log("MFL Stats loads the complete canonical population and view buttons keep their canonical default cursor.");
