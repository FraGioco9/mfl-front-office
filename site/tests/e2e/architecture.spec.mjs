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

function databaseStatsPayload(overrides = {}) {
  return {
    totalPlayers: 15,
    totalActivePlayers: 10,
    totalRetiredPlayers: 5,
    rows: [
      [80, 25, 0, 5],
      [80, 25, 1, 7],
      [90, 26, 2, 3],
    ],
    ...overrides,
  };
}

test("boots with header, sidebar, footer and their content before release loading", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".brandLink")).toHaveText("MFL Front Office");
  await expect(page.locator("#menuRail")).toBeVisible();
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator('#sidebar .navButton[data-page="database"]')).toContainText("Database");
  await expect(page.locator('#sidebar .navButton[data-page="mfl"]')).toContainText("MFL");
  await expect(page.locator(".siteFooter")).toBeVisible();
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.19");
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

test("does not flash Progression for an opted-in user without permission", async ({ page }) => {
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
    globalThis.localStorage.setItem(`mfl-wallet-permission-cache-v1:${wallet}`, JSON.stringify({ allowed: false }));
  });

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/evaluation", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator('#sidebar .navButton[data-page="progression"]')).toBeHidden();
  releaseMetadata();
});

test("an opted-in user with permission keeps Progression visible throughout startup", async ({ page }) => {
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
    globalThis.__progressionWasVisible = false;
    globalThis.__progressionDisappearedAfterVisible = false;
    const inspect = () => {
      const button = globalThis.document.querySelector('#sidebar .navButton[data-page="progression"]');
      if (!button) return;
      const visible = globalThis.getComputedStyle(button).display !== "none";
      if (globalThis.__progressionWasVisible && !visible) globalThis.__progressionDisappearedAfterVisible = true;
      if (visible) globalThis.__progressionWasVisible = true;
    };
    new globalThis.MutationObserver(inspect).observe(globalThis.document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "data-stored-progression-access"],
    });
    globalThis.document.addEventListener("DOMContentLoaded", inspect, { once: true });
  });

  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('#sidebar .navButton[data-page="progression"]')).toBeVisible();
  releaseMetadata();
  await waitForArchitecture(page);
  await expect(page.locator('#sidebar .navButton[data-page="progression"]')).toBeVisible();
  expect(await page.evaluate(() => globalThis.__progressionDisappearedAfterVisible)).toBe(false);
});

test("opting out on a locked page restores its Opt In button", async ({ page }) => {
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
  });

  await page.goto("/my-players/attributes");
  await waitForArchitecture(page);
  await page.locator("#accountButton").click();
  await page.locator("#linkWalletButton").click();

  await expect(page.locator("#myPlayersLockedPage")).toBeVisible();
  await expect(page.locator("#myPlayersOptInButton")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-stored-wallet-opt-in", "false");
});

test("pager and Showing x/y players stay hidden for the full table data-loading state", async ({ page }) => {
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

test("a wait cursor blocks clicks even without an explicit busy token", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const counts = await page.evaluate(() => {
    const button = globalThis.document.createElement("button");
    let clickCount = 0;
    button.addEventListener("click", () => { clickCount += 1; });
    globalThis.document.body.appendChild(button);
    button.style.cursor = "wait";
    button.click();
    const waitCount = clickCount;
    button.style.cursor = "pointer";
    button.click();
    button.remove();
    return { waitCount, pointerCount: clickCount };
  });

  expect(counts).toEqual({ waitCount: 0, pointerCount: 1 });
});

test("Database Stats refresh shows boxes and Overall filters immediately, then holds wait cursor until data finishes", async ({ page }) => {
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
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  let statsData;
  const statsGate = new Promise((resolve) => { statsData = resolve; });
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "database-stats") {
      await route.continue();
      return;
    }
    await statsGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(databaseStatsPayload()),
    });
  });

  await page.goto("/database/stats", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  await expect(page.locator("#databaseStatsPage .databaseStatsCards")).toBeVisible();
  await expect(page.locator("#progressionPage")).toBeHidden();
  const labels = await page.locator("#databaseStatsOverallFilters .mflStatsFilterButton").allTextContents();
  expect(labels).toEqual(["All", "Ultimate", "Legendary", "Rare", "Uncommon", "Limited", "Common", "Custom"]);
  expect(await page.evaluate(() => globalThis.__databaseStatsSawPlayerTable)).toBe(false);

  releaseMetadata();
  await waitForArchitecture(page);
  await expect(page.locator("html")).toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).toHaveClass(/mflDataLoading/);
  expect(await page.locator("#databaseStatsPage").evaluate((node) => globalThis.getComputedStyle(node).cursor)).toBe("wait");

  statsData();
  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("10");
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
});

