import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("boots from the static shell with the direct classic application core", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await expect(page.locator("#appShell")).toBeAttached();
  await expect(page.locator("#loadingScreen")).toHaveCount(0);
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.2");

  const architecture = await page.evaluate(() => ({
    loadedUrls: globalThis.performance.getEntriesByType("resource").map((entry) => entry.name),
    runtimes: Array.from(globalThis.document.scripts)
      .map((script) => script.dataset.mflRuntime || "")
      .filter(Boolean),
  }));
  expect(architecture.loadedUrls.some((url) => url.includes("/bootstrap.js"))).toBe(false);
  expect(architecture.loadedUrls.some((url) => url.includes("/index-shell.html"))).toBe(false);
  expect(architecture.runtimes).toContain("/modules/legacy-core.js");
  expect(architecture.runtimes).not.toContain("core");
});

test("keeps Evaluation directly addressable after modular startup", async ({ page }) => {
  await page.goto("/evaluation");
  await waitForArchitecture(page);
  await expect(page.locator("#evaluationPage")).toBeVisible();
});

test("reveals the complete Changelog atomically on refresh", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__mflSawVisibleStaleChangelog = false;
    const inspect = () => {
      document.querySelectorAll(".changelogList span").forEach((node) => {
        if (String(node.textContent || "").trim() !== "v1.119.29") return;
        const hiddenAncestor = node.closest("[hidden]");
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (!hiddenAncestor && style.display !== "none" && style.visibility !== "hidden"
            && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0) {
          globalThis.__mflSawVisibleStaleChangelog = true;
        }
      });
      requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });

  await page.goto("/changelog");
  await waitForArchitecture(page);

  const list = page.locator(".changelogList");
  await expect(list).toBeVisible();
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.2");
  await expect(list).toContainText("v1.123.1");
  await expect(list).toContainText("v1.123.0");
  expect(await page.evaluate(() => globalThis.__mflSawVisibleStaleChangelog)).toBe(false);

  await page.reload();
  await waitForArchitecture(page);
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.2");
  expect(await page.evaluate(() => globalThis.__mflSawVisibleStaleChangelog)).toBe(false);
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

  expect(metadata.version).toBe("1.123.2");
  expect(rows[0][0]).toBe("v1.123.2");
  expect(rows[0][1]).toBe(metadata.description);
  expect(rows.slice(0, 3).map((row) => row[0])).toEqual(["v1.123.2", "v1.123.1", "v1.123.0"]);
});
