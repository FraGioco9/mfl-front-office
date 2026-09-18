import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-listing-width-regression.tmp.mjs");
const source = await readFile(sourcePath, "utf8");
let diagnosticSource = source;

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

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1367, 900]]);\n\nconst server =',
);

await writeFile(temporaryPath, diagnosticSource, "utf8");
try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "Listing width compaction browser regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Listing width compaction browser regression passed above the 1366px compact cutoff.");
