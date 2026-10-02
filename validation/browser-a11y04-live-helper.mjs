import assert from "node:assert/strict";

export async function auditLiveAnnouncements(cdp, url, baseline) {
  assert.equal(baseline?.status, "passed", "Canonical route regression must pass before A11Y-04.");
  const evaluated = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const update = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      if (typeof showToast !== "function" || typeof announceActionStatus !== "function") {
        return {error: "Shared announcer or showToast is not available"};
      }
      showToast("Plan saved.");
      await update();
      const status = document.getElementById("mflActionStatus");
      const toast = document.getElementById("toastMessage");
      const first = {
        text: status?.textContent,
        role: status?.getAttribute("role"),
        live: status?.getAttribute("aria-live"),
        atom: status?.getAttribute("aria-atomic"),
        hiddenVisualToast: toast?.getAttribute("aria-hidden"),
        count: document.querySelectorAll("#mflActionStatus").length,
      };
      const duplicate = announceActionStatus("Plan saved.");
      const conflict = announceActionStatus("Plan changed elsewhere.", { urgent:true });
      await update();
      const alert = document.getElementById("mflActionAlert");
      const urgent = {
        text: alert?.textContent,
        role: alert?.getAttribute("role"),
        politeCleared: status?.textContent === "",
        count: document.querySelectorAll("#mflActionAlert").length,
      };
      showToast("Plan share revoked.");
      await update();
      const after = {
        text: status?.textContent,
        alertCleared: alert?.textContent === "",
        toastText: toast?.textContent,
        toastCount: document.querySelectorAll("#toastMessage").length,
      };
      return {first,duplicate,conflict,urgent,after};
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (evaluated.exceptionDetails) throw new Error("A11Y-04 browser exception: " + JSON.stringify(evaluated.exceptionDetails));
  const result = evaluated.result?.value;
  assert.ok(!result?.error, "A11Y-04 globals: " + JSON.stringify(result));
  assert.deepEqual(result.first, {
    text: "Plan saved.", role: "status", live: "polite", atom: "true",
    hiddenVisualToast: "true", count: 1,
  }, "Saved success must be announced exactly once.");
  assert.equal(result.duplicate, false, "Repeated same-message render must not repeat announcements.");
  assert.equal(result.conflict, true);
  assert.deepEqual(result.urgent, {
    text: "Plan changed elsewhere.", role: "alert", politeCleared: true, count: 1,
  });
  assert.deepEqual(result.after, {
    text: "Plan share revoked.", alertCleared: true, toastText: "Plan share revoked.", toastCount: 1,
  });
  console.log("A11Y-04 hydrated status/alert and toast lifecycle passed: " + new URL(url).pathname);
  return baseline;
}
