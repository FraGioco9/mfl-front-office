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

function databaseStatsPayload() {
  return {
    totalPlayers: 15,
    totalActivePlayers: 10,
    totalRetiredPlayers: 5,
    rows: [
      [80, 25, 0, 5],
      [80, 25, 1, 7],
      [90, 26, 2, 3],
    ],
  };
}

function mflStatsPayload() {
  return {
    totalPlayers: 10,
    rows: [
      [80, 25, "packable", 4],
      [90, 26, "packable", 3],
      [70, 27, "aged", 2],
      [60, 28, "other", 1],
    ],
  };
}

async function gateAppScript(page) {
  let releaseApp;
  const gate = new Promise((resolve) => { releaseApp = resolve; });
  await page.route("**/app.js?**", async (route) => {
    await gate;
    await route.continue();
  });
  return () => releaseApp();
}

test("Home content has its final position before app.js for an opted-in wallet", async ({ page }) => {
  await page.addInitScript(() => {
    const wallet = "0x1234";
    globalThis.localStorage.setItem("mfl-linked-wallet-v1", wallet);
    globalThis.localStorage.setItem("mfl-linked-wallet-proof-v1", JSON.stringify({
      type: "user-signature",
      address: wallet,
      signingAddress: wallet,
      message: "MFL Front Office Dapper Opt-In",
      appIdentifier: "MFL Front Office Dapper Opt-In",
      signatures: ["signature"],
    }));
    globalThis.localStorage.removeItem(`mfl-wallet-permission-cache-v1:${wallet}`);
  });

  const releaseApp = await gateAppScript(page);
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#homePage")).toBeVisible();
  await expect(page.locator("#homeOptInButton")).toBeHidden();

  const before = await page.locator("#homePage .homeIntro").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width };
  });

  releaseApp();
  await waitForArchitecture(page);
  const after = await page.locator("#homePage .homeIntro").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width };
  });

  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
});

test("Database Stats view buttons and card widths are final before app.js", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "database-stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(databaseStatsPayload()),
      });
      return;
    }
    await route.continue();
  });

  const releaseApp = await gateAppScript(page);
  await page.goto("/database/stats", { waitUntil: "commit" });

  const statsPage = page.locator("#databaseStatsPage");
  await expect(statsPage).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  expect(await statsPage.locator(".views .viewButton").allTextContents()).toEqual(["Attributes", "Contracts", "Stats"]);
  await expect(statsPage.locator('.viewButton[data-view="stats"]')).toBeVisible();
  await expect(statsPage.locator('.viewButton[data-view="stats"]')).toHaveClass(/active/);

  const before = await statsPage.locator(".databaseStatsCards article").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: rect.width };
  }));
  expect(before).toHaveLength(5);
  expect(new Set(before.map((card) => Math.round(card.top))).size).toBe(1);

  releaseApp();
  await waitForArchitecture(page);
  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("10");
  const after = await statsPage.locator(".databaseStatsCards article").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: rect.width };
  }));

  expect(after).toHaveLength(5);
  after.forEach((card, index) => {
    expect(Math.abs(card.width - before[index].width)).toBeLessThanOrEqual(1);
    expect(Math.abs(card.top - before[index].top)).toBeLessThanOrEqual(1);
  });
});

test("MFL Stats histogram is opaque and navigation can leave and re-enter Stats", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "mfl-stats-summary") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mflStatsPayload()),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/mfl/stats");
  await waitForArchitecture(page);
  await expect(page.locator("#mflStatsTotalPlayers")).toHaveText("10");

  const histogram = page.locator("#mflStatsPage .mflStatsHistogram");
  await expect(histogram).toBeVisible();
  expect(await histogram.evaluate((node) => {
    const style = globalThis.getComputedStyle(node);
    return { opacity: style.opacity, animationName: style.animationName, transform: style.transform };
  })).toEqual({ opacity: "1", animationName: "none", transform: "none" });

  await page.locator('#mflStatsPage .viewButton[data-view="attributes"]').click();
  await expect(page).toHaveURL(/\/mfl\/attributes$/);
  await expect(page.locator("#progressionPage")).toBeVisible();
  await expect(page.locator("#mflStatsPage")).toBeHidden();

  await page.locator('#progressionPage .viewButton[data-view="stats"]').click();
  await expect(page).toHaveURL(/\/mfl\/stats$/);
  await expect(page.locator("#mflStatsPage")).toBeVisible();

  await page.locator('#sidebar .navButton[data-page="database"]').click();
  await expect(page).toHaveURL(/\/database\/attributes$/);
  await expect(page.locator("#progressionPage")).toBeVisible();
  await expect(page.locator("#mflStatsPage")).toBeHidden();
});
