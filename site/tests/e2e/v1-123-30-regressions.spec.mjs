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

async function forceNonBusyWaitCursor(page) {
  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "wait";
  });
  await expect(page.locator("html")).not.toHaveClass(/mflInteractionBusy/);
  await expect(page.locator("html")).toHaveClass(/mflWaitHoverSuppressed/);
}

test("Database view buttons ignore stale wait cursor when the app is not busy", async ({ page }) => {
  await page.goto("/database/attributes");
  await waitForArchitecture(page);
  await forceNonBusyWaitCursor(page);

  await page.locator('#progressionPage .viewButton[data-view="contracts"]').click();
  await expect(page).toHaveURL(/\/database\/contracts$/);
  await expect(page.locator('#progressionPage .viewButton[data-view="contracts"]')).toHaveClass(/active/);

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "";
  });
});

test("Progression view buttons ignore stale wait cursor when the app is not busy", async ({ page }) => {
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
  });

  await page.goto("/progression/current-season");
  await waitForArchitecture(page);
  await forceNonBusyWaitCursor(page);

  await page.locator('#progressionPage .viewButton[data-view="all"]').click();
  await expect(page).toHaveURL(/\/progression\/all-time$/);
  await expect(page.locator('#progressionPage .viewButton[data-view="all"]')).toHaveClass(/active/);

  await page.evaluate(() => {
    globalThis.document.body.style.cursor = "";
  });
});
