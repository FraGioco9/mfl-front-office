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
