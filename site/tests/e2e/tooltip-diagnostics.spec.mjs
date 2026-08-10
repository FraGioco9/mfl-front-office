import { expect, test } from "@playwright/test";

async function waitForArchitecture(page) {
  await page.waitForFunction(() => {
    const readiness = globalThis.document.documentElement.dataset.mflReady;
    return readiness === "true" || readiness === "error";
  });
  const readiness = await page.locator("html").getAttribute("data-mfl-ready");
  expect(readiness).toBe("true");
}

test("diagnose recent Evaluation Discount Rate hover", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem("mfl-recent-evaluation-searches-v1", JSON.stringify(["102"]));
    globalThis.localStorage.setItem("mfl-recent-searches-v1", JSON.stringify([
      "agent:0xagent",
      "club:roma-club",
      "player:102",
    ]));
  });

  await page.route("**/api/data?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mode") !== "search" || url.searchParams.get("type") !== "recent") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        players: {
          columns: ["player_id", "name", "overall", "nationality", "positions", "retirement_years"],
          rows: [[102, "Recent Active Player", 88, "Italy", "CM", null]],
        },
        agents: {
          columns: ["wallet_address", "wallet_name", "player_count"],
          rows: [["0xagent", "Recent Agent", 12]],
        },
        clubs: [{ clubId: "roma-club", name: "Recent Club", division: 2 }],
      }),
    });
  });

  await page.goto("/evaluation");
  await waitForArchitecture(page);
  await expect(page.locator("#evaluationSearchInput")).toBeFocused();
  await expect(page.locator("#evaluationSearchResults")).toContainText("Recent Active Player");

  await page.evaluate(() => {
    const state = {
      events: {},
      portalAdds: 0,
      portalRemoves: 0,
      controllerShowCalls: 0,
      controllerHideCalls: 0,
    };
    for (const eventName of ["pointerover", "pointermove", "pointerout", "mouseover", "mousemove", "mouseout", "scroll", "blur", "focusin", "focusout"]) {
      state.events[eventName] = [];
      globalThis.addEventListener(eventName, (event) => {
        const target = event.target;
        const entry = {
          target: target instanceof globalThis.Element ? `${target.tagName}.${String(target.className || "")}` : String(target?.constructor?.name || ""),
          metric: Boolean(target instanceof globalThis.Element && target.closest(".evaluationMetric.evaluationDiscountRate")),
          busy: globalThis.document.documentElement.classList.contains("mflInteractionBusy"),
          scrollY: globalThis.scrollY,
        };
        state.events[eventName].push(entry);
      }, true);
    }
    const observer = new globalThis.MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof globalThis.Element && node.id === "evaluationDiscountTooltipPortal") state.portalAdds += 1;
        }
        for (const node of record.removedNodes) {
          if (node instanceof globalThis.Element && node.id === "evaluationDiscountTooltipPortal") state.portalRemoves += 1;
        }
      }
    });
    observer.observe(globalThis.document.body, { childList: true });
    const controller = globalThis.__mflDiscountTooltipController;
    if (controller) {
      const originalShow = controller.show;
      const originalHide = controller.hide;
      controller.show = (...args) => {
        state.controllerShowCalls += 1;
        return originalShow.apply(controller, args);
      };
      controller.hide = (...args) => {
        state.controllerHideCalls += 1;
        return originalHide.apply(controller, args);
      };
    }
    globalThis.__tooltipDiagnosticState = state;
  });

  const metric = page.locator(".evaluationMetric.evaluationDiscountRate");
  const before = await page.evaluate(() => {
    const metricNode = globalThis.document.querySelector(".evaluationMetric.evaluationDiscountRate");
    const results = globalThis.document.querySelector("#evaluationSearchResults");
    return {
      busy: globalThis.document.documentElement.classList.contains("mflInteractionBusy"),
      bodyCursor: globalThis.getComputedStyle(globalThis.document.body).cursor,
      htmlCursor: globalThis.getComputedStyle(globalThis.document.documentElement).cursor,
      active: globalThis.document.activeElement?.id || globalThis.document.activeElement?.className || "",
      scrollY: globalThis.scrollY,
      innerHeight: globalThis.innerHeight,
      scrollHeight: globalThis.document.documentElement.scrollHeight,
      metricRect: metricNode?.getBoundingClientRect().toJSON?.() || null,
      resultsRect: results?.getBoundingClientRect().toJSON?.() || null,
      runtime: Boolean(globalThis.__mflDiscountTooltipMouseRuntime),
      controller: Boolean(globalThis.__mflDiscountTooltipController),
    };
  });

  await metric.hover();
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => {
    const metricNode = globalThis.document.querySelector(".evaluationMetric.evaluationDiscountRate");
    const rect = metricNode?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : 0;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const hit = globalThis.document.elementFromPoint(x, y);
    return {
      busy: globalThis.document.documentElement.classList.contains("mflInteractionBusy"),
      bodyCursor: globalThis.getComputedStyle(globalThis.document.body).cursor,
      htmlCursor: globalThis.getComputedStyle(globalThis.document.documentElement).cursor,
      active: globalThis.document.activeElement?.id || globalThis.document.activeElement?.className || "",
      scrollY: globalThis.scrollY,
      metricHover: Boolean(metricNode?.matches(":hover")),
      hit: hit instanceof globalThis.Element ? `${hit.tagName}.${String(hit.className || "")}` : "",
      hitMetric: Boolean(hit instanceof globalThis.Element && hit.closest(".evaluationMetric.evaluationDiscountRate")),
      portalCount: globalThis.document.querySelectorAll("#evaluationDiscountTooltipPortal").length,
      portalVisible: Boolean(globalThis.document.querySelector("#evaluationDiscountTooltipPortal.visible")),
      state: globalThis.__tooltipDiagnosticState,
    };
  });

  console.log("TOOLTIP_DIAGNOSTICS", JSON.stringify({ before, after }));
  expect(after.portalCount, JSON.stringify({ before, after })).toBe(1);
});
