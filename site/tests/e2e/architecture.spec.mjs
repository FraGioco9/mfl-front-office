import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.mflReady === "true");
}

test("boots from the static shell with the direct classic application core", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);

  await expect(page.locator("#appShell")).toBeAttached();
  await expect(page.locator("#loadingScreen")).toHaveCount(0);
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.4");

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

test("paints static chrome locked with wait cursor before async startup", async ({ page }) => {
  let releaseMetadata;
  const releaseGate = new Promise((resolve) => {
    releaseMetadata = resolve;
  });

  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/database/attributes", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator("#menuRail")).toBeVisible();
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator(".siteFooter")).toBeVisible();
  await expect(page.locator(".siteFooter")).toContainText("MFL Front Office v1.123.4");
  await expect(page.locator("#progressionPage")).toBeVisible();
  await expect(page.locator("#tablePageTitle")).toHaveText("Database");
  await expect(page.locator('#progressionPage .viewButton[data-view="attributes"]')).toHaveClass(/active/);

  const firstPaint = await page.evaluate(() => {
    const probe = globalThis.document.createElement("button");
    let clicks = 0;
    probe.addEventListener("click", () => {
      clicks += 1;
    });
    globalThis.document.body.appendChild(probe);
    probe.click();
    const result = {
      staticReady: globalThis.document.documentElement.classList.contains("mflStaticShellReady"),
      runtimeReady: globalThis.document.documentElement.dataset.mflReady || "",
      bodyPage: globalThis.document.body.dataset.page,
      pinnedSidebar: globalThis.document.body.classList.contains("pinnedSidebarVisible"),
      interactionBusy: globalThis.document.documentElement.classList.contains("mflInteractionBusy"),
      busyDataset: globalThis.document.documentElement.dataset.interactionBusy,
      cursor: globalThis.getComputedStyle(probe).cursor,
      clicks,
    };
    probe.remove();
    return result;
  });
  expect(firstPaint).toEqual({
    staticReady: true,
    runtimeReady: "",
    bodyPage: "database",
    pinnedSidebar: true,
    interactionBusy: true,
    busyDataset: "true",
    cursor: "wait",
    clicks: 0,
  });

  releaseMetadata();
});

test("restores clicks only when the wait cursor is removed", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  await page.waitForFunction(() => !globalThis.document.documentElement.classList.contains("mflInteractionBusy"));

  const result = await page.evaluate(async () => {
    const probe = globalThis.document.createElement("button");
    let clicks = 0;
    probe.addEventListener("click", () => {
      clicks += 1;
    });
    globalThis.document.body.appendChild(probe);

    probe.click();
    const normalClicks = clicks;

    let finishWork;
    const workGate = new Promise((resolve) => {
      finishWork = resolve;
    });
    const work = globalThis.withInteractionBusy(async () => {
      await workGate;
    });
    await Promise.resolve();

    const duringBusy = globalThis.document.documentElement.classList.contains("mflInteractionBusy");
    const duringCursor = globalThis.getComputedStyle(probe).cursor;
    probe.click();
    const duringClicks = clicks;

    finishWork();
    await work;

    const afterBusy = globalThis.document.documentElement.classList.contains("mflInteractionBusy");
    const afterCursor = globalThis.getComputedStyle(probe).cursor;
    probe.click();
    const afterClicks = clicks;
    probe.remove();

    return {
      normalClicks,
      duringBusy,
      duringCursor,
      duringClicks,
      afterBusy,
      afterCursor,
      afterClicks,
    };
  });

  expect(result.normalClicks).toBe(1);
  expect(result.duringBusy).toBe(true);
  expect(result.duringCursor).toBe("wait");
  expect(result.duringClicks).toBe(1);
  expect(result.afterBusy).toBe(false);
  expect(result.afterCursor).not.toBe("wait");
  expect(result.afterClicks).toBe(2);
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
      globalThis.document.querySelectorAll(".changelogList span").forEach((node) => {
        if (String(node.textContent || "").trim() !== "v1.119.29") return;
        const hiddenAncestor = node.closest("[hidden]");
        const style = globalThis.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (!hiddenAncestor && style.display !== "none" && style.visibility !== "hidden"
            && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0) {
          globalThis.__mflSawVisibleStaleChangelog = true;
        }
      });
      globalThis.requestAnimationFrame(inspect);
    };
    globalThis.requestAnimationFrame(inspect);
  });

  await page.goto("/changelog");
  await waitForArchitecture(page);

  const list = page.locator(".changelogList");
  await expect(list).toBeVisible();
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.4");
  await expect(list).toContainText("v1.123.3");
  await expect(list).toContainText("v1.123.2");
  await expect(list).toContainText("v1.123.1");
  await expect(list).toContainText("v1.123.0");
  expect(await page.evaluate(() => globalThis.__mflSawVisibleStaleChangelog)).toBe(false);

  await page.reload();
  await waitForArchitecture(page);
  await expect(list.locator(".changelogPatchList > li").first()).toContainText("v1.123.4");
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

  expect(metadata.version).toBe("1.123.4");
  expect(rows[0][0]).toBe("v1.123.4");
  expect(rows[0][1]).toBe(metadata.description);
  expect(rows.slice(0, 5).map((row) => row[0])).toEqual(["v1.123.4", "v1.123.3", "v1.123.2", "v1.123.1", "v1.123.0"]);
});
