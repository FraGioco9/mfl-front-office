import assert from "node:assert/strict";
import { readBrowserSource, replaceBrowserScenarios, withBrowserFixture, runBrowserFixture } from "./browser-fixture.mjs";

const mode = process.argv[2];
assert.ok(process.argv.length === 3 && ["first-paint", "listing-width", "header-1374"].includes(mode),
  "Specify one browser diagnostic: first-paint, listing-width or header-1374.");
const specs = {
  "first-paint": {
    temporary: ".browser-mobile-first-paint-regression.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["database-1366", "/database/attributes", 1366, 900], ["database-1367", "/database/attributes", 1367, 900]]);\n\nconst server =',
    failure: "1366/1367 table-header first-paint boundary regression failed.",
    success: "1366/1367 table-header first-paint boundary regression passed.",
  },
  "listing-width": {
    temporary: ".browser-listing-width-regression.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1367, 900]]);\n\nconst server =',
    failure: "Listing width compaction browser regression failed.",
    success: "Listing width compaction browser regression passed above the 1366px compact cutoff.",
  },
  "header-1374": {
    temporary: ".browser-table-header-1374-regression.tmp.mjs",
    scenarios: 'const regressionScenarios = Object.freeze([["database-1374", "/database/attributes", 1374, 900]]);\n\nconst server =',
    failure: "1374px first-column header browser regression failed.",
    success: "1374px first-column header browser regression passed.",
  },
};
const spec = specs[mode];
const source = await readBrowserSource();
let diagnosticSource = source;

