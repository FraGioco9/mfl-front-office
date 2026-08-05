(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.120.34");
  window.__mflReleaseVersion = VERSION;

  if (window.__mflDiscountRateRuntimeVersion === VERSION
      && window.__mflDiscountRateAuthority?.version === VERSION) {
    window.__mflDiscountRateAuthority.sync?.();
    return;
  }

  const runtimeId = "mflSeasonRatiosRuntimeV2";
  document.getElementById(runtimeId)?.remove();

  const runtime = document.createElement("script");
  runtime.id = runtimeId;
  runtime.dataset.version = VERSION;
  runtime.src = "/mfl-season-ratios-runtime-v2.js?v="
    + encodeURIComponent(VERSION)
    + "&fresh="
    + Date.now();
  runtime.async = true;
  runtime.addEventListener("error", () => {
    console.error("Could not load the current Evaluation Discount Rate runtime.");
  }, { once: true });
  document.head.appendChild(runtime);

  window.__mflLegacySeasonRatiosRedirect = { version: VERSION };
})();
