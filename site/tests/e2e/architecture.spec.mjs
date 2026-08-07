import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("boots with header, sidebar, footer and current version", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator("#menuRail")).toBeVisible();
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator(".siteFooter")).toBeVisible();
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.9");
  releaseMetadata();
  await waitForArchitecture(page);
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
  expect(await page.locator("body").getAttribute("aria-busy")).toBe("false");
});

test("an already opted-in user never sees the home Opt In button on refresh", async ({ page }) => {
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
    globalThis.localStorage.setItem(`mfl-wallet-permission-cache-v1:${wallet}`, JSON.stringify({ allowed: true }));
    globalThis.__mflOptInVisibleDuringRefresh = false;
    const inspect = () => {
      const button = globalThis.document.getElementById("homeOptInButton");
      if (!button) return;
      const style = globalThis.getComputedStyle(button);
      if (style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0) {
        globalThis.__mflOptInVisibleDuringRefresh = true;
      }
    };
    new globalThis.MutationObserver(inspect).observe(globalThis.document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "class"],
    });
    globalThis.document.addEventListener("DOMContentLoaded", inspect, { once: true });
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await expect(page.locator("#homeOptInButton")).toBeHidden();
  expect(await page.evaluate(() => globalThis.__mflOptInVisibleDuringRefresh)).toBe(false);
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

test("Database Stats refresh shows boxes and never visibly exposes the player table", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__databaseStatsSawPlayerTable = false;
    const inspect = () => {
      if (!/^\/database\/stats\/?$/i.test(globalThis.location.pathname)) return;
      const tablePage = globalThis.document.getElementById("progressionPage");
      if (tablePage && globalThis.getComputedStyle(tablePage).display !== "none") {
        globalThis.__databaseStatsSawPlayerTable = true;
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

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/database/stats", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#databaseStatsPage .databaseStatsCards")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  expect(await page.evaluate(() => globalThis.__databaseStatsSawPlayerTable)).toBe(false);
  releaseMetadata();
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

  await page.goto("/");
  await waitForArchitecture(page);
  await page.evaluate(() => {
    globalThis.history.pushState({}, "", "/database/stats");
    globalThis.__mflDatabaseStatsRuntime?.sync?.();
  });

  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("10");
  await expect(page.locator("#databaseStatsTotalPlayers").locator("xpath=..").locator("span")).toHaveText("Total active players");
});

test("Database Stats custom bars animate only when the portal Apply button is clicked", async ({ page }) => {
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
          [70, 21, 1, 4],
          [80, 22, 2, 6],
          [90, 23, 3, 8],
        ],
      }),
    });
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await page.evaluate(() => {
    globalThis.history.pushState({}, "", "/database/stats");
    globalThis.__mflDatabaseStatsRuntime?.sync?.();
  });
  const histogram = page.locator("#databaseStatsDistribution .mflStatsHistogram");
  await expect(histogram).toBeVisible();
  await expect(histogram).not.toHaveAttribute("data-database-stats-apply-transition", "true");
  await expect(histogram).not.toHaveClass(/databaseStatsAnimate/);

  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  await expect(portal).toBeVisible();
  await portal.locator('[data-role="min"]').fill("75");
  await portal.locator('[data-role="max"]').fill("90");
  await expect(histogram).not.toHaveAttribute("data-database-stats-apply-transition", "true");
  await expect(histogram).not.toHaveClass(/databaseStatsAnimate/);

  await portal.locator('[data-role="apply"]').click();
  const appliedHistogram = page.locator("#databaseStatsDistribution .mflStatsHistogram");
  await expect(appliedHistogram).toHaveAttribute("data-database-stats-apply-transition", "true");

  await page.locator('#databaseStatsPage .viewButton[data-view="attributes"]').click();
  await expect(page.locator("#progressionPage")).toBeVisible();
  await page.locator('#progressionPage .viewButton[data-view="stats"]').click();
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  const returnedHistogram = page.locator("#databaseStatsDistribution .mflStatsHistogram");
  await expect(returnedHistogram).not.toHaveAttribute("data-database-stats-apply-transition", "true");
  await expect(returnedHistogram).not.toHaveClass(/databaseStatsAnimate/);
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

  await page.goto("/mfl/stats", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  await expect(page.locator("#mflStatsPage")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  await expect(page.locator("#mflStatsPage .mflStatsCards")).toBeVisible();
  expect(await page.evaluate(() => globalThis.__mflStatsSawPlayerTable)).toBe(false);
});

test("Changelog has no stale 1.119.29 first paint", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__sawStaleChangelogVersion = false;
    const inspect = () => {
      if (!/^\/changelog\/?$/i.test(globalThis.location.pathname)) return;
      const text = globalThis.document.body?.innerText || "";
      if (text.includes("1.119.29")) globalThis.__sawStaleChangelogVersion = true;
    };
    new globalThis.MutationObserver(inspect).observe(globalThis.document, { childList: true, subtree: true, characterData: true });
    globalThis.document.addEventListener("DOMContentLoaded", inspect, { once: true });
  });

  await page.goto("/changelog");
  await waitForArchitecture(page);
  const list = page.locator(".changelogList");
  await expect(list).toBeVisible();
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.9");
  await expect(list).toContainText("v1.123.8");
  expect(await page.evaluate(() => globalThis.__sawStaleChangelogVersion)).toBe(false);
});

test("serves the centralized release as the newest Changelog row", async ({ request }) => {
  const release = await request.get("/release.json");
  const metadata = await release.json();
  const history = await request.get("/releases.json");
  const rows = await history.json();

  expect(metadata.version).toBe("1.123.9");
  expect(rows[0][0]).toBe("v1.123.9");
  expect(rows[0][1]).toBe(metadata.description);
  expect(rows.slice(0, 8).map((row) => row[0])).toEqual([
    "v1.123.9",
    "v1.123.8",
    "v1.123.6",
    "v1.123.5",
    "v1.123.3",
    "v1.123.2",
    "v1.123.1",
    "v1.123.0",
  ]);
});
