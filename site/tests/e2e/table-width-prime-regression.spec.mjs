import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => {
    const readiness = globalThis.document.documentElement.dataset.mflReady;
    return readiness === "true" || readiness === "error";
  });
  const readiness = await page.locator("html").getAttribute("data-mfl-ready");
  if (readiness !== "true") {
    const startupError = await page.locator("#mflStartupError").textContent().catch(() => "");
    throw new Error(`MFL startup ended in ${readiness}: ${startupError || "no startup message"}`);
  }
}

async function columnWidths(page) {
  return page.locator("#tableColGroup > col:not(.col-shared-width-filler)").evaluateAll((columns) => (
    columns.map((column) => Number.parseFloat(globalThis.getComputedStyle(column).width))
  ));
}

test("refresh shows settled player-table column widths before legacy data loads", async ({ page }) => {
  let releaseLegacy;
  const legacyGate = new Promise((resolve) => { releaseLegacy = resolve; });

  await page.route("**/modules/legacy-core.js?*", async (route) => {
    await legacyGate;
    await route.continue();
  });

  const navigation = page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (
    globalThis.document.querySelector("#tableHead")?.dataset.staticHeader === "true"
    && globalThis.document.querySelector("#progressionPage .tableScroller")?.classList.contains("tableWidthsReady")
  ));

  const before = await columnWidths(page);
  expect(before.length).toBeGreaterThan(10);
  expect(before.every((width) => Number.isFinite(width) && width > 0)).toBe(true);

  releaseLegacy();
  await navigation;
  await waitForArchitecture(page);

  const after = await columnWidths(page);
  expect(after).toHaveLength(before.length);
  after.forEach((width, index) => {
    expect(Math.abs(width - before[index])).toBeLessThan(0.75);
  });
});