test("Total active players uses the API total for all non-MFL, non-retired players", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "database-stats") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(databaseStatsPayload({ totalActivePlayers: 42 })),
    });
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("42");
  await page.getByRole("button", { name: "Rare", exact: true }).click();
  await expect(page.locator("#databaseStatsTotalPlayers")).toHaveText("7");
});

test("Database Stats content remains visible after ordinary page interactions", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "database-stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(databaseStatsPayload()),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  const statsPage = page.locator("#databaseStatsPage");
  await expect(statsPage).toBeVisible();
  await expect(statsPage.locator('.viewButton[data-view="attributes"]')).toBeVisible();
  await expect(statsPage.locator('.viewButton[data-view="contracts"]')).toBeVisible();
  await expect(statsPage.locator('.viewButton[data-view="stats"]')).toBeVisible();

  for (const target of [
    statsPage.locator(".tablePageTitle"),
    statsPage.locator(".databaseStatsCards article").first(),
    page.getByRole("button", { name: "Rare", exact: true }),
    page.getByRole("button", { name: "Age", exact: true }),
  ]) {
    await target.click();
    await expect(page).toHaveURL(/\/database\/stats$/);
    await expect(statsPage).toBeVisible();
    await expect(statsPage.locator(".databaseStatsCards")).toBeVisible();
  }
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
        totalPlayers: 18,
        totalActivePlayers: 18,
        totalRetiredPlayers: 0,
        rows: [
          [70, 21, 1, 4],
          [80, 22, 2, 6],
          [90, 23, 3, 8],
        ],
      }),
    });
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  const histogram = page.locator("#databaseStatsDistribution .mflStatsHistogram");
  await expect(histogram).toBeVisible();
  await expect(histogram).not.toHaveAttribute("data-database-stats-apply-transition", "true");
  await expect(histogram).not.toHaveClass(/databaseStatsAnimate/);

  await page.getByRole("button", { name: "Custom", exact: true }).click();
  const portal = page.locator("#databaseStatsCustomTooltipPortal");
  await expect(portal).toBeVisible();
  await portal.locator('[data-role="min"]').fill("75");
  await portal.locator('[data-role="max"]').fill("90");
  await expect(page.locator("#databaseStatsDistribution .mflStatsHistogram")).not.toHaveAttribute("data-database-stats-apply-transition", "true");
  await expect(page.locator("#databaseStatsDistribution .mflStatsHistogram")).not.toHaveClass(/databaseStatsAnimate/);

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

