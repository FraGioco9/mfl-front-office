import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("pager hides on view pointer intent and returns only after table loading settles", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);

  const pager = page.locator("#progressionPage nav.pager");
  const body = page.locator("#tableBody");
  const contracts = page.locator('#progressionPage .viewButton[data-view="contracts"]');

  await expect(pager).toBeVisible();
  await expect(contracts).toBeVisible();

  await contracts.dispatchEvent("pointerdown", {
    button: 0,
    isPrimary: true,
    pointerId: 41,
  });

  await expect(pager).toBeHidden();
  await expect(body.locator(":scope > .staticTableLoadingRow")).toBeVisible();

  await body.evaluate((node) => {
    const row = globalThis.document.createElement("tr");
    const cell = globalThis.document.createElement("td");
    cell.textContent = "Loaded";
    row.appendChild(cell);
    node.replaceChildren(row);
    const empty = globalThis.document.getElementById("emptyState");
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }
  });

  await expect(pager).toBeVisible();
  await expect(body.locator(":scope > .staticTableLoadingRow")).toHaveCount(0);
});
