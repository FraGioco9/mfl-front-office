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
      const tableBody = document.getElementById("tableBody");
      assert(tableBody instanceof HTMLTableSectionElement, "Database table body is missing.");

      const makeListingRow = (playerId, priceText) => {
        const row = document.createElement("tr");
        row.dataset.playerId = String(playerId);
        const cell = document.createElement("td");
        cell.className = "col-listing";
        const host = document.createElement("span");
        host.className = "listingCellTableHost";
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
        host.appendChild(badge);
        cell.appendChild(host);
        row.appendChild(cell);
        return row;
      };

      tableBody.replaceChildren(
        makeListingRow(1, "$10,000"),
        makeListingRow(2, "$999"),
      );
      const prices = Array.from(tableBody.querySelectorAll("td.col-listing .listingCellPrice"));
      assert(prices.length === 2, "Listing compaction regression must render two Listing prices.");
      const firstPrice = prices[0];
      assert(firstPrice instanceof HTMLElement, "Five-digit Listing fixture is missing.");
      firstPrice.style.flex = "0 0 20px";
      firstPrice.style.width = "20px";
      firstPrice.style.maxWidth = "20px";
      const wouldOverflow = firstPrice.scrollWidth - firstPrice.clientWidth > 1;
      assert(wouldOverflow, "Five-digit Listing fixture must reproduce a clipped price before compaction.");

      window.dispatchEvent(new Event("resize"));
      await delay(80);
      assert(
        prices.every((price) => price instanceof HTMLElement && getComputedStyle(price).display === "none"),
        "If one five-digit Listing would clip, every Listing price must compact together.",
      );

      firstPrice.style.removeProperty("flex");
      firstPrice.style.removeProperty("width");
      firstPrice.style.removeProperty("max-width");
      window.dispatchEvent(new Event("resize"));
      await delay(80);
      assert(
        prices.every((price) => price instanceof HTMLElement && getComputedStyle(price).display !== "none"),
        "Listing prices must restore together when the five-digit price fits again.",
      );
    }
`;
diagnosticSource = diagnosticSource.replace(routeReadyMarker, routeReadyProbe);

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1000, 900]]);\n\nconst server =',
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

console.log("Listing width compaction browser regression passed.");
