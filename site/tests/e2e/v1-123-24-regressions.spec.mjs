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

function recentPayload() {
  return {
    players: {
      columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
      rows: [[101, "Recent Only Player", 70, "Italy", "ST", null]],
    },
    agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
    clubs: [],
  };
}

function fullPayload() {
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

test("delayed recent results cannot replace a typed all-database global search", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("mfl-recent-searches-v1", JSON.stringify(["101"]));
    globalThis.localStorage.setItem("mfl-recent-search-items-v1", JSON.stringify(["player:101"]));
  });

  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search") {
      await route.continue();
      return;
    }

    if (url.searchParams.get("type") === "recent") {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(recentPayload()),
      }).catch(() => {});
      return;
    }

    if (url.searchParams.get("type") === "all" && url.searchParams.get("q") === "needle") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fullPayload()),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  await page.locator("#playerSearchInput").fill("needle");

  const results = page.locator("#playerSearchResults");
  await expect(results).toContainText("Needle Player");
  await expect(results).toContainText("Needle Club");
  await expect(results).toContainText("Needle Agent");
  await page.waitForTimeout(650);
  await expect(results).toContainText("Needle Player");
  await expect(results).toContainText("Needle Club");
  await expect(results).toContainText("Needle Agent");
  await expect(results).not.toContainText("Recent Only Player");
});

test("Database first paint shows headers and Loading players while pagination stays hidden", async ({ page }) => {
  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#tableHead th")).not.toHaveCount(0);
  await expect(page.locator("#tableBody")).toContainText("Loading players...");
  await expect(page.locator("#progressionPage nav.pager")).toBeHidden();

  const before = await page.locator("#tableColGroup col").evaluateAll((nodes) => nodes.map((node) => ({
    className: node.className,
    width: Number.parseFloat(globalThis.getComputedStyle(node).width),
  })));
  expect(before.length).toBeGreaterThan(5);

  releaseMetadata();
  await waitForArchitecture(page);
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
