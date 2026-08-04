(() => {
  const VERSION = "1.120.27";
  const LEGACY_RUNTIME_URL = `/mfl-season-ratios-runtime.js?v=${encodeURIComponent(VERSION)}&source=legacy`;

  try {
    const request = new XMLHttpRequest();
    request.open("GET", LEGACY_RUNTIME_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the stable UI runtime (${request.status}).`);
    }

    let source = request.responseText;
    const versionMarker = 'const VERSION = "1.120.8";';
    const tooltipReplacementMarker = 'const tooltipReplacement = \'const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of four MFL/USD growth rates: the latest four completed seasons from Supabase plus the current season value.";\';';
    const applicationMarker = '    source = source.replace(tooltipMarker, tooltipReplacement);';

    if (!source.includes(versionMarker)
        || !source.includes(tooltipReplacementMarker)
        || !source.includes(applicationMarker)) {
      throw new Error("Could not locate the stable UI runtime markers.");
    }

    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = source.replace(
      tooltipReplacementMarker,
      'const tooltipReplacement = \'const DISCOUNT_TOOLTIP = "";\';',
    );
    source = source.replace(
      applicationMarker,
      `${applicationMarker}
    source = source.replace(
      '      discountTooltip.textContent = String(box.dataset.tooltip || DISCOUNT_TOOLTIP);',
      '      const tooltipText = String(box.dataset.tooltip || "").trim();\\n      if (!tooltipText) return;\\n      discountTooltip.textContent = tooltipText;',
    );
    source = source.replace(
      /  function syncDiscountTooltip\(\) \{[\s\S]*?\n  \}\n\n  function synchronizeReleaseUi/,
      \`  function syncDiscountTooltip() {
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate[data-tooltip]");
    if (!metric || !String(metric.dataset.tooltip || "").trim()) return false;
    ensureDiscountTooltip();
    return true;
  }

  function synchronizeReleaseUi\`,
    );`,
    );
    source += `\n//# sourceURL=mfl-season-ratios-runtime-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    console.error(error?.message || "Could not initialize the Supabase season-ratio UI runtime.");
  }
})();