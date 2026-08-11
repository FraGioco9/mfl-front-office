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

test("a human-length pointer press commits and retains the destination view", async ({ page }) => {
  let releaseContracts;
  const contractsGate = new Promise((resolve) => { releaseContracts = resolve; });
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "page" || url.searchParams.get("view") !== "contracts") {
      await route.continue();
      return;
    }
    await contractsGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        columns: [],
        rows: [],
        page: 1,
        pageSize: 100,
        totalRows: 0,
        sourceRows: 0,
      }),
    });
  });

  await page.goto("/database/attributes");
  await waitForArchitecture(page);
  const contracts = page.locator('#progressionPage .viewButton[data-view="contracts"]');
  const box = await contracts.boundingBox();
  expect(box).not.toBeNull();

  try {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();

    await expect(page).toHaveURL(/\/database\/contracts$/);
    await expect(page.locator("#tableHead")).toContainText("Rev. Share");
    await expect(page.locator("#tableBody .staticTableLoadingCell")).toHaveText("Loading players...");
  } finally {
    releaseContracts?.();
  }

  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(contracts).toHaveClass(/active/);
  await page.waitForTimeout(100);
  await expect(page).toHaveURL(/\/database\/contracts$/);
});

test("keyboard activation still switches the shared table view", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);
  const contracts = page.locator('#progressionPage .viewButton[data-view="contracts"]');
  await contracts.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/database\/contracts$/);
  await expect(contracts).toHaveClass(/active/);
});
