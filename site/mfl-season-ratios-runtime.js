(() => {
  const VERSION = "1.119.8";
  const SOURCE_COMMIT = "4cac1ca5b5f48034cdab2b0e2b5e0c1756d37b75";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/mfl-season-ratios-runtime.js`;

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the release runtime (${request.status}).`);
    }

    let source = request.responseText;
    const versionMarker = 'const VERSION = "1.119.33";';
    const tooltipMarker = 'const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 16, so it uses seasons 11-15.";';
    const tooltipReplacement = 'const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of four MFL/USD growth rates: the latest four completed seasons from Supabase plus the current season value.";';
    if (!source.includes(versionMarker) || !source.includes(tooltipMarker)) {
      throw new Error("Could not locate the release runtime markers.");
    }
    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = source.replace(tooltipMarker, tooltipReplacement);
    source = source.replaceAll("mflRelease133RuntimeStyles", "mflRelease1198RuntimeStyles");
    source = source.replaceAll("mflRelease133Ready", "mflRelease1198Ready");
    source += `\n//# sourceURL=mfl-release-runtime-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    console.error(error?.message || "Could not initialize the release runtime.");
  }
})();
