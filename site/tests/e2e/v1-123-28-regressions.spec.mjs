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

async function installHoverProbe(page) {
  await page.evaluate(() => {
    const style = globalThis.document.createElement("style");
    style.id = "waitHoverShieldProbeStyles";
    style.textContent = `
      #waitHoverShieldProbe {
        position: fixed;
        left: 300px;
        top: 220px;
        width: 160px;
        height: 48px;
        background: rgb(0, 0, 255);
        transition: background-color 2s ease, transform 2s ease;
      }
      #waitHoverShieldProbe:hover {
        background: rgb(255, 0, 0);
        transform: translateX(24px);
      }
    `;
    globalThis.document.head.appendChild(style);
    const probe = globalThis.document.createElement("button");
    probe.id = "waitHoverShieldProbe";
    probe.textContent = "Hover probe";
    globalThis.document.body.appendChild(probe);
  });
}

async function hoverState(page) {
  return page.locator("#waitHoverShieldProbe").evaluate((node) => {
    const style = globalThis.getComputedStyle(node);
    return {
      hovered: node.matches(":hover"),
      background: style.backgroundColor,
      transform: style.transform,
      transitionDuration: style.transitionDuration,
    };
  });
}

test("global busy removes the actual hover state until wait ends", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  await installHoverProbe(page);

  const probe = page.locator("#waitHoverShieldProbe");
  await probe.hover();
  await expect.poll(() => probe.evaluate((node) => node.matches(":hover"))).toBe(true);

  const token = await page.evaluate(() => globalThis.__mflInteractionBusy.begin("interaction-loading"));
  await expect(page.locator("html")).toHaveClass(/mflInteractionBusy/);
  await expect.poll(() => probe.evaluate((node) => node.matches(":hover"))).toBe(false);

  const waiting = await hoverState(page);
  expect(waiting.hovered).toBe(false);
  expect(waiting.background).toBe("rgb(0, 0, 255)");
  expect(waiting.transform).toBe("none");
  expect(waiting.transitionDuration).toBe("0s");

  await page.evaluate((value) => globalThis.__mflInteractionBusy.end(value), token);
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
});

test("a non-token wait cursor also shields hover and releases without sticking", async ({ page }) => {
  await page.goto("/");
  await waitForArchitecture(page);
  await installHoverProbe(page);

  const probe = page.locator("#waitHoverShieldProbe");
  await probe.hover();
  await expect.poll(() => probe.evaluate((node) => node.matches(":hover"))).toBe(true);

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "wait";
  });
  await expect(page.locator("html")).toHaveClass(/mflWaitHoverSuppressed/);
  await expect.poll(() => probe.evaluate((node) => node.matches(":hover"))).toBe(false);

  const waiting = await hoverState(page);
  expect(waiting.background).toBe("rgb(0, 0, 255)");
  expect(waiting.transform).toBe("none");

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "";
  });
  await expect(page.locator("html")).not.toHaveClass(/mflWaitHoverSuppressed/);
});
