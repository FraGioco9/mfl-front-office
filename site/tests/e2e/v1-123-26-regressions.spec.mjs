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

function installProgressionAccess(page) {
  return page.addInitScript(() => {
    const wallet = "0x1234";
    globalThis.localStorage.setItem("mfl-linked-wallet-v1", wallet);
    globalThis.localStorage.setItem("mfl-linked-wallet-proof-v1", JSON.stringify({
      address: wallet,
      message: "MFL Front Office Dapper Opt-In",
      signatures: ["signature"],
    }));
    globalThis.localStorage.setItem(`mfl-wallet-permission-cache-v1:${wallet}`, JSON.stringify({ allowed: true }));
  });
}

test("Database Hide MFL players is visible before release metadata resolves", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hideMflPlayersFilter")).toBeVisible();
  await expect(page.locator("#hideMflPlayersInput")).toBeChecked();

  releaseMetadata();
  await waitForArchitecture(page);
});

test("MFL Stats remains visible after a page that does not allow Stats", async ({ page }) => {
  await installProgressionAccess(page);
  await page.goto("/progression/current-season");
  await waitForArchitecture(page);

  await expect(page.locator('#progressionPage .viewButton[data-view="stats"]')).toBeHidden();
  await page.locator('#sidebar .navButton[data-page="mfl"]').click();
  await expect(page).toHaveURL(/\/mfl\/attributes$/);
  await expect(page.locator('#progressionPage .viewButton[data-view="stats"]')).toBeVisible();
});

test("global search always shows at most five result boxes", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "search" && url.searchParams.get("q") === "omega") {
      const rows = Array.from({ length: 8 }, (_, index) => [
        900 + index,
        `Omega Player ${index + 1}`,
        90 - index,
        "Italy",
        "ST",
        null,
      ]);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          players: {
            columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
            rows,
          },
          agents: {
            columns: ["wallet_address", "wallet_name", "player_count"],
            rows: [
              ["0xomega1", "Omega Agent 1", 20],
              ["0xomega2", "Omega Agent 2", 10],
            ],
          },
          clubs: [
            { clubId: "omega-club-1", name: "Omega Club 1", division: 1 },
            { clubId: "omega-club-2", name: "Omega Club 2", division: 2 },
          ],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  await page.locator("#playerSearchInput").fill("omega");

  const boxes = page.locator("#playerSearchResults > .searchResult");
  await expect(boxes).toHaveCount(5);
});

test("legacy Loading players state collapses to one canonical table row", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);

  await page.evaluate(async () => {
    globalThis.eval("showTableBusyState()");
    await Promise.resolve();
  });

  const loadingCell = page.locator("#tableBody > .staticTableLoadingRow > .staticTableLoadingCell");
  await expect(loadingCell).toHaveCount(1);
  await expect(loadingCell).toHaveText("Loading players...");
  await expect(page.locator("#emptyState")).toBeHidden();
  await expect(page.locator("#emptyState")).toHaveText("");
});
