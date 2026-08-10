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

function fullSearchPayload() {
  return {
    players: {
      columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
      rows: [[901, "Needle Player", 88, "Italy", "CM", null]],
    },
    agents: {
      columns: ["wallet_address", "wallet_name", "player_count"],
      rows: [["0xneedle", "Needle Agent", 31]],
    },
    clubs: [{ clubId: "needle-club", name: "Needle Club", division: 1 }],
  };
}

test("Discount Rate tooltip always dismisses after pointer focus leaves it", async ({ page }) => {
  await page.goto("/evaluation");
  await waitForArchitecture(page);

  const metric = page.locator(".evaluationMetric.evaluationDiscountRate");
  const tooltip = page.locator("#evaluationDiscountTooltipPortal");
  const search = page.locator("#evaluationSearchInput");

  await metric.hover();
  await expect(tooltip).toBeVisible();
  await metric.click();
  await search.hover();
  await expect(tooltip).toBeHidden();

  await metric.hover();
  await expect(tooltip).toBeVisible();
  await search.click();
  await expect(tooltip).toHaveCount(0);

  await metric.focus();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
});

test("typed global search ignores recent-only state and searches players clubs and agents", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("mfl-recent-searches-v1", JSON.stringify(["player:101"]));
  });

  let allRequests = 0;
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search") {
      await route.continue();
      return;
    }
    if (url.searchParams.get("type") === "recent") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          players: {
            columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
            rows: [[101, "Recent Only Player", 70, "Italy", "ST", null]],
          },
          agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
          clubs: [],
        }),
      });
      return;
    }
    if (url.searchParams.get("type") === "all" && url.searchParams.get("q") === "needle") {
      allRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fullSearchPayload()),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  await expect(page.locator("#playerSearchResults")).toContainText("Recent Only Player");

  await page.locator("#playerSearchInput").fill("needle");
  await expect(page.locator("#playerSearchResults")).toContainText("Needle Player");
  await expect(page.locator("#playerSearchResults")).toContainText("Needle Club");
  await expect(page.locator("#playerSearchResults")).toContainText("Needle Agent");
  await expect(page.locator("#playerSearchResults")).not.toContainText("Recent Only Player");
  expect(allRequests).toBeGreaterThanOrEqual(1);
});

test("Database view order and column widths are final before asynchronous startup", async ({ page }) => {
  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  const visibleButtons = page.locator("#progressionPage .views > .viewButton:visible");
  expect(await visibleButtons.allTextContents()).toEqual(["Attributes", "Contracts", "Stats"]);

  const before = await page.locator("#tableColGroup col").evaluateAll((nodes) => nodes.map((node) => {
    const style = globalThis.getComputedStyle(node);
    return {
      className: node.className,
      width: Number.parseFloat(style.width),
      minWidth: Number.parseFloat(style.minWidth),
      maxWidth: Number.parseFloat(style.maxWidth),
    };
  }));
  expect(before.length).toBeGreaterThan(5);
  for (const column of before) {
    expect(column.width).toBeGreaterThan(0);
    expect(Math.abs(column.minWidth - column.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(column.maxWidth - column.width)).toBeLessThanOrEqual(0.5);
  }

  releaseMetadata();
  await waitForArchitecture(page);
  expect(await visibleButtons.allTextContents()).toEqual(["Attributes", "Contracts", "Stats"]);
  const after = await page.locator("#tableColGroup col").evaluateAll((nodes) => nodes.map((node) => ({
    className: node.className,
    width: Number.parseFloat(globalThis.getComputedStyle(node).width),
  })));

  expect(after).toHaveLength(before.length);
  after.forEach((column, index) => {
    expect(column.className).toBe(before[index].className);
    expect(Math.abs(column.width - before[index].width)).toBeLessThanOrEqual(1);
  });
});

test("a newer My Players navigation wins when an older Watchlist navigation finishes later", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const finalRoute = await page.evaluate(async () => {
    globalThis.__mflWatchlistMyPlayersRouteRuntime?.destroy?.();
    let releaseWatchlist;
    const watchlistGate = new Promise((resolve) => { releaseWatchlist = resolve; });
    globalThis.__releaseWatchlistRouteTest = releaseWatchlist;

    globalThis.eval(`
      setPage = async function routeRaceTestSetPage(pageName) {
        if (pageName === "watchlist") await window.__watchlistRouteTestGate;
        state.currentPage = pageName;
        document.body.dataset.page = pageName;
        return pageName;
      };
    `);
    globalThis.__watchlistRouteTestGate = watchlistGate;

    const source = await fetch(`/watchlist-myplayers-route-runtime.js?test=${Date.now()}`).then((response) => response.text());
    globalThis.eval(source);

    const oldWatchlist = globalThis.eval('setPage("watchlist", true, { view: "attributes" })');
    await Promise.resolve();
    await globalThis.eval('setPage("myplayers", true, { view: "attributes" })');
    globalThis.__releaseWatchlistRouteTest();
    await oldWatchlist;
    await Promise.resolve();
    return {
      statePage: globalThis.eval("state.currentPage"),
      bodyPage: globalThis.document.body.dataset.page,
    };
  });

  expect(finalRoute).toEqual({ statePage: "myplayers", bodyPage: "myplayers" });
});
