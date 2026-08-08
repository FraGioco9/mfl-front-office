import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => {
    const readiness = globalThis.document.documentElement.dataset.mflReady;
    return readiness === "true" || readiness === "error";
  });
  expect(await page.locator("html").getAttribute("data-mfl-ready")).toBe("true");
}

function databaseStatsPayload() {
  return {
    totalPlayers: 18,
    totalActivePlayers: 18,
    totalRetiredPlayers: 0,
    rows: [
      [70, 21, 1, 4],
      [80, 22, 2, 6],
      [90, 23, 3, 8],
    ],
  };
}

function mflStatsSummaryPayload() {
  return {
    totalPlayers: 18,
    columns: ["overall", "age", "category", "count"],
    rows: [
      [70, 21, "packable", 4],
      [80, 22, "packable", 6],
      [90, 23, "aged", 3],
      [90, 24, "other", 5],
    ],
  };
}

test("opted-in Home content is already in its final position without a permission cache", async ({ page }) => {
  await page.addInitScript(() => {
    const wallet = "0x1234";
    globalThis.localStorage.setItem("mfl-linked-wallet-v1", wallet);
    globalThis.localStorage.setItem("mfl-linked-wallet-proof-v1", JSON.stringify({
      type: "user-signature",
      address: wallet,
      signingAddress: wallet,
      message: "MFL Front Office Dapper Opt-In",
      signatures: ["signature"],
    }));
    globalThis.localStorage.removeItem(`mfl-wallet-permission-cache-v1:${wallet}`);
  });

  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#homePage")).toBeVisible();
  await expect(page.locator("#homeOptInButton")).toBeHidden();
  const initial = await page.locator("#homePage .homeStats").boundingBox();
  expect(initial).not.toBeNull();

  releaseMetadata();
  await waitForArchitecture(page);
  await expect(page.locator("#homeOptInButton")).toBeHidden();
  const ready = await page.locator("#homePage .homeStats").boundingBox();
  expect(ready).not.toBeNull();
  expect(Math.abs(ready.x - initial.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(ready.y - initial.y)).toBeLessThanOrEqual(1);
});

test("Database Custom portal pointer and value changes never hide Stats content", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "database-stats") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(databaseStatsPayload()),
    });
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  const min = portal.locator('[data-role="min"]');
  const max = portal.locator('[data-role="max"]');
  await expect(portal).toBeVisible();

  await min.dispatchEvent("pointerdown");
  await min.click();
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  await expect(page).toHaveURL(/\/database\/stats$/);

  await min.fill("75");
  await min.dispatchEvent("change");
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();

  await max.fill("90");
  await max.dispatchEvent("change");
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  await expect(page).toHaveURL(/\/database\/stats$/);
});

test("MFL Stats loads one compact summary and never requests full player rows", async ({ page }) => {
  let summaryData;
  const summaryGate = new Promise((resolve) => { summaryData = resolve; });
  let fullRowRequests = 0;
  let summaryRequests = 0;

  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get("mode");
    if (mode === "mfl-stats-all") {
      fullRowRequests += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "full rows forbidden" }) });
      return;
    }
    if (mode === "mfl-stats-summary") {
      summaryRequests += 1;
      await summaryGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mflStatsSummaryPayload()),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/mfl/stats", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mflStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  await waitForArchitecture(page);
  await expect(page.locator("html")).toHaveClass(/mflInteractionBusy/);
  expect(summaryRequests).toBe(1);
  expect(fullRowRequests).toBe(0);

  summaryData();
  await expect(page.locator("#mflStatsTotalPlayers")).toHaveText("18");
  await expect(page.locator("#mflStatsPackablePlayers")).toHaveText("10");
  await expect(page.locator("#mflStatsAgedPlayers")).toHaveText("3");
  await expect(page.locator("#mflStatsOtherPlayers")).toHaveText("5");
  await expect(page.locator("#mflStatsAgeDistribution .mflStatsHistogram")).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  expect(summaryRequests).toBe(1);
  expect(fullRowRequests).toBe(0);

  await page.getByRole("button", { name: "90-94", exact: true }).click();
  await expect(page.locator("#mflStatsTotalPlayers")).toHaveText("8");
  await expect(page.locator("#mflStatsPackablePlayers")).toHaveText("0");
  await expect(page.locator("#mflStatsAgedPlayers")).toHaveText("3");
  await expect(page.locator("#mflStatsOtherPlayers")).toHaveText("5");
  expect(summaryRequests).toBe(1);
  expect(fullRowRequests).toBe(0);
});
