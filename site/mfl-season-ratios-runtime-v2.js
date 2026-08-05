(() => {
  const VERSION = "1.120.31";
  const BASE_COMMIT = "dbb5755d036b00e7a4570ddc3cada5584a2cebca";
  const BASE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${BASE_COMMIT}/site/mfl-season-ratios-runtime-v2.js`;
  const AUTHORITY_URL = `/discount-rate-authority-v1-120-31.js?v=${encodeURIComponent(VERSION)}&fresh=${Date.now()}`;

  window.__mflDiscountRateAuthority?.destroy?.();
  try { delete window.__mflSeasonRatioResult; } catch {}
  try { delete window.__mflDynamicDiscountResult; } catch {}
  window.mflSeasonRatios = [];
  window.__mflDiscountRateRuntimeVersion = VERSION;

  function execute(source, sourceUrl) {
    const script = document.createElement("script");
    script.textContent = `${source}\n//# sourceURL=${sourceUrl}`;
    document.head.appendChild(script);
  }

  function loadStableUi() {
    const request = new XMLHttpRequest();
    request.open("GET", `${BASE_URL}?base=${encodeURIComponent(VERSION)}`, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the stable Evaluation runtime (${request.status}).`);
    }

    let source = request.responseText;
    const versionMarker = 'const VERSION = "1.120.30";';
    const authorityMarker = "  installDiscountRateAuthority();";
    if (!source.includes(versionMarker) || !source.includes(authorityMarker)) {
      throw new Error("Could not locate the stable Evaluation runtime markers.");
    }

    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = source.replace(authorityMarker, "  // Discount Rate authority is loaded separately from a fresh same-origin file.");
    execute(source, `mfl-season-ratios-stable-ui-v${VERSION}.js`);
  }

  function loadFreshAuthority() {
    const request = new XMLHttpRequest();
    request.open("GET", AUTHORITY_URL, false);
    request.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
    request.setRequestHeader("Pragma", "no-cache");
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the fresh Discount Rate authority (${request.status}).`);
    }
    execute(request.responseText, `discount-rate-authority-v${VERSION}.js`);
  }

  try {
    loadStableUi();
    loadFreshAuthority();
  } catch (error) {
    console.error(error?.message || "Could not initialize the Evaluation Discount Rate runtime.");
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (value) value.textContent = "-";
    if (advanced) advanced.textContent = "-";
  }
})();
