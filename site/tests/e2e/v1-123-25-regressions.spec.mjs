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

function installOptIn(page, watchlists = null) {
  return page.addInitScript((savedWatchlists) => {
    const wallet = "0x1234";
    globalThis.localStorage.setItem("mfl-linked-wallet-v1", wallet);
    globalThis.localStorage.setItem("mfl-linked-wallet-proof-v1", JSON.stringify({
      address: wallet,
      message: "MFL Front Office Dapper Opt-In",
      signatures: ["signature"],
    }));
    if (savedWatchlists) {
      globalThis.localStorage.setItem(`mfl-wallet-watchlist-v1:${wallet}`, JSON.stringify(savedWatchlists));
    }
  }, watchlists);
}

test("Watchlist switcher shows the cached current Watchlist before release loading", async ({ page }) => {
  await installOptIn(page, [{ id: "scouts", name: "Scouts", playerIds: [] }]);

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/watchlist/scouts/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#watchlistSwitcher")).toBeVisible();
  await expect(page.locator("#watchlistButtonText")).toHaveText("Scouts");

  releaseMetadata();
  await waitForArchitecture(page);
  await expect(page.locator("#watchlistButtonText")).toHaveText("Scouts");
});

test("Watchlist switcher uses a dash before an uncached Watchlist is loaded", async ({ page }) => {
  await installOptIn(page);

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/watchlist/not-loaded/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#watchlistSwitcher")).toBeVisible();
  await expect(page.locator("#watchlistButtonText")).toHaveText("-");

  releaseMetadata();
  await waitForArchitecture(page);
});

test("legacy table loading reuses the one Loading players row", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);

  await page.evaluate(() => {
    globalThis.eval("showTableBusyState()");
  });

  await expect(page.getByText("Loading players...", { exact: true })).toHaveCount(1);
  await expect(page.locator("#tableBody .staticTableLoadingCell")).toHaveText("Loading players...");
  await expect(page.locator("#emptyState")).toBeHidden();
});

test("typed global search uses full player club and agent results instead of recent-only state", async ({ page }) => {
  let allSearchRequests = 0;
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "search" && url.searchParams.get("q") === "roma") {
      expect(url.searchParams.get("type")).toBe("all");
      allSearchRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          players: {
            columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
            rows: [[901, "Full Database Roma Player", 90, "Italy", "ST", null]],
          },
          agents: {
            columns: ["wallet_address", "wallet_name", "player_count"],
            rows: [["0xroma", "Roma Agent", 30]],
          },
          clubs: [{ clubId: "roma-club", name: "Roma Club", division: 1 }],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  await page.locator("#playerSearchInput").fill("roma");

  await expect(page.locator("#playerSearchResults")).toContainText("Full Database Roma Player");
  await expect(page.locator("#playerSearchResults")).toContainText("Roma Club");
  await expect(page.locator("#playerSearchResults")).toContainText("Roma Agent");
  expect(allSearchRequests).toBeGreaterThan(0);
});

test("Stats from MFL stays in MFL even after Database bound the shared button", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "mfl-stats-summary") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rows: [[80, 25, "packable", 1]] }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/database/attributes");
  await waitForArchitecture(page);
  await page.locator('#sidebar .navButton[data-page="mfl"]').click();
  await expect(page).toHaveURL(/\/mfl\/attributes$/);
  await expect(page.locator('#progressionPage .viewButton[data-view="stats"]')).toBeVisible();

  await page.locator('#progressionPage .viewButton[data-view="stats"]').click();
  await expect(page).toHaveURL(/\/mfl\/stats$/);
  await expect(page.locator("#mflStatsPage")).toBeVisible();
  await expect(page.locator("#databaseStatsPage")).toBeHidden();
});
