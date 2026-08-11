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
      address: "0X1234",
      signingAddress: wallet,
      message: "MFL Front Office Dapper Opt-In",
      appIdentifier: "MFL Front Office Dapper Opt-In",
      signatures: ["signature"],
    }));
    globalThis.localStorage.setItem(`mfl-wallet-permission-cache-v1:${wallet}`, JSON.stringify({ allowed: true, checkedAt: Date.now() }));
  });
}

test("entry document requests v1.123.34 application and stylesheet assets", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('link[rel="stylesheet"][href="/styles.css?v=1.123.34"]')).toHaveCount(1);
  await expect(page.locator('script[src="/app.js?v=1.123.34"]')).toHaveCount(1);
});

test("Evaluation title and Load button are final before release loading finishes", async ({ page }) => {
  await installOptIn(page);
  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => { await releaseGate; await route.continue(); });
  await page.goto("/evaluation", { waitUntil: "domcontentloaded" });
  const title = page.locator("#evaluationPage .evaluationTitleRow > .tablePageTitle");
  const load = page.locator("#evaluationLoadButton");
  const input = page.locator("#evaluationSearchInput");
  await expect(page.locator("#evaluationPage")).toBeVisible();
  await expect(load).toBeVisible();
  await expect(input).not.toBeFocused();
  const before = await title.boundingBox();
  expect(before).not.toBeNull();
  releaseMetadata();
  await waitForArchitecture(page);
  await expect(load).toBeVisible();
  const after = await title.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});

test("stale wait cursor does not block global or Evaluation recent-result buttons", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  const clicked = await page.evaluate(() => {
    globalThis.document.body.style.cursor = "wait";
    let globalClicks = 0;
    let evaluationClicks = 0;
    const globalResult = globalThis.document.createElement("button");
    globalResult.className = "searchResult";
    globalResult.addEventListener("click", () => { globalClicks += 1; });
    const evaluationResult = globalThis.document.createElement("button");
    evaluationResult.className = "evaluationSearchResult";
    evaluationResult.addEventListener("click", () => { evaluationClicks += 1; });
    globalThis.document.body.append(globalResult, evaluationResult);
    globalResult.click();
    evaluationResult.click();
    globalResult.remove();
    evaluationResult.remove();
    globalThis.document.body.style.cursor = "";
    return { globalClicks, evaluationClicks };
  });
  expect(clicked).toEqual({ globalClicks: 1, evaluationClicks: 1 });
});

test("typed global search reaches all categories without visiting data pages", async ({ page }) => {
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
        players: { columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"], rows: [[901, "Zephyr Player", 91, "Italy", "ST", null]] },
        clubs: [{ clubId: "zephyr-club", name: "Zephyr Club", division: 2 }],
        agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [["0xzephyr", "Zephyr Agent", 14]] },
      }),
    });
  });
  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  await page.locator("#playerSearchInput").fill("zephyr");
  const results = page.locator("#playerSearchResults");
  await expect(results).toContainText("Zephyr Player");
  await expect(results).toContainText("Zephyr Club");
  await expect(results).toContainText("Zephyr Agent");
});