test("Database Stats is saved and restored as the Database view", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") === "database-stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(databaseStatsPayload()),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/database/stats");
  await waitForArchitecture(page);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
  expect(await page.evaluate(() => globalThis.eval("state.tablePageStates.database.view"))).toBe("stats");

  await page.evaluate(async () => {
    await globalThis.eval('setPage("home", true)');
    await globalThis.eval('setPage("database", true)');
  });
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
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

test("Changelog restores complete accepted history without stale first paint", async ({ page }) => {
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
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.19");
  await expect(list).toContainText("v1.123.13");
  await expect(list).toContainText("v1.123.12");
  await expect(list).toContainText("v1.123.11");
  await expect(list).toContainText("v1.123.10");
  await expect(list).toContainText("v1.123.9");
  await expect(list).toContainText("v1.121.0");
  await expect(list).toContainText("v1.120.48");
  await expect(list).toContainText("v1.120.3");
  await expect(list).toContainText("v1.120.0");
  expect(await page.evaluate(() => globalThis.__sawStaleChangelogVersion)).toBe(false);
});

test("serves the centralized release and complete recent Changelog bridge", async ({ request }) => {
  const release = await request.get("/release.json");
  const metadata = await release.json();
  const history = await request.get("/releases.json");
  const rows = await history.json();
  const versions = rows.map((row) => row[0]);

  expect(metadata.version).toBe("1.123.19");
  expect(rows[0][0]).toBe("v1.123.19");
  expect(rows[0][1]).toBe(metadata.description);
  for (const version of ["v1.123.13", "v1.123.12", "v1.123.11", "v1.123.10", "v1.123.9", "v1.121.0", "v1.120.48", "v1.120.30", "v1.120.3", "v1.120.0", "v1.119.8"]) {
    expect(versions).toContain(version);
  }
});

test("refresh shows the theme symbol that matches light or dark mode before runtime startup", async ({ page }) => {
  const context = page.context();
  for (const theme of ["light", "dark"]) {
    const themedPage = await context.newPage();
    await themedPage.addInitScript((value) => {
      globalThis.localStorage.setItem("mfl-theme", value);
    }, theme);

    let releaseMetadata;
    const gate = new Promise((resolve) => { releaseMetadata = resolve; });
    await themedPage.route("**/release.json", async (route) => {
      await gate;
      await route.continue();
    });

    await themedPage.goto("/", { waitUntil: "domcontentloaded" });
    await expect(themedPage.locator("html")).toHaveAttribute("data-theme", theme);
    if (theme === "dark") {
      await expect(themedPage.locator("#themeButton .themeSunSymbol")).toBeVisible();
      await expect(themedPage.locator("#themeButton .themeMoonSymbol")).toBeHidden();
    } else {
      await expect(themedPage.locator("#themeButton .themeMoonSymbol")).toBeVisible();
      await expect(themedPage.locator("#themeButton .themeSunSymbol")).toBeHidden();
    }

    const releaseResponse = themedPage.waitForResponse((response) => response.url().endsWith("/release.json"));
    releaseMetadata();
    await releaseResponse;
    await themedPage.unroute("**/release.json");
    await themedPage.close();
  }
});

test("first bare Database visit opens Attributes with every Database view visible", async ({ page }) => {
  let releaseMetadata;
  const gate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/database", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/database\/attributes$/);
  for (const view of ["attributes", "contracts", "stats"]) {
    await expect(page.locator(`#progressionPage .viewButton[data-view="${view}"]`)).toBeVisible();
  }
  await expect(page.locator('#progressionPage .viewButton[data-view="attributes"]')).toHaveClass(/active/);
  for (const view of ["next", "current", "all"]) {
    await expect(page.locator(`#progressionPage .viewButton[data-view="${view}"]`)).toBeHidden();
  }

  const releaseResponse = page.waitForResponse((response) => response.url().endsWith("/release.json"));
  releaseMetadata();
  await releaseResponse;
  await page.unroute("**/release.json");
});

test("busy cursor blocks click handlers and hover motion across the site", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const result = await page.evaluate(() => {
    const button = globalThis.document.createElement("button");
    button.style.transition = "background-color 1s ease";
    button.style.animation = "pulse 1s infinite";
    let clickCount = 0;
    let hoverCount = 0;
    button.addEventListener("click", () => { clickCount += 1; });
    button.addEventListener("pointerover", () => { hoverCount += 1; });
    globalThis.document.body.appendChild(button);

    const token = globalThis.__mflInteractionBusy.begin("interaction-loading");
    const busyStyle = globalThis.getComputedStyle(button);
    const busyState = {
      pointerEvents: busyStyle.pointerEvents,
      transitionDuration: busyStyle.transitionDuration,
      animationName: busyStyle.animationName,
    };
    button.dispatchEvent(new globalThis.PointerEvent("pointerover", { bubbles: true }));
    button.click();
    const blockedCounts = { clickCount, hoverCount };

    globalThis.__mflInteractionBusy.end(token);
    button.dispatchEvent(new globalThis.PointerEvent("pointerover", { bubbles: true }));
    button.click();
    button.remove();

    return { busyState, blockedCounts, releasedCounts: { clickCount, hoverCount } };
  });

  expect(result.busyState).toEqual({
    pointerEvents: "none",
    transitionDuration: "0s",
    animationName: "none",
  });
  expect(result.blockedCounts).toEqual({ clickCount: 0, hoverCount: 0 });
  expect(result.releasedCounts).toEqual({ clickCount: 1, hoverCount: 1 });
});

test("theme toggle preserves the loaded page DOM", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  const sentinel = page.locator("#homePage").evaluate((home) => {
    const node = globalThis.document.createElement("span");
    node.id = "themeContentSentinel";
    node.textContent = "loaded";
    home.appendChild(node);
    return globalThis.document.documentElement.dataset.theme;
  });
  const previousTheme = await sentinel;
  await page.locator("#themeButton").click();
  await expect(page.locator("#themeContentSentinel")).toHaveText("loaded");
  await expect(page.locator("html")).toHaveAttribute("data-theme", previousTheme === "dark" ? "light" : "dark");
  await expect(page).toHaveURL("/");
});

