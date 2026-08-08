import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => {
    const readiness = globalThis.document.documentElement.dataset.mflReady;
    return readiness === "true" || readiness === "error";
  });
  expect(await page.locator("html").getAttribute("data-mfl-ready")).toBe("true");
}

function statsPayload() {
  return {
    totalPlayers: 24,
    totalActivePlayers: 18,
    totalRetiredPlayers: 6,
    rows: [
      [70, 21, 0, 2],
      [74, 22, 1, 4],
      [80, 24, 2, 6],
      [88, 27, 3, 8],
      [92, 30, 0, 4],
    ],
  };
}

async function routeStatsData(page, bootstrapGate = null) {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get("mode");

    if (mode === "database-stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(statsPayload()),
      });
      return;
    }

    if (mode === "bootstrap" && bootstrapGate) {
      await bootstrapGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          manifest: null,
          summary: { playerCount: 24, walletCount: 8, generatedAt: "2026-08-08T10:00:00.000Z" },
        }),
      });
      return;
    }

    await route.continue();
  });
}

test("slow legacy startup cannot replace Database Stats or hide content while Custom values change", async ({ page }) => {
  let releaseBootstrap;
  const bootstrapGate = new Promise((resolve) => { releaseBootstrap = resolve; });
  await routeStatsData(page, bootstrapGate);

  await page.goto("/database/stats", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();

  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  await expect(portal).toBeVisible();
  await portal.locator('[data-role="min"]').fill("73");
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page).toHaveURL(/\/database\/stats$/);
  await portal.locator('[data-role="max"]').fill("88");
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#databaseStatsDistribution")).toBeVisible();

  releaseBootstrap();
  await waitForArchitecture(page);
  await page.waitForTimeout(300);

  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  const stateSnapshot = await page.evaluate(() => globalThis.eval(`({
    currentPage: state.currentPage,
    view: state.view,
    savedView: state.tablePageStates?.database?.view
  })`));
  expect(stateSnapshot).toEqual({ currentPage: "database", view: "stats", savedView: "stats" });
});

test("Supabase table-state restoration keeps Stats as the remembered Database view", async ({ page }) => {
  await routeStatsData(page);
  await page.goto("/");
  await waitForArchitecture(page);

  await page.evaluate(() => {
    globalThis.eval(`applyWalletTableState({
      pages: {
        database: {
          view: "stats",
          page: 1,
          pageSize: 100,
          sortKey: "overall",
          sortDirection: "desc",
          rules: []
        }
      }
    });`);
  });

  const databaseLink = page.locator('#sidebar .navButton[data-page="database"]');
  await expect(databaseLink).toHaveAttribute("href", "/database/stats");
  await databaseLink.click();

  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  expect(await page.evaluate(() => globalThis.eval("state.tablePageStates.database.view"))).toBe("stats");
});
