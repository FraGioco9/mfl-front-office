import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("boots from the static shell without the retired bootstrap loader", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await expect(page.locator("#appShell")).toBeAttached();
  await expect(page.locator("#loadingScreen")).toHaveCount(0);
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.0");

  const loadedUrls = await page.evaluate(() => globalThis.performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(loadedUrls.some((url) => url.includes("/bootstrap.js"))).toBe(false);
  expect(loadedUrls.some((url) => url.includes("/index-shell.html"))).toBe(false);
});

test("keeps Evaluation directly addressable after modular startup", async ({ page }) => {
  await page.goto("/evaluation");
  await waitForArchitecture(page);
  await expect(page.locator("#evaluationPage")).toBeVisible();
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

  expect(metadata.version).toBe("1.123.0");
  expect(rows[0][0]).toBe("v1.123.0");
  expect(rows[0][1]).toBe(metadata.description);
});
