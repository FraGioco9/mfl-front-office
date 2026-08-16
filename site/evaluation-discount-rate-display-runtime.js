(() => {
  "use strict";

  window.__mflEvaluationDiscountRateDisplayRuntime?.destroy?.();

  // Compatibility hook only. The live discount-rate runtime owns the value and
  // publishes it once per state change; no DOM repair observer is allowed here.
  window.__mflEvaluationDiscountRateDisplayRuntime = Object.freeze({
    sync() {},
    destroy() {},
  });
})();
