(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.36");
  const SOURCE_VERSION = "1.120.33";
  const SOURCE_URL = "/mfl-season-ratios-source-v1.120.33.js";
  const STABLE_SOURCE_MARKER = "  const STABLE_RUNTIME_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${STABLE_COMMIT}/site/mfl-season-ratios-runtime-v2.js?v=1.120.30`;";
  const releaseToken = `${RELEASE_VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

  fetch(
    `${SOURCE_URL}?source=${encodeURIComponent(SOURCE_VERSION)}&release=${encodeURIComponent(releaseToken)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/javascript",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load the Discount Rate runtime (${response.status}).`);
      }
      return response.text();
    })
    .then((originalSource) => {
      const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
      if (!originalSource.includes(versionMarker)
          || !originalSource.includes(STABLE_SOURCE_MARKER)) {
        throw new Error("Could not locate the Discount Rate runtime markers.");
      }

      let source = originalSource.replace(
        versionMarker,
        `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
      );
      source = source.replace(
        STABLE_SOURCE_MARKER,
        `  const STABLE_RUNTIME_URL = "/mfl-season-ratios-stable-ui-v1.120.30.js?v=${encodeURIComponent(RELEASE_VERSION)}&release=${encodeURIComponent(releaseToken)}";`,
      );
      source = source.replace(
        'const RELEASE_DESCRIPTION = "Clarify the Evaluation Discount Rate tooltip";',
        'const RELEASE_DESCRIPTION = "Remove remaining first-paint version conflicts and restore Evaluation loading";',
      );
      source = source.replaceAll("v1.120.33 installs", `v${RELEASE_VERSION} installs`);
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
