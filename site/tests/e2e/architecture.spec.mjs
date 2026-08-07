import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("boots the static shell and releases startup busy state", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await expect(page.locator("#appShell")).toBeAttached();
  await expect(page.locator("#loadingScreen")).toHaveCount(0);
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.8");
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
  expect(await page.locator("body").getAttribute("aria-busy")).toBe("false");
});

test("does not flash Progression for an opted-out user on refresh", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/guest/);
  await expect(page.locator('#sidebar .navButton[data-page="progression"]')).toBeHidden();
  releaseMetadata();
});

test("pager and Showing x/y players stay hidden for the full data-loading state", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const pager = page.locator("#progressionPage nav.pager");
  const count = page.locator("#watchlistPlayerCount");
  await count.evaluate((node) => {
    node.hidden = false;
    node.textContent = "Showing 25/100 players";
  });

  expect(await pager.evaluate((node) => {
    const style = globalThis.getComputedStyle(node);
    return { top: style.paddingTop, bottom: style.paddingBottom };
  })).toEqual({ top: "12px", bottom: "12px" });

  const token = await page.evaluate(() => globalThis.__mflInteractionBusy.begin("requestIncrementalRoute"));
  await expect(page.locator("html")).toHaveClass(/mflDataLoading/);
  expect(await pager.evaluate((node) => globalThis.getComputedStyle(node).display)).toBe("none");
  expect(await count.evaluate((node) => globalThis.getComputedStyle(node).display)).toBe("none");

  await page.evaluate((value) => globalThis.__mflInteractionBusy.end(value), token);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
  expect(await count.evaluate((node) => globalThis.getComputedStyle(node).display)).not.toBe("none");
});

test("scoped loading finishes without leaving the site interaction-locked", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await page.evaluate(async () => {
    await globalThis.__mflInteractionBusy.run(async () => Promise.resolve(), "interaction-loading");
  });

  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
  expect(await page.locator("#openSearchButton").evaluate((node) => globalThis.getComputedStyle(node).cursor)).not.toBe("wait");
});

test("Total active players excludes retired rows even when retirement years are strings", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "database-stats") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          [80, 25, "0", 5],
          [80, 25, "1", 7],
          [90, 26, "2", 3],
        ],
      }),
    });
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("10");
  await expect(page.locator("#databaseStatsTotalPlayers").locator("xpath=..").locator("span")).toHaveText("Total active players");
});

test("MFL Stats never visibly exposes the player table during first load", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__mflStatsSawPlayerTable = false;
    const inspect = () => {
      if (!/^\/mfl\/stats\/?$/i.test(globalThis.location.pathname)) return;
      const tablePage = globalThis.document.getElementById("progressionPage");
      if (tablePage && globalThis.getComputedStyle(tablePage).display !== "none") {
        globalThis.__mflStatsSawPlayerTable = true;
      }
    };
    new globalThis.MutationObserver(inspect).observe(globalThis.document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-page"],
    });
    globalThis.document.addEventListener("DOMContentLoaded", inspect, { once: true });
  });

  await page.goto("/mfl/stats");
  await waitForArchitecture(page);

  await expect(page.locator("#mflStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  await expect(page.locator("#mflStatsPage .mflStatsCards")).toBeVisible();
  expect(await page.evaluate(() => globalThis.__mflStatsSawPlayerTable)).toBe(false);
});

test("reveals the complete Changelog atomically", async ({ page }) => {
  await page.goto("/changelog");
  await waitForArchitecture(page);
  const list = page.locator(".changelogList");
  await expect(list).toBeVisible();
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.8");
  await expect(list).toContainText("v1.123.6");
});

test("serves the centralized release as the newest Changelog row", async ({ request }) => {
  const release = await request.get("/release.json");
  const metadata = await release.json();
  const history = await request.get("/releases.json");
  const rows = await history.json();

  expect(metadata.version).toBe("1.123.8");
  expect(rows[0][0]).toBe("v1.123.8");
  expect(rows[0][1]).toBe(metadata.description);
  expect(rows.slice(0, 7).map((row) => row[0])).toEqual([
    "v1.123.8",
    "v1.123.6",
    "v1.123.5",
    "v1.123.3",
    "v1.123.2",
    "v1.123.1",
    "v1.123.0",
  ]);
});
