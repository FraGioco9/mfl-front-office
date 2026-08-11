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

function statsPayload(overrides = {}) {
  return {
    totalPlayers: 15,
    totalActivePlayers: 10,
    totalRetiredPlayers: 77,
    rows: [
      [80, 25, 0, 5],
      [80, 25, 1, 7],
      [90, 26, 2, 3],
    ],
    ...overrides,
  };
}

async function mockStats(page, overrides = {}) {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "database-stats") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(statsPayload(overrides)),
    });
  });
}

test("footer starts in the pinned content column with the current release", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.locator(".siteFooter");
  await expect(footer).toBeVisible();
  await expect(footer).toContainText("MFL Front Office v1.123.33");
  await expect(page.locator("body")).toHaveClass(/pinnedSidebarVisible/);
  const layout = await page.evaluate(() => {
    const footer = globalThis.document.querySelector(".siteFooter");
    const main = globalThis.document.querySelector("main");
    const footerRect = footer.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return { footerLeft: footerRect.left, mainLeft: mainRect.left, footerWidth: footerRect.width, mainWidth: mainRect.width };
  });
  expect(layout.footerLeft).toBeGreaterThan(0);
  expect(Math.abs(layout.footerLeft - layout.mainLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.footerWidth - layout.mainWidth)).toBeLessThanOrEqual(1);

  releaseMetadata();
  await waitForArchitecture(page);
});

test("refreshing Database Stats remains on /database/stats", async ({ page }) => {
  await mockStats(page);
  await page.goto("/database/stats");
  await waitForArchitecture(page);
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
});

test("Retired card uses the exact all-player retirement_years zero total", async ({ page }) => {
  await mockStats(page, { totalRetiredPlayers: 77 });
  await page.goto("/database/stats");
  await waitForArchitecture(page);
  await expect(page.locator("#databaseStatsRetired")).toHaveText("77");
});

test("editing Custom Overall values never hides Database Stats content", async ({ page }) => {
  await mockStats(page);
  await page.goto("/database/stats");
  await waitForArchitecture(page);

  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  await expect(portal).toBeVisible();

  await portal.locator('[data-role="min"]').fill("75");
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();

  await portal.locator('[data-role="max"]').fill("90");
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
});

test("wallet table-state restore keeps Database Stats and reuses saveTableState", async ({ page }) => {
  await mockStats(page);
  await page.goto("/database/stats");
  await waitForArchitecture(page);

  const result = await page.evaluate(() => globalThis.eval(`(() => {
    const originalSave = saveTableState;
    window.__mflStatsSaveCalls = 0;
    saveTableState = function saveTableStateSpy() {
      window.__mflStatsSaveCalls += 1;
      return originalSave.apply(this, arguments);
    };
    state.tablePageStates.database = { ...(state.tablePageStates.database || {}), view: "attributes" };
    applyWalletTableState({ pages: { database: { view: "stats" } } });
    return {
      view: state.tablePageStates.database?.view,
      currentPage: state.currentPage,
      currentView: state.view,
      saves: window.__mflStatsSaveCalls,
    };
  })()`));

  expect(result.view).toBe("stats");
  expect(result.currentPage).toBe("database");
  expect(result.currentView).toBe("stats");
  expect(result.saves).toBeGreaterThan(0);

  await page.evaluate(async () => {
    await globalThis.eval('setPage("home", true)');
    await globalThis.eval('setPage("database", true)');
  });
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
});

test("Home never shows Changelog content after Changelog was the initial route", async ({ page }) => {
  await page.goto("/changelog");
  await waitForArchitecture(page);
  await expect(page.locator("#changelogPage")).toBeVisible();

  await page.evaluate(async () => {
    await globalThis.eval('setPage("home", true)');
  });

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#homePage")).toBeVisible();
  await expect(page.locator("#homePage .homeIntro")).toContainText("Manage scouting");
  await expect(page.locator("#changelogPage")).toBeHidden();
});

test("first Database visit has Hide MFL players selected", async ({ page }) => {
  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hideMflPlayersInput")).toBeChecked();
});

test("protected opted-out routes show the locked page before release loading", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/watchlist", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#myPlayersLockedPage")).toBeVisible();
  await expect(page.locator("#homePage")).toBeHidden();
  await expect(page.locator("#progressionPage")).toBeHidden();
  await expect(page.locator("#myPlayersOptInButton")).toBeVisible();

  releaseMetadata();
  await waitForArchitecture(page);
});

test("Custom Overall counts missing retirement years as active", async ({ page }) => {
  await mockStats(page, {
    totalActivePlayers: 14,
    totalRetiredPlayers: 5,
    rows: [
      [80, 24, null, 4],
      [80, 25, 0, 5],
      [80, 25, 1, 7],
      [90, 26, 2, 3],
    ],
  });
  await page.goto("/database/stats");
  await waitForArchitecture(page);

  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  await portal.locator('[data-role="min"]').fill("80");
  await portal.locator('[data-role="max"]').fill("80");
  await portal.locator('[data-role="apply"]').click();

  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("11");
  await expect(page.locator("#databaseStatsRetired")).toHaveText("5");
});
