import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [styles, responsive, bootstrap, tableSource, sharedTableUi] = await Promise.all([
  read("./styles.css"),
  read("./responsive.css"),
  read("./bootstrap.js"),
  Promise.resolve(readCanonicalCoreSource("table")),
  read("./shared-table-ui-runtime.js"),
]);

const mobileStartToken = '@media (max-width: 900px) {\n  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-view="next"]';
const mobileStart = styles.indexOf(mobileStartToken);
const mobileEnd = styles.indexOf("\n}\n\n#progressionPage .playerTableScroller col.col-select", mobileStart);
invariant(mobileStart >= 0 && mobileEnd > mobileStart, "The canonical <=900px player-table style block is missing.");

const mobileTableStyles = styles.slice(mobileStart, mobileEnd + 2);
const stickyStart = mobileTableStyles.indexOf("#progressionPage .playerTableScroller :is(\n    th.col-name,");
const stickyEnd = mobileTableStyles.lastIndexOf("\n}");
invariant(stickyStart >= 0 && stickyEnd > stickyStart, "The small-screen sticky Name subsection is missing.");
const stickyStyles = mobileTableStyles.slice(stickyStart, stickyEnd);
const desktopTableStyles = `${styles.slice(0, mobileStart)}${styles.slice(mobileEnd + 2)}`;

for (const token of [
  "th.col-name,",
  "td.col-name,",
  "td:has(> .playerNameCell)",
  "position: sticky;",
  "left: 0;",
  "padding-left: 10px;",
  "background-clip: padding-box;",
  "#progressionPage #tableBody .playerNameCell {\n    position: static;\n  }",
  "@container mfl-sticky-name scroll-state(stuck: left) {",
  "#progressionPage #tableBody .playerNameCell::before {",
  'content: "";',
  "position: absolute;",
  "z-index: 2;",
  "top: -1px;",
  "right: 0;",
  "bottom: -1px;",
  "border-right: 1px solid var(--border-strong);",
  "pointer-events: none;",
  "#progressionPage .playerTableScroller th.col-name {\n    z-index: 6;\n    background: var(--mfl-table-header-background);",
  "z-index: 5;\n    isolation: isolate;\n    container-type: scroll-state;\n    container-name: mfl-sticky-name;\n    background: var(--mfl-table-surface);\n    background-image: linear-gradient(var(--mfl-table-surface), var(--mfl-table-surface));\n    background-clip: border-box;",
  "#progressionPage #tableBody tr.tableRowHovered > :is(",
  "background: var(--mfl-table-row-hover-background);\n    background-image: linear-gradient(var(--mfl-table-row-hover-background), var(--mfl-table-row-hover-background));",
  "#progressionPage #tableBody > .mflTableLoadingRow > td:has(> .playerNameCell) {",
  "background: var(--mfl-table-surface);\n    background-image: linear-gradient(var(--mfl-table-surface), var(--mfl-table-surface));",
]) {
  invariant(stickyStyles.includes(token), `Small-screen sticky Name contract is missing: ${token}`);
}

const unconditionalStickyRuleEnd = stickyStyles.indexOf("\n  }", stickyStyles.indexOf("position: sticky;"));
const unconditionalStickyRule = stickyStyles.slice(0, unconditionalStickyRuleEnd + 4);
invariant(
  !unconditionalStickyRule.includes("border-right:") && !unconditionalStickyRule.includes("--border-strong"),
  "Sticky Name separator must stay hidden until the Name column is actually stuck to the left edge.",
);
invariant(
  !stickyStyles.includes("mflPlayerTableCanScrollLeft"),
  "Sticky separator visibility must use the Name column's actual stuck state rather than generic horizontal-scroll state.",
);
invariant(
  !stickyStyles.includes("th.col-name > span:first-child::before")
    && !stickyStyles.includes("#tableHead .playerNameCell::before"),
  "Sticky Name separator must never render in the table header; only table-body Name cells own it.",
);
invariant(
  !stickyStyles.includes("width: 1px;") && !stickyStyles.includes("background: var(--border-strong);"),
  "Sticky separator must not create a width declaration that can compete with Uniform Width ownership.",
);
invariant(
  stickyStyles.includes("top: -1px;") && stickyStyles.includes("bottom: -1px;"),
  "Sticky Name separator must extend across the one-pixel horizontal row dividers so the vertical rule paints above them.",
);
invariant(
  stickyStyles.includes("z-index: 5;")
    && stickyStyles.includes("isolation: isolate;")
    && stickyStyles.includes("background-clip: border-box;"),
  "Sticky Name body cells must form an opaque paint layer above the mobile edge fade.",
);

invariant(!stickyStyles.includes("!important"), "Sticky Name styling must not use !important.");
invariant(!stickyStyles.includes("transform:"), "Sticky Name positioning must not use transform nudges.");
invariant(!/\bwidth\s*:/.test(unconditionalStickyRule), "Sticky Name positioning must not create a competing mobile width.");
invariant(!/col-name[\s\S]{0,180}position:\s*sticky/.test(desktopTableStyles), "Name must not become sticky in the desktop table contract.");

invariant(
  styles.includes("#progressionPage .playerTableScroller col.col-name { width: var(--mfl-table-col-name); }"),
  "Sticky Name must continue consuming the canonical Uniform Width colgroup value.",
);
invariant(
  !responsive.includes("--mfl-table-col-name"),
  "Responsive layout must not introduce a second Name width owner.",
);

invariant(
  tableSource.includes('const cell = document.createElement("th");\n    const columnClass = tableColumnClass(column);')
    && tableSource.includes('const cell = document.createElement("td");\n      const columnClass = tableColumnClass(column);'),
  "Hydrated table headers and body cells must retain their semantic column classes for sticky Name ownership.",
);
invariant(
  bootstrap.includes('const className = firstPaintTableColumnClass(column);\n      if (className) header.classList.add(...className.split(" "));')
    && bootstrap.includes('cell.classList.add("nameCell");')
    && bootstrap.includes('nameWrap.className = "playerNameCell";')
    && bootstrap.includes('nameWrap.appendChild(createTextSkeleton("Name Surname", "playerNameLink"));'),
  "First-paint headers and loading Name cells must expose the same semantic selectors and text layout as populated rows before hydration.",
);

invariant(
  sharedTableUi.includes("#progressionPage .tableShell::before,\n  #progressionPage .tableShell::after {")
    && sharedTableUi.includes("bottom: 0;\n    z-index: 2;\n    width: 54px;"),
  "Existing mobile table edge fades must keep their local z-index contract below sticky Name cells.",
);
invariant(
  !sharedTableUi.includes("col-name") && !sharedTableUi.includes("playerNameCell"),
  "Sticky Name positioning and separator state must remain CSS-owned rather than being recreated by the shared table runtime.",
);

console.log("Small-screen player tables keep Name sticky with inset, keep sticky body cells opaque above the edge fade, and paint the body-only vertical separator across horizontal row dividers only while Name is actually stuck.");
