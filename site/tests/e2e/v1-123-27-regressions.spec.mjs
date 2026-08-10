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

function installOptIn(page) {
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

test("Database quick-filter names and cached checks paint before release metadata", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("mfl-table-filters-v1", JSON.stringify({
      pages: {
        database: {
          hideRetired: false,
          hideRetiring: true,
          hideMflPlayers: false,
          newMints: true,
        },
      },
    }));
  });

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hideRetiredInput")).not.toBeChecked();
  await expect(page.locator("#hideRetiringInput")).toBeChecked();
  await expect(page.locator("#hideMflPlayersFilter")).toBeVisible();
  await expect(page.locator("#hideMflPlayersInput")).not.toBeChecked();
  await expect(page.locator("#newMintsInput")).toBeChecked();
  await expect(page.locator("#packablePlayersFilter")).toBeHidden();
  await expect(page.locator(".quickFilters")).toContainText("Hide retired players");
  await expect(page.locator(".quickFilters")).toContainText("Hide retiring players");
  await expect(page.locator(".quickFilters")).toContainText("Hide MFL players");
  await expect(page.locator(".quickFilters")).toContainText("Only new mints");

  releaseMetadata();
  await waitForArchitecture(page);
});

test("MFL packable quick filter paints from cache before release metadata", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("mfl-table-filters-v1", JSON.stringify({
      pages: {
        mfl: {
          hideRetired: true,
          hideRetiring: false,
          mflPackable: false,
          newMints: false,
        },
      },
    }));
  });

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/mfl/attributes", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#packablePlayersFilter")).toBeVisible();
  await expect(page.locator("#packablePlayersFilter")).toContainText("Only packable players");
  await expect(page.locator("#packablePlayersInput")).not.toBeChecked();
  await expect(page.locator("#hideMflPlayersFilter")).toBeHidden();

  releaseMetadata();
  await waitForArchitecture(page);
});

test("MFL Stats filter buttons fit on one line", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "mfl-stats-summary") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rows: [[90, 24, "packable", 1]] }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/mfl/stats");
  await waitForArchitecture(page);
  const buttons = page.locator("#mflStatsOverallFilters .mflStatsFilterButton");
  await expect(buttons).toHaveCount(15);

  const geometry = await page.locator("#mflStatsOverallFilters").evaluate((container) => {
    const items = Array.from(container.querySelectorAll(".mflStatsFilterButton"));
    const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
    return {
      rows: new Set(tops).size,
      scrollWidth: container.scrollWidth,
      clientWidth: container.clientWidth,
      maxWidth: Math.max(...items.map((item) => item.getBoundingClientRect().width)),
    };
  });
  expect(geometry.rows).toBe(1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.maxWidth).toBeLessThan(110);
});

test("Database to My Players restores canonical view-button order before paint", async ({ page }) => {
  await installOptIn(page);
  await page.goto("/database/attributes");
  await waitForArchitecture(page);

  await page.locator('#sidebar .navButton[data-page="myplayers"]').click();
  await expect(page).toHaveURL(/\/my-players\//);
  const visibleButtons = page.locator("#progressionPage .views > .viewButton:visible");
  await expect(visibleButtons).toHaveCount(5);
  expect(await visibleButtons.allTextContents()).toEqual([
    "Attributes",
    "Next Overall",
    "Contracts",
    "Current Season",
    "All Time",
  ]);
});

test("a wait cursor suppresses hover transitions animations and transforms", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await page.evaluate(() => {
    const style = globalThis.document.createElement("style");
    style.id = "waitHoverProbeStyles";
    style.textContent = `
      @keyframes waitHoverProbePulse { from { opacity: 1; } to { opacity: .7; } }
      #waitHoverProbe { transition: transform 2s ease; }
      #waitHoverProbe:hover { transform: translateX(20px); animation: waitHoverProbePulse 2s infinite; }
    `;
    globalThis.document.head.appendChild(style);
    const probe = globalThis.document.createElement("button");
    probe.id = "waitHoverProbe";
    probe.textContent = "Probe";
    globalThis.document.body.appendChild(probe);
    globalThis.document.body.style.cursor = "wait";
  });

  await expect(page.locator("html")).toHaveClass(/mflWaitHoverSuppressed/);
  await page.locator("#waitHoverProbe").hover({ force: true });
  const state = await page.locator("#waitHoverProbe").evaluate((node) => {
    const style = globalThis.getComputedStyle(node);
    return {
      transitionDuration: style.transitionDuration,
      animationName: style.animationName,
      transform: style.transform,
    };
  });
  expect(state.transitionDuration).toBe("0s");
  expect(state.animationName).toBe("none");
  expect(state.transform).toBe("none");
});
