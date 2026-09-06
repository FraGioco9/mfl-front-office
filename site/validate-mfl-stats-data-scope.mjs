import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [dataPage, dataQuery, styles, stylesBase, controls, responsive, dropdowns, scrollbars, bootstrapCore, controlInteractions, filterControls] = await Promise.all([
  read("./api/_data-page.js"),
  read("./api/_data-query.js"),
  read("./styles.css"),
  read("./styles-base.css"),
  read("./controls.css"),
  read("./responsive.css"),
  read("./dropdowns.css"),
  read("./scrollbars.css"),
  read("./bootstrap-core.js"),
  read("./control-interactions-runtime.js"),
  read("./filter-controls-runtime.js"),
]);


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

for (const selector of [
  ".navButton,",
  ".viewButton:not([hidden]),",
  ".mflStatsFilterButton,",
  ".mflStatsDistributionModeButton,",
]) {
  invariant(controls.includes(selector), `controls.css must keep ${selector} in the shared page/view/Stats control group.`);
}
invariant(
  controls.includes('):not(.active) {\n  cursor: pointer;\n}'),
  "Canonical shared controls must define the non-active cursor in controls.css.",
);
const activeControlStart = controls.indexOf(").active {");
const activeControlEnd = activeControlStart >= 0 ? controls.indexOf("\n}", activeControlStart) : -1;
const activeControlRule = activeControlStart >= 0 && activeControlEnd > activeControlStart
  ? controls.slice(activeControlStart, activeControlEnd + 2)
  : "";
invariant(
  activeControlRule.includes("cursor: default;"),
  "Canonical shared controls must define the active cursor in controls.css.",
);
invariant(
  controls.includes('):not(.active):hover:not(:disabled) {'),
  "Only non-active page, view, and Stats filter buttons may receive the shared hover highlight.",
);
invariant(
  controls.includes(').active:hover {'),
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
invariant(
  /@media \(max-width: 520px\)[\s\S]*?\.mflStatsFilterButton\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*height:\s*24px;/s.test(responsive),
  "responsive.css may scale Stats Overall-filter buttons only through the dedicated phone breakpoint loaded before first paint.",
);

for (const [fileName, source] of [
  ["dropdowns.css", dropdowns],
  ["scrollbars.css", scrollbars],
]) {
  invariant(
    !competingStatsFilterSizeRule.test(source),
    `${fileName} must not assign a second size to Stats Overall-filter buttons.`,
  );
}

for (const activeSelector of [
  '"#sidebar .navButton.active[data-page]"',
  '".viewButton.active[data-view]"',
  '".mflStatsFilterButton.active"',
  '".mflStatsDistributionModeButton.active"',
]) {
  invariant(
    bootstrapCore.includes(activeSelector),
    `The shared navigation controller must classify active control ${activeSelector}.`,
  );
}
invariant(
  controlInteractions.includes("const control = navigationController()?.activeControl?.(target);")
    && controlInteractions.includes("if (consumeActivePageViewFilterEvent(event)) return;")
    && controlInteractions.includes("event.stopImmediatePropagation();"),
  "The universal interaction runtime must consume active page, view, and filter controls through the shared navigation controller.",
);
for (const duplicateSelector of [
  '"#sidebar .navButton.active[data-page]"',
  '".viewButton.active[data-view]"',
  '".mflStatsFilterButton.active"',
  '".mflStatsDistributionModeButton.active"',
]) {
  invariant(
    !controlInteractions.includes(duplicateSelector),
    `Control interactions must not duplicate centralized active selector ${duplicateSelector}.`,
  );
}
invariant(
  !filterControls.includes("consumeActiveStatsControlEvent")
    && !filterControls.includes("installActiveStatsViewNoop"),
  "Stats-specific active-control blocking must not compete with the universal interaction owner.",
);

console.log("MFL Stats data, stable filter geometry, and global page/view/filter interaction behavior are canonical.");
