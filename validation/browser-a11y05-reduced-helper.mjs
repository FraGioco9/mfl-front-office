import assert from "node:assert/strict";

export async function auditReducedMotion(cdp, url, baseline) {
  assert.equal(baseline?.status, "passed", "A11Y-05 requires the canonical hydrated browser route to pass first.");
  const run = async expression => {
    const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error("A11Y-05 browser execution failed: " + JSON.stringify(response.exceptionDetails));
    return response.result?.value;
  };
  const runCase = async preference => {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: preference }],
    });
    return run(`(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const id = "mflA11Y05Probe";
      document.getElementById(id)?.remove();
      const probe = document.createElement("div");
      probe.id = id;
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:200px;pointer-events:none";
      probe.innerHTML = [
        '<div class="buttonGear">gear</div>',
        '<div class="mflStatsHistogramFill" style="--bar-height:50%">bar</div>',
        '<div class="toastMessage visible">toast</div>',
        '<div class="selectionBar mflSelectionActionDismissed">selected</div>',
        '<div class="modalBackdrop modalOpen"><section>dialog</section></div>',
        '<span data-tooltip="tip">tooltip</span>',
        '<div class="plannerFormationSlotButton"><div class="plannerFormationToken">slot</div></div>',
      ].join("");
      document.body.appendChild(probe);
      const style = selector => getComputedStyle(probe.querySelector(selector));
      const result = {
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        standardToken: getComputedStyle(document.documentElement).getPropertyValue("--mfl-motion-standard").trim(),
        spinner: style(".buttonGear").animationName,
        histogram: style(".mflStatsHistogramFill").animationName,
        histogramHeight: style(".mflStatsHistogramFill").height,
        toastDuration: style(".toastMessage").transitionDuration,
        toastTransform: style(".toastMessage").transform,
        selectionDuration: style(".selectionBar").transitionDuration,
        selectionExit: style(".selectionBar").getPropertyValue("--mfl-selection-exit-y").trim(),
        modalTransform: style(".modalBackdrop > section").transform,
        tooltipDuration: getComputedStyle(probe.querySelector("[data-tooltip]"), "::after").transitionDuration,
        plannerDuration: style(".plannerFormationToken").transitionDuration,
      };
      probe.remove();
      return result;
    })()`);
  };
  const normal = await runCase("no-preference");
  const reduced = await runCase("reduce");
  assert.equal(normal.reduced, false);
  assert.equal(normal.standardToken, "180ms");
  assert.equal(normal.spinner, "spin");
  assert.equal(normal.histogram, "mflStatsBarRise");
  assert.ok(normal.toastDuration.includes("0.18s"), "Normal toast must preserve its entrance transition.");
  assert.ok(normal.plannerDuration.includes("0.18s"), "Normal Planner pitch border hover must preserve transition.");
  assert.equal(reduced.reduced, true);
  assert.equal(reduced.standardToken, "0ms");
  assert.equal(reduced.spinner, "none");
  assert.equal(reduced.histogram, "none");
  assert.equal(reduced.toastTransform, "none");
  assert.ok(reduced.toastDuration.split(",").every(x => Number.parseFloat(x) === 0));
  assert.ok(reduced.selectionDuration.split(",").every(x => Number.parseFloat(x) === 0));
  assert.equal(reduced.selectionExit, "0px");
  assert.equal(reduced.modalTransform, "none");
  assert.ok(reduced.tooltipDuration.split(",").every(x => Number.parseFloat(x) === 0));
  assert.ok(reduced.plannerDuration.split(",").every(x => Number.parseFloat(x) === 0));
  console.log("A11Y-05 Chromium motion: " + JSON.stringify({ route: new URL(url).pathname, normal, reduced }));
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  return baseline;
}