test("evaluation compact search omits retired players", async ({ page }) => {
  await page.goto("/evaluation");
  await waitForArchitecture(page);
  await page.evaluate(() => {
    globalThis.eval(`
      applyDatabaseSearchPayload({
        columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
        rows: [
          [101, "Retired Result", 90, "Italy", "ST", 0],
          [102, "Active Result", 80, "Italy", "CM", null]
        ]
      }, "players");
      evaluationSearchInput.value = "result";
      renderEvaluationSearchResults();
    `);
  });
  await expect(page.locator("#evaluationSearchResults")).toContainText("Active Result");
  await expect(page.locator("#evaluationSearchResults")).not.toContainText("Retired Result");
});

test("typed global and Evaluation search results update before their requests finish", async ({ page }) => {
  let releaseGlobalSearch;
  const globalSearchGate = new Promise((resolve) => { releaseGlobalSearch = resolve; });
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search" || url.searchParams.get("q") !== "roma") {
      await route.continue();
      return;
    }
    await globalSearchGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        players: {
          columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
          rows: [
            [101, "Roma Player 1", 90, "Italy", "ST", null],
            [102, "Roma Player 2", 89, "Italy", "ST", null],
            [103, "Roma Player 3", 88, "Italy", "ST", null],
            [104, "Roma Player 4", 87, "Italy", "ST", null],
            [105, "Roma Player 5", 86, "Italy", "ST", null],
            [106, "Roma Player 6", 85, "Italy", "ST", null],
          ],
        },
        agents: {
          columns: ["wallet_address", "wallet_name", "player_count"],
          rows: [["0xagent", "Roma Agent", 12]],
        },
        clubs: [{ clubId: "roma-club", name: "Roma Club", division: 2 }],
      }),
    });
  });

  await page.goto("/");
  await waitForArchitecture(page);
  const recentResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.searchParams.get("mode") === "search" && url.searchParams.get("type") === "recent";
  });
  await page.locator("#openSearchButton").click();
  await recentResponse;
  await page.locator("#playerSearchInput").focus();
  await page.evaluate(() => {
    globalThis.eval(`applyDatabaseSearchPayload({
      players: {
        columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
        rows: [
          [101, "Roma Player 1", 90, "Italy", "ST", null],
          [102, "Roma Player 2", 89, "Italy", "ST", null],
          [103, "Roma Player 3", 88, "Italy", "ST", null],
          [104, "Roma Player 4", 87, "Italy", "ST", null],
          [105, "Roma Player 5", 86, "Italy", "ST", null],
          [106, "Roma Player 6", 85, "Italy", "ST", null]
        ]
      },
      agents: {
        columns: ["wallet_address", "wallet_name", "player_count"],
        rows: [["0xagent", "Roma Agent", 12]]
      },
      clubs: [{ clubId: "roma-club", name: "Roma Club", division: 2 }]
    }, "all")`);
  });

  const globalResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.searchParams.get("mode") === "search" && url.searchParams.get("q") === "roma";
  });
  await page.locator("#playerSearchInput").fill("roma");
  await expect(page.locator("#playerSearchResults")).toContainText("Roma Player 1");
  await expect(page.locator("#playerSearchResults")).toContainText("Roma Club");
  await expect(page.locator("#playerSearchResults")).toContainText("Roma Agent");
  releaseGlobalSearch();
  await globalResponse;

  await page.locator("#closeSearchButton").click();
  await page.goto("/evaluation");
  await waitForArchitecture(page);

  let releaseEvaluationSearch;
  const evaluationSearchGate = new Promise((resolve) => { releaseEvaluationSearch = resolve; });
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search" || url.searchParams.get("q") !== "active") {
      await route.continue();
      return;
    }
    await evaluationSearchGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
        rows: [[102, "Active Player", 88, "Italy", "CM", null]],
      }),
    });
  });
  await page.evaluate(() => {
    globalThis.eval(`applyDatabaseSearchPayload({
      columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
      rows: [[102, "Active Player", 88, "Italy", "CM", null]]
    }, "players")`);
  });

  const evaluationResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.searchParams.get("mode") === "search" && url.searchParams.get("q") === "active";
  });
  await page.locator("#evaluationSearchInput").fill("active");
  await expect(page.locator("#evaluationSearchResults")).toContainText("Active Player");
  releaseEvaluationSearch();
  await evaluationResponse;
});

test("empty recent-search copy is padded and fallback font size is stabilized", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  await page.locator("#openSearchButton").click();
  const hint = page.locator("#playerSearchResults .searchHint");
  await expect(hint).toHaveText("Recent searches will appear here.");
  expect(await hint.evaluate((node) => globalThis.getComputedStyle(node).paddingLeft)).toBe("8px");
  expect(await page.locator("html").evaluate((node) => globalThis.getComputedStyle(node).fontSizeAdjust)).toBe("0.538");
});
