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

test("Evaluation shows its dash before app.js can take over", async ({ page }) => {
  let releaseApp;
  const appGate = new Promise((resolve) => { releaseApp = resolve; });
  await page.route("**/app.js?v=1.123.37", async (route) => {
    await appGate;
    await route.continue();
  });

  const navigation = page.goto("/evaluation", { waitUntil: "domcontentloaded" });
  const discountRate = page.locator("#evaluationDiscountRate");
  await discountRate.waitFor({ state: "attached" });
  await expect(discountRate).toHaveText("-");
  expect(await discountRate.evaluate((node) => globalThis.getComputedStyle(node).visibility)).toBe("visible");

  releaseApp();
  await navigation;
  await waitForArchitecture(page);
});

test("all five recent global-search results keep their real navigation handlers", async ({ page }) => {
  const playerIds = [901, 902, 903, 904, 905];
  await page.addInitScript((ids) => {
    globalThis.localStorage.setItem("mfl-recent-player-searches-v1", JSON.stringify(ids.map(String)));
    globalThis.localStorage.setItem("mfl-recent-searches-v1", JSON.stringify(ids.map((id) => `player:${id}`)));
  }, playerIds);

  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search" || url.searchParams.get("type") !== "recent") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        players: {
          columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
          rows: playerIds.map((id, index) => [id, `Recent Player ${index + 1}`, 90 - index, "Italy", "ST", null]),
        },
        agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
        clubs: [],
      }),
    });
  });

  for (const playerId of playerIds) {
    await page.goto("/");
    await waitForArchitecture(page);
    await page.locator("#openSearchButton").click();
    const results = page.locator("#playerSearchResults > .searchResult");
    await expect(results).toHaveCount(5);
    const result = page.locator(`#playerSearchResults > .searchResult[data-search-key="player:${playerId}"]`);
    await expect(result).toBeVisible();
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/players/${playerId}$`));
  }
});

test("typed global search uses full database results on a cold page", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.searchParams.get("mode") !== "search"
      || url.searchParams.get("type") !== "all"
      || url.searchParams.get("q") !== "Needle"
    ) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        players: {
          columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
          rows: [[991001, "Needle Player", 88, "Italy", "ST", null]],
        },
        agents: {
          columns: ["wallet_address", "wallet_name", "player_count"],
          rows: [["0xneedle", "Needle Agent", 12]],
        },
        clubs: [{ clubId: "991002", name: "Needle Club", division: 2 }],
      }),
    });
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  const input = page.locator("#playerSearchInput");
  await input.fill("Needle");

  const results = page.locator("#playerSearchResults > .searchResult");
  await expect(results).toHaveCount(3);
  await expect(results.nth(0)).toContainText("Needle Player");
  await expect(results.nth(1)).toContainText("Needle Club");
  await expect(results.nth(2)).toContainText("Needle Agent");
});

test("global search input is focused as soon as search opens", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const input = page.locator("#playerSearchInput");
  await page.locator("#openSearchButton").click();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.type("Gaetano");
  await expect(input).toHaveValue("Gaetano");
});

test("global search takes focus from the selected Evaluation search", async ({ page }) => {
  await page.goto("/evaluation");
  await waitForArchitecture(page);

  const evaluationInput = page.locator("#evaluationSearchInput");
  const globalInput = page.locator("#playerSearchInput");
  await evaluationInput.focus();
  await expect(evaluationInput).toBeFocused();

  await page.locator("#openSearchButton").click();
  await expect(globalInput).toBeVisible();
  await expect(globalInput).toBeFocused();
  await expect(evaluationInput).not.toBeFocused();

  await page.keyboard.type("Michel");
  await expect(globalInput).toHaveValue("Michel");
  await expect(evaluationInput).toHaveValue("");
});

test("all five recent Evaluation results keep their real click handlers", async ({ page }) => {
  const playerIds = [911, 912, 913, 914, 915];
  await page.addInitScript((ids) => {
    globalThis.localStorage.setItem("mfl-recent-evaluation-searches-v1", JSON.stringify(ids.map(String)));
  }, playerIds);

  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        players: {
          columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
          rows: playerIds.map((id, index) => [id, `Evaluation Player ${index + 1}`, 95 - index, "Italy", "ST", null]),
        },
        agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
        clubs: [],
      }),
    });
  });

  for (const playerId of playerIds) {
    await page.goto("/evaluation");
    await waitForArchitecture(page);
    const input = page.locator("#evaluationSearchInput");
    await input.focus();
    const results = page.locator("#evaluationSearchResults > .evaluationSearchResult");
    await expect(results).toHaveCount(5);
    const result = results.filter({ hasText: `#${playerId}` });
    await expect(result).toBeVisible();
    await result.click();
    await expect.poll(async () => new URL(page.url()).searchParams.get("player")).toBe(String(playerId));
  }
});
