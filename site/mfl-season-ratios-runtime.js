(() => {
  const VERSION = "1.119.48";
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
    if (!source.includes(versionMarker)) {
      throw new Error("Could not locate the release runtime version marker.");
    }
    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = source.replaceAll("mflRelease133RuntimeStyles", "mflRelease148RuntimeStyles");
    source = source.replaceAll("mflRelease133Ready", "mflRelease148Ready");
    source += `\n//# sourceURL=mfl-release-runtime-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    console.error(error?.message || "Could not initialize the release runtime.");
  }
})();