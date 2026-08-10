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

const MFL_OVERALL_LABELS = [
  "All", "90-94", "Legendary", "85-89", "80-84", "Rare", "75-79", "70-74",
  "Uncommon", "65-69", "60-64", "Limited", "55-59", "50-54", "Common",
];

test("MFL Stats Overall filters are complete and final-width before release metadata resolves", async ({ page }) => {
  let releaseMetadata;
  const releaseGate = new Promise((resolve) => { releaseMetadata = resolve; });
  await page.route("**/release.json", async (route) => {
    await releaseGate;
    await route.continue();
  });

  await page.goto("/mfl/stats", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mflStatsPage")).toBeVisible();

  const buttons = page.locator("#mflStatsOverallFilters .mflStatsFilterButton");
  await expect(buttons).toHaveCount(15);
  expect(await buttons.allTextContents()).toEqual(MFL_OVERALL_LABELS);
  await expect(page.locator("#mflStatsOverallFilters")).toHaveAttribute("data-static-overall-filters", "true");

  const geometry = await page.locator("#mflStatsOverallFilters").evaluate((container) => {
    const buttons = Array.from(container.querySelectorAll(".mflStatsFilterButton"));
    return {
      tops: buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
      widths: buttons.map((button) => button.getBoundingClientRect().width),
      scrollWidth: container.scrollWidth,
      clientWidth: container.clientWidth,
      flexWrap: globalThis.getComputedStyle(container).flexWrap,
    };
  });
  expect(new Set(geometry.tops).size).toBe(1);
  expect(geometry.widths.every((width) => width > 0)).toBe(true);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.flexWrap).toBe("nowrap");

  releaseMetadata();
  await waitForArchitecture(page);
});

test("wait cursor removes hover motion from MFL Stats controls", async ({ page }) => {
  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "mfl-stats-summary") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          [80, 24, "packable", 6],
          [82, 25, "packable", 4],
          [70, 28, "aged", 3],
        ],
      }),
    });
  });

  await page.goto("/mfl/stats");
  await waitForArchitecture(page);
  await expect(page.locator("#mflStatsOverallFilters .mflStatsFilterButton")).toHaveCount(15);

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "wait";
  });
  await expect(page.locator("html")).toHaveClass(/mflWaitHoverSuppressed/);

  const filter = page.locator('#mflStatsOverallFilters .mflStatsFilterButton[data-filter="rare"]');
  await filter.hover();
  const filterMotion = await filter.evaluate((node) => {
    const style = globalThis.getComputedStyle(node);
    return { transition: style.transitionDuration, animation: style.animationName, transform: style.transform };
  });
  expect(filterMotion.transition).toBe("0s");
  expect(filterMotion.animation).toBe("none");
  expect(filterMotion.transform).toBe("none");

  await expect.poll(() => page.evaluate(() => Boolean(
    globalThis.document.querySelector("#mflStatsAgeDistribution .mflStatsHistogramBar"),
  ))).toBe(true);
  const barMotion = await page.evaluate(() => {
    const node = globalThis.document.querySelector("#mflStatsAgeDistribution .mflStatsHistogramBar");
    if (!(node instanceof globalThis.HTMLElement)) throw new Error("MFL Stats histogram bar missing");
    const style = globalThis.getComputedStyle(node, "::before");
    return { transition: style.transitionDuration, animation: style.animationName };
  });
  expect(barMotion.transition).toBe("0s");
  expect(barMotion.animation).toBe("none");

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "";
  });
  await expect(page.locator("html")).not.toHaveClass(/mflWaitHoverSuppressed/);
});

test("view buttons remain clickable after a wait state ends", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "wait";
  });
  await expect(page.locator("html")).toHaveClass(/mflWaitHoverSuppressed/);
  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "";
  });
  await expect(page.locator("html")).not.toHaveClass(/mflWaitHoverSuppressed/);

  await page.locator('#progressionPage .viewButton[data-view="contracts"]').click();
  await expect(page).toHaveURL(/\/database\/contracts$/);
  await expect(page.locator('#progressionPage .viewButton[data-view="contracts"]')).toHaveClass(/active/);

  await page.locator('#progressionPage .viewButton[data-view="stats"]').click();
  await expect(page).toHaveURL(/\/database\/stats$/);
  await expect(page.locator("#databaseStatsPage")).toBeVisible();
});
