(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.34");
  const SOURCE_VERSION = "1.120.33";
  const SOURCE_COMMIT = "ada70b3e15aeb51c702dfbba1da51b1f17eed74d";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/mfl-season-ratios-runtime-v2.js`;

  window.__mflReleaseVersion = RELEASE_VERSION;
  window.__mflDiscountRateAuthority?.destroy?.();

  function showLoadingRate() {
    if (!/^\/evaluation\/?$/i.test(location.pathname)
        && document.body?.dataset.page !== "evaluation") return;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (value) value.textContent = "-";
    if (advanced) advanced.textContent = "-";
  }

  showLoadingRate();

  fetch(`${SOURCE_URL}?source=${encodeURIComponent(SOURCE_VERSION)}`, {
    cache: "force-cache",
    headers: { Accept: "application/javascript" },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load the Discount Rate runtime (${response.status}).`);
      }
      return response.text();
    })
    .then((originalSource) => {
      const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
      if (!originalSource.includes(versionMarker)) {
        throw new Error("Could not locate the Discount Rate runtime version marker.");
      }

      let source = originalSource.replace(
        versionMarker,
        `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
      );
      source = source.replace(
        'const RELEASE_DESCRIPTION = "Clarify the Evaluation Discount Rate tooltip";',
        'const RELEASE_DESCRIPTION = "Centralize release versioning and prevent legacy footer overrides";',
      );
      source = source.replaceAll("v1.120.33 installs", "v1.120.34 installs");
      source += `\n//# sourceURL=mfl-season-ratios-runtime-v${RELEASE_VERSION}.js`;

      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    })
    .catch((error) => {
      console.error(error?.message || "Could not initialize the Discount Rate runtime.");
      showLoadingRate();
    });
})();
