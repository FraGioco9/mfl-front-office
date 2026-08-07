import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("boots the static shell and releases startup busy state", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await expect(page.locator("#appShell")).toBeAttached();
  await expect(page.locator("#loadingScreen")).toHaveCount(0);
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.6");
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
  expect(await page.locator("body").getAttribute("aria-busy")).toBe("false");

  const architecture = await page.evaluate(() => ({
    loadedUrls: globalThis.performance.getEntriesByType("resource").map((entry) => entry.name),
    runtimes: Array.from(globalThis.document.scripts).map((script) => script.dataset.mflRuntime || "").filter(Boolean),
  }));
  expect(architecture.loadedUrls.some((url) => url.includes("/bootstrap.js"))).toBe(false);
  expect(architecture.loadedUrls.some((url) => url.includes("/index-shell.html"))).toBe(false);
  expect(architecture.runtimes).toContain("/modules/legacy-core.js");
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
  await expect(page.locator("html")).toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).toHaveClass(/mflDataLoading/);
  await expect(page.locator("#progressionPage nav.pager")).toBeHidden();

  releaseMetadata();
});

test("pager has 12px vertical padding and is hidden only during data loading", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);

  const pager = page.locator("#progressionPage nav.pager");
  await expect(pager).toBeVisible();
  expect(await pager.evaluate((node) => {
    const style = globalThis.getComputedStyle(node);
    return [style.paddingTop, style.paddingBottom];
  })).toEqual(["12px", "12px"]);

  const token = await page.evaluate(() => globalThis.__mflInteractionBusy.begin("requestIncrementalRoute"));
  await expect(page.locator("html")).toHaveClass(/mflDataLoading/);
  await expect(pager).toBeHidden();

  await page.evaluate((value) => globalThis.__mflInteractionBusy.end(value), token);
  await expect(page.locator("html")).not.toHaveClass(/mflDataLoading/);
  await expect(pager).toBeVisible();
});

test("scoped busy operations restore interaction state", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const token = await page.evaluate(() => globalThis.__mflInteractionBusy.begin("interaction-loading"));
  await expect(page.locator("html")).toHaveClass(/mflInteractionBusy/);
  expect(await page.locator("#openSearchButton").evaluate((node) => globalThis.getComputedStyle(node).cursor)).toBe("wait");

  await page.evaluate((value) => globalThis.__mflInteractionBusy.end(value), token);
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  expect(await page.locator("#openSearchButton").evaluate((node) => globalThis.getComputedStyle(node).cursor)).not.toBe("wait");
});

test("reveals the complete Changelog atomically", async ({ page }) => {
  await page.goto("/changelog");
  await waitForArchitecture(page);

  const list = page.locator(".changelogList");
  await expect(list).toBeVisible();
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.6");
  await expect(list).toContainText("v1.123.5");
  await expect(list).toContainText("v1.123.3");

  await page.reload();
  await waitForArchitecture(page);
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.6");
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
});

test("applies the shared API request policy", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  const accept = await page.evaluate(async () => {
    const response = await globalThis.fetch("/api/test");
    return (await response.json()).accept;
  });
  expect(accept).toContain("application/json");
});

test("serves the centralized release as the newest Changelog row", async ({ request }) => {
  const release = await request.get("/release.json");
  const metadata = await release.json();
  const history = await request.get("/releases.json");
  const rows = await history.json();

  expect(metadata.version).toBe("1.123.6");
  expect(rows[0][0]).toBe("v1.123.6");
  expect(rows[0][1]).toBe(metadata.description);
  expect(rows.slice(0, 6).map((row) => row[0])).toEqual([
    "v1.123.6",
    "v1.123.5",
    "v1.123.3",
    "v1.123.2",
    "v1.123.1",
    "v1.123.0",
  ]);
});