if (mode === "first-paint") {
const snapshotMarker = '      title: document.title,\n';
assert.ok(source.includes(snapshotMarker), "Parser first-paint snapshot hook must remain discoverable.");
const snapshotProbe = String.raw`      tableHeaderLabels: Array.from(document.querySelectorAll("#tableHead [data-mfl-full-table-label][data-mfl-compact-table-label]"))
        .map((label) => String(label.textContent || "").trim()),
      title: document.title,
`;
diagnosticSource = source.replace(snapshotMarker, snapshotProbe);

const paintSamplerMarker = '  if (linkedTablePaintSampling) requestAnimationFrame(sampleLinkedTablePaint);\n';
assert.ok(diagnosticSource.includes(paintSamplerMarker), "Frame paint-sampling hook must remain discoverable.");
const paintSamplerProbe = paintSamplerMarker + String.raw`
  const tableHeaderPaintHistory = [];
  let tableHeaderPaintSampling = scenario === "database";
  const sampleTableHeaderPaint = () => {
    if (!tableHeaderPaintSampling) return;
    const labels = Array.from(document.querySelectorAll("#tableHead [data-mfl-full-table-label][data-mfl-compact-table-label]"))
      .map((label) => String(label.textContent || "").trim());
    const mode = labels.includes("Positions") || labels.includes("Seasons")
      ? "full"
      : labels.includes("POS") && labels.includes("SZN")
        ? "compact"
        : "";
    if (mode && tableHeaderPaintHistory.at(-1) !== mode) tableHeaderPaintHistory.push(mode);
    requestAnimationFrame(sampleTableHeaderPaint);
  };
  if (tableHeaderPaintSampling) requestAnimationFrame(sampleTableHeaderPaint);
`;
diagnosticSource = diagnosticSource.replace(paintSamplerMarker, paintSamplerProbe);

const databaseFirstPaintMarker = '      assert(parserSnapshot.initialTableView === "attributes", "Database first paint has the wrong view.");\n';
assert.ok(diagnosticSource.includes(databaseFirstPaintMarker), "Database first-paint assertion hook must remain discoverable.");
const databaseFirstPaintProbe = databaseFirstPaintMarker + String.raw`      {
        const compactHeader = document.documentElement.clientWidth <= 1366;
        const labels = parserSnapshot.tableHeaderLabels;
        assert(
          compactHeader
            ? labels.includes("POS") && labels.includes("SZN")
            : labels.includes("Positions") && labels.includes("Seasons"),
          (compactHeader ? "1366px compact" : "1367px full") + " parser first paint has the wrong table-header set: " + JSON.stringify(labels),
        );
        assert(
          compactHeader
            ? !labels.includes("Positions") && !labels.includes("Seasons")
            : !labels.includes("POS") && !labels.includes("SZN"),
          (compactHeader ? "1366px compact" : "1367px full") + " parser first paint exposed the opposite header set: " + JSON.stringify(labels),
        );
      }
`;
diagnosticSource = diagnosticSource.replace(databaseFirstPaintMarker, databaseFirstPaintProbe);

const routeReadyMarker = '    await waitFor(() => document.documentElement.dataset.mflRouteReady === "true", scenario + " direct refresh never settled.");\n';
assert.ok(diagnosticSource.includes(routeReadyMarker), "Direct-refresh readiness hook must remain discoverable.");
const routeReadyProbe = routeReadyMarker + String.raw`    if (scenario === "database") {
      tableHeaderPaintSampling = false;
      const expectedHeaderMode = document.documentElement.clientWidth <= 1366 ? "compact" : "full";
      assert(
        tableHeaderPaintHistory[0] === expectedHeaderMode,
        expectedHeaderMode + " header paint history started in the wrong mode: " + JSON.stringify(tableHeaderPaintHistory),
      );
      assert(
        tableHeaderPaintHistory.every((mode) => mode === expectedHeaderMode),
        expectedHeaderMode + " headers bounced across the fixed 1366/1367 boundary during hydration: " + JSON.stringify(tableHeaderPaintHistory),
      );
    }
`;
diagnosticSource = diagnosticSource.replace(routeReadyMarker, routeReadyProbe);
} else if (mode === "listing-width") {
const routeReadyMarker = '    await waitFor(() => document.documentElement.dataset.mflRouteReady === "true", scenario + " direct refresh never settled.");\n';
assert.ok(diagnosticSource.includes(routeReadyMarker), "Direct-refresh readiness hook must remain discoverable.");
const routeReadyProbe = routeReadyMarker + String.raw`    if (scenario === "database") {
      window.__mflListingWidthRuntime?.destroy?.();
      document.getElementById("mflListingWidthStyle")?.remove();

      const scroller = document.querySelector("#progressionPage .playerTableScroller");
      assert(scroller instanceof HTMLElement, "Database player-table scroller is missing.");
      scroller.classList.remove("mflListingPricesCompact");

      const tableBody = document.getElementById("tableBody");
      assert(tableBody instanceof HTMLTableSectionElement, "Database table body is missing.");
      const firstRow = tableBody.querySelector("tr");
      assert(firstRow instanceof HTMLTableRowElement, "Database fixture row is missing.");
      const firstListingCell = firstRow.querySelector("td.col-listing");
      assert(firstListingCell instanceof HTMLTableCellElement, "Database Listing cell is missing.");

      const setListingPrice = (cell, priceText) => {
        cell.removeAttribute("aria-label");
        cell.replaceChildren();
        const controlHost = document.createElement("span");
        controlHost.className = "tableControlCellContent";
        const listingHost = document.createElement("span");
        listingHost.className = "listingCellTableHost";
        const badge = document.createElement("span");
        badge.className = "listingCellContent";
        badge.setAttribute("aria-label", "For Sale at " + priceText);
        const icon = document.createElement("img");
        icon.className = "listingCellIcon";
        icon.alt = "";
        const price = document.createElement("span");
        price.className = "listingCellPrice";
        price.textContent = priceText;
        badge.append(icon, price);
        listingHost.appendChild(badge);
        controlHost.appendChild(listingHost);
        cell.appendChild(controlHost);
        return { badge, price };
      };

      const firstListing = setListingPrice(firstListingCell, "$10,000");
      const secondRow = firstRow.cloneNode(true);
      assert(secondRow instanceof HTMLTableRowElement, "Second Listing fixture row could not be cloned.");
      secondRow.dataset.playerId = "2";
      const secondListingCell = secondRow.querySelector("td.col-listing");
      assert(secondListingCell instanceof HTMLTableCellElement, "Second Database Listing cell is missing.");
      const secondListing = setListingPrice(secondListingCell, "$999");
      tableBody.appendChild(secondRow);

      const prices = [firstListing.price, secondListing.price];
      const badges = [firstListing.badge, secondListing.badge];
      const cellStyle = getComputedStyle(firstListingCell);
      const availableWidth = firstListingCell.clientWidth
        - (Number.parseFloat(cellStyle.paddingLeft) || 0)
        - (Number.parseFloat(cellStyle.paddingRight) || 0);
      const badgeStyle = getComputedStyle(firstListing.badge);
      const iconWidth = firstListing.badge.querySelector(".listingCellIcon")?.getBoundingClientRect().width || 0;
      const requiredWidth = (Number.parseFloat(badgeStyle.paddingLeft) || 0)
        + iconWidth
        + (Number.parseFloat(badgeStyle.columnGap || badgeStyle.gap) || 0)
        + firstListing.price.scrollWidth
        + (Number.parseFloat(badgeStyle.paddingRight) || 0);
      assert(
        requiredWidth > availableWidth + 1,
        "Five-digit Listing fixture must reproduce real cell-boundary clipping before compaction: "
          + JSON.stringify({ requiredWidth, availableWidth }),
      );

      window.dispatchEvent(new Event("resize"));
      await delay(80);
      assert(
        prices.every((price) => getComputedStyle(price).display === "none"),
        "Existing table-runtime ownership must compact every Listing price even when the standalone Listing runtime is unavailable.",
      );
      assert(
        badges[0].dataset.tooltip === "$10,000" && badges[1].dataset.tooltip === "$999",
        "Compacted Listing badges must preserve each full price as tooltip text.",
      );

      const progressionPage = document.getElementById("progressionPage");
      assert(progressionPage instanceof HTMLElement, "Progression page is missing.");
      progressionPage.style.setProperty("--mfl-table-col-listing", "20%");
      window.dispatchEvent(new Event("resize"));
      await delay(80);
      assert(
        prices.every((price) => getComputedStyle(price).display !== "none"),
        "Listing prices must restore together when the Listing column has enough room.",
      );
      assert(
        badges.every((badge) => !badge.dataset.tooltip),
        "Runtime-owned Listing tooltips must clear when full prices are restored.",
      );
      progressionPage.style.removeProperty("--mfl-table-col-listing");
    }
`;
diagnosticSource = diagnosticSource.replace(routeReadyMarker, routeReadyProbe);
} else if (mode === "header-1374") {
const geometryMarker = "  function assertSharedChromeGeometry() {\n    const viewportWidth = document.documentElement.clientWidth;\n";
assert.ok(source.includes(geometryMarker), "Shared chrome geometry hook must remain discoverable.");

const geometryProbe = geometryMarker + String.raw`    if (viewportWidth === 1374) {
      const headerDiagnostics = Array.from(document.querySelectorAll("#progressionPage #tableHead th"))
        .slice(0, 8)
        .map((header, index) => {
          const label = header.querySelector("[data-mfl-full-table-label][data-mfl-compact-table-label]");
          const sortButton = header.querySelector(".tableSortButton");
          const headerStyle = getComputedStyle(header);
          const labelStyle = label instanceof HTMLElement ? getComputedStyle(label) : null;
          const sortStyle = sortButton instanceof HTMLElement ? getComputedStyle(sortButton) : null;
          return {
            index,
            className: String(header.className || ""),
            column: String(header.dataset.tableColumn || ""),
            text: String(label?.textContent || header.textContent || "").trim(),
            full: String(label?.dataset?.mflFullTableLabel || ""),
            compact: String(label?.dataset?.mflCompactTableLabel || ""),
            headerClientWidth: header.clientWidth,
            headerScrollWidth: header.scrollWidth,
            headerTextOverflow: headerStyle.textOverflow,
            labelClientWidth: label instanceof HTMLElement ? label.clientWidth : 0,
            labelScrollWidth: label instanceof HTMLElement ? label.scrollWidth : 0,
            labelTextOverflow: labelStyle?.textOverflow || "",
            sortClientWidth: sortButton instanceof HTMLElement ? sortButton.clientWidth : 0,
            sortScrollWidth: sortButton instanceof HTMLElement ? sortButton.scrollWidth : 0,
            sortTextOverflow: sortStyle?.textOverflow || "",
          };
        });
      const ellipsizingHeaders = headerDiagnostics.filter((entry) => (
        (entry.headerTextOverflow === "ellipsis" && entry.headerScrollWidth - entry.headerClientWidth > 1)
        || (entry.labelTextOverflow === "ellipsis" && entry.labelScrollWidth - entry.labelClientWidth > 1)
        || (entry.sortTextOverflow === "ellipsis" && entry.sortScrollWidth - entry.sortClientWidth > 1)
      ));
      assert(
        ellipsizingHeaders.length === 0,
        "1374px first-column header ellipsis: " + JSON.stringify({ ellipsizingHeaders, headerDiagnostics }),
      );
    }
`;

diagnosticSource = source.replace(geometryMarker, geometryProbe);
}

diagnosticSource = replaceBrowserScenarios(diagnosticSource, spec.scenarios,
  "Browser regression scenario list must remain discoverable.");

await withBrowserFixture(diagnosticSource, spec.temporary,
  temporaryPath => runBrowserFixture(temporaryPath, spec.failure));

console.log(spec.success);
