import { expect, test } from "@playwright/test";

const PHONE = { width: 390, height: 844 };

async function waitForArchitecture(page) {
  await page.waitForFunction(() => {
    const readiness = document.documentElement.dataset.mflReady;
    return readiness === "true" || readiness === "error";
  });
  const readiness = await page.locator("html").getAttribute("data-mfl-ready");
  if (readiness !== "true") {
    const startupError = await page.locator("#mflStartupError").textContent().catch(() => "");
    throw new Error(`MFL startup ended in ${readiness}: ${startupError || "no startup message"}`);
  }
}

async function expectNoPageHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => {
    const main = document.querySelector("body > #appShell > main");
    return {
      viewport: window.innerWidth,
      body: document.body.getBoundingClientRect().width,
      main: main?.getBoundingClientRect().width || 0,
      mainScroll: main?.scrollWidth || 0,
      mainClient: main?.clientWidth || 0,
    };
  });
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.main).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.mainScroll).toBeLessThanOrEqual(dimensions.mainClient + 1);
}

test.describe("mobile responsive layout", () => {
  test.use({ viewport: PHONE });

  test("shell uses full viewport with one horizontal navigation rail", async ({ page }) => {
    await page.goto("/");
    await waitForArchitecture(page);

    await expect(page.locator('link[data-mfl-responsive-layout="true"]')).toHaveCount(1);

    const layout = await page.evaluate(() => {
      const main = document.querySelector("body > #appShell > main");
      const rail = document.querySelector("#menuRail");
      const sidebar = document.querySelector("#sidebar");
      const menuButton = document.querySelector("#menuButton");
      return {
        mainMarginLeft: main ? getComputedStyle(main).marginLeft : "",
        mainWidth: main?.getBoundingClientRect().width || 0,
        railWidth: rail?.getBoundingClientRect().width || 0,
        railPosition: rail ? getComputedStyle(rail).position : "",
        sidebarDirection: sidebar ? getComputedStyle(sidebar).flexDirection : "",
        sidebarOverflowX: sidebar ? getComputedStyle(sidebar).overflowX : "",
        menuDisplay: menuButton ? getComputedStyle(menuButton).display : "",
      };
    });

    expect(layout.mainMarginLeft).toBe("0px");
    expect(Math.abs(layout.mainWidth - PHONE.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.railWidth - PHONE.width)).toBeLessThanOrEqual(1);
    expect(layout.railPosition).toBe("absolute");
    expect(layout.sidebarDirection).toBe("row");
    expect(layout.sidebarOverflowX).toBe("auto");
    expect(layout.menuDisplay).toBe("none");
    await expectNoPageHorizontalOverflow(page);
  });

  test("global search dialog stays inside the phone viewport", async ({ page }) => {
    await page.goto("/");
    await waitForArchitecture(page);
    await page.locator("#openSearchButton").click();
    await expect(page.locator("#searchModal")).toBeVisible();

    const box = await page.locator(".searchDialog").boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(7);
    expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width - 7);
    expect(box.height).toBeLessThanOrEqual(PHONE.height - 15);
  });

  test("player tables scroll inside their shell without widening the page", async ({ page }) => {
    await page.goto("/database/attributes");
    await waitForArchitecture(page);
    await page.waitForFunction(() => document.querySelector("#tableHead")?.dataset.staticHeader === "true");

    const tableLayout = await page.evaluate(() => {
      const scroller = document.querySelector("#progressionPage .tableScroller");
      const table = scroller?.querySelector("table");
      return {
        overflowX: scroller ? getComputedStyle(scroller).overflowX : "",
        clientWidth: scroller?.clientWidth || 0,
        scrollWidth: scroller?.scrollWidth || 0,
        tableWidth: table?.getBoundingClientRect().width || 0,
      };
    });

    expect(tableLayout.overflowX).toBe("auto");
    expect(tableLayout.scrollWidth).toBeGreaterThan(tableLayout.clientWidth);
    expect(tableLayout.tableWidth).toBeGreaterThan(1000);
    await expectNoPageHorizontalOverflow(page);
  });

  test("Evaluation and Stats collapse fixed desktop grids on phones", async ({ page }) => {
    await page.goto("/evaluation");
    await waitForArchitecture(page);

    const evaluationColumns = await page.locator(".evaluationSearchGroup").evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ));
    expect(evaluationColumns).toBe(1);
    await expectNoPageHorizontalOverflow(page);

    await page.goto("/database/stats");
    await waitForArchitecture(page);
    const statsColumns = await page.locator("#databaseStatsPage .databaseStatsCards").evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ));
    expect(statsColumns).toBe(1);
    await expectNoPageHorizontalOverflow(page);
  });
});
