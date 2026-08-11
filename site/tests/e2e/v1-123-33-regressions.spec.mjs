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

test("real pointer clicks switch views on shared table pages", async ({ page }) => {
  await installOptIn(page);

  for (const [path, targetView, expectedPath] of [
    ["/database/attributes", "contracts", "/database/contracts"],
    ["/progression/current-season", "all", "/progression/all-time"],
    ["/watchlist/scouts/attributes", "contracts", "/watchlist/scouts/contracts"],
    ["/my-players/attributes", "next", "/my-players/next-overall"],
  ]) {
    await page.goto(path);
    await waitForArchitecture(page);
    const button = page.locator(`#progressionPage .viewButton[data-view="${targetView}"]`);
    await expect(button).toBeVisible();
    await button.click();
    await expect(page).toHaveURL(new RegExp(`${expectedPath.replaceAll("/", "\\/")}$`));
  }
});

test("table headers switch to destination chrome on pointerdown before route completion", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);
  const contracts = page.locator('#progressionPage .viewButton[data-view="contracts"]');
  await contracts.dispatchEvent("pointerdown", { pointerType: "mouse", button: 0 });
  await expect(page.locator("#tableHead")).toContainText("Rev. Share");
  await expect(page.locator("#tableHead")).toContainText("Club Name");
  await expect(page.locator("#tableHead")).toContainText("Division");
  await expect(page.locator("#tableBody .staticTableLoadingCell")).toHaveText("Loading players...");
});

test("Evaluation never renders a blank discount rate and route loading owns the wait cursor", async ({ page }) => {
  await installOptIn(page);
  await page.goto("/evaluation");
  await waitForArchitecture(page);

  const discount = page.locator("#evaluationDiscountRate");
  await discount.evaluate((node) => { node.textContent = ""; });
  await expect.poll(async () => String(await discount.textContent() || "").trim()).not.toBe("");

  await page.evaluate(() => globalThis.document.body.classList.add("evaluationRouteLoading"));
  await expect(page.locator("html")).toHaveClass(/mflInteractionBusy/);
  expect(await page.locator("#evaluationPage").evaluate((node) => globalThis.getComputedStyle(node).cursor)).toBe("wait");

  await page.evaluate(() => globalThis.document.body.classList.remove("evaluationRouteLoading"));
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
});

test("real pointer clicks reach visible global and Evaluation result listeners", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();

  await page.evaluate(() => {
    globalThis.__globalResultClicks = 0;
    const globalResults = globalThis.document.getElementById("playerSearchResults");
    const globalResult = globalThis.document.createElement("button");
    globalResult.type = "button";
    globalResult.className = "searchResult";
    globalResult.textContent = "Recent player";
    globalResult.addEventListener("click", () => { globalThis.__globalResultClicks += 1; });
    globalResults.replaceChildren(globalResult);
  });

  await page.locator("#playerSearchResults .searchResult").click();
  expect(await page.evaluate(() => globalThis.__globalResultClicks)).toBe(1);
  await page.locator("#closeSearchButton").click();

  await installOptIn(page);
  await page.goto("/evaluation");
  await waitForArchitecture(page);
  await page.evaluate(() => {
    globalThis.__evaluationResultClicks = 0;
    const evaluationResult = globalThis.document.createElement("button");
    evaluationResult.type = "button";
    evaluationResult.className = "evaluationSearchResult";
    evaluationResult.textContent = "Recent evaluation player";
    evaluationResult.addEventListener("click", () => { globalThis.__evaluationResultClicks += 1; });
    const evaluationResults = globalThis.document.getElementById("evaluationSearchResults");
    evaluationResults.hidden = false;
    evaluationResults.replaceChildren(evaluationResult);
  });

  await page.locator("#evaluationSearchResults .evaluationSearchResult").click();
  expect(await page.evaluate(() => globalThis.__evaluationResultClicks)).toBe(1);
});

test("opening global search focuses the input and typed search returns every category immediately", async ({ page }) => {
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
  await page.locator("#openSearchButton").click();
  const input = page.locator("#playerSearchInput");
  await expect(input).toBeFocused();
  await input.fill("zephyr");
  const results = page.locator("#playerSearchResults");
  await expect(results).toContainText("Zephyr Player");
  await expect(results).toContainText("Zephyr Club");
  await expect(results).toContainText("Zephyr Agent");
});
