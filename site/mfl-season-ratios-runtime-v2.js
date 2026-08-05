(() => {
  const VERSION = "1.120.31";
  const STABLE_COMMIT = "dbb5755d036b00e7a4570ddc3cada5584a2cebca";
  const STABLE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${STABLE_COMMIT}/site/mfl-season-ratios-runtime-v2.js?v=1.120.30`;

  if (document.querySelector('script[data-mfl-stable-season-ratios="true"]')) return;

  const script = document.createElement("script");
  script.src = STABLE_URL;
  script.async = true;
  script.dataset.mflStableSeasonRatios = "true";
  script.addEventListener("error", () => {
    console.error("Could not load the stable Evaluation Discount Rate runtime.");
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (value) value.textContent = "-";
    if (advanced) advanced.textContent = "-";
  }, { once: true });
  document.head.appendChild(script);

  window.__mflDiscountRateRuntimeVersion = VERSION;
})();
