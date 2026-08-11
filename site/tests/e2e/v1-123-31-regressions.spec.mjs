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

async function installOptIn(page) {
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
    globalThis.localStorage.setItem(`mfl-wallet-permission-cache-v1:${wallet}`, JSON.stringify({
      allowed: true,
      checkedAt: Date.now(),
    }));
    globalThis.localStorage.setItem(`mfl-wallet-watchlist-v1:${wallet}`, JSON.stringify([
      { id: "scouts", name: "Scouts", playerIds: [] },
    ]));
  });
}

async function clickViewThroughWait(page, path, view, expectedPath) {
  await page.goto(path);
  await waitForArchitecture(page);
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "wait";
  });
  await page.locator(`#progressionPage .viewButton[data-view="${view}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${expectedPath.replaceAll("/", "\\/")}$`));
  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "";
  });
}

test("view buttons remain clickable across table pages under a stale wait cursor", async ({ page }) => {
  await installOptIn(page);

  await clickViewThroughWait(page, "/database/attributes", "contracts", "/database/contracts");
  await clickViewThroughWait(page, "/progression/current-season", "all", "/progression/all-time");
  await clickViewThroughWait(page, "/watchlist/scouts/attributes", "contracts", "/watchlist/scouts/contracts");
  await clickViewThroughWait(page, "/my-players/attributes", "next", "/my-players/next-overall");
  await clickViewThroughWait(page, "/mfl/attributes", "stats", "/mfl/stats");
});

test("Watchlist title never falls back on a visible rendered frame", async ({ page }) => {
  await installOptIn(page);

  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/watchlist/scouts/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#tablePageTitle")).toHaveText("Watchlist - Scouts");
  await page.evaluate(() => {
    globalThis.__watchlistFrameTitles = [];
    let remaining = 120;
    const sample = () => {
      const pageView = globalThis.document.getElementById("progressionPage");
      const title = globalThis.document.getElementById("tablePageTitle");
      const visible = pageView
        && !pageView.hidden
        && globalThis.getComputedStyle(pageView).display !== "none"
        && title
        && globalThis.getComputedStyle(title).visibility !== "hidden";
      if (visible) globalThis.__watchlistFrameTitles.push(String(title.textContent || "").trim());
      remaining -= 1;
      if (remaining > 0) globalThis.requestAnimationFrame(sample);
    };
    globalThis.requestAnimationFrame(sample);
  });

  releaseMetadata();
  await waitForArchitecture(page);
  await expect(page.locator("#tablePageTitle")).toHaveText("Watchlist - Scouts");
  await page.waitForTimeout(250);
  const frameTitles = await page.evaluate(() => globalThis.__watchlistFrameTitles || []);
  expect(frameTitles.length).toBeGreaterThan(0);
  expect(frameTitles.every((title) => title === "Watchlist - Scouts")).toBe(true);
});

test("Evaluation stays unfocused and fixed until readiness then focuses an empty search", async ({ page }) => {
  await installOptIn(page);
  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/evaluation", { waitUntil: "domcontentloaded" });
  const input = page.locator("#evaluationSearchInput");
  const searchGroup = page.locator("#evaluationPage .evaluationSearchGroup");
  await expect(page.locator("#evaluationPage")).toBeVisible();
  await expect(input).toHaveAttribute("inert", "");
  await expect(input).not.toBeFocused();
  const before = await searchGroup.boundingBox();
  expect(before).not.toBeNull();
  expect(await page.evaluate(() => globalThis.document.scrollingElement?.scrollTop || 0)).toBe(0);

  releaseMetadata();
  await waitForArchitecture(page);
  await expect(input).not.toHaveAttribute("inert", "");
  await expect(input).toBeFocused();
  const after = await searchGroup.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});

test("Database Stats All and Custom 1-99 show the same retired population", async ({ page }) => {
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
        totalPlayers: 18,
        totalActivePlayers: 9,
        totalRetiredPlayers: 9,
        rows: [
          [1, 20, 0, 3],
          [50, 25, 0, 4],
          [99, 30, 0, 2],
          [80, 24, 1, 9],
        ],
      }),
    });
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  const retired = page.locator("#databaseStatsRetired");
  await expect(retired).toHaveText("9");

  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  await expect(portal).toBeVisible();
  await portal.locator('[data-role="min"]').fill("1");
  await portal.locator('[data-role="max"]').fill("99");
  await portal.locator('[data-role="apply"]').click();
  await expect(retired).toHaveText("9");
});

test("typed global search returns players clubs and agents before visiting data pages", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search" || url.searchParams.get("type") !== "all" || url.searchParams.get("q") !== "zephyr") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        players: {
          columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
          rows: [[901, "Zephyr Player", 91, "Italy", "ST", null]],
        },
        clubs: [{ clubId: "zephyr-club", name: "Zephyr Club", division: 2 }],
        agents: {
          columns: ["wallet_address", "wallet_name", "player_count"],
          rows: [["0xzephyr", "Zephyr Agent", 14]],
        },
      }),
    });
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await expect(page.locator("html")).toHaveAttribute("data-global-search-authoritative", "true");
  await page.locator("#openSearchButton").click();
  await page.locator("#playerSearchInput").fill("zephyr");
  const results = page.locator("#playerSearchResults");
  await expect(results).toContainText("Zephyr Player");
  await expect(results).toContainText("Zephyr Club");
  await expect(results).toContainText("Zephyr Agent");
});
