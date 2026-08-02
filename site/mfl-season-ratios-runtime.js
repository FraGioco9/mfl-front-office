(() => {
  const VERSION = "1.119.35";
  const SOURCE_COMMIT = "55acaf30f69b393f70dc52dbdc7ce9802619f065";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/mfl-season-ratios-runtime.js`;

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the release runtime (${request.status}).`);
    }

    let source = request.responseText;
    const marker = 'const VERSION = "1.119.34";';
    if (!source.includes(marker)) {
      throw new Error("Could not locate the release runtime version marker.");
    }
    source = source.replace(marker, `const VERSION = "${VERSION}";`);
    source = source.replaceAll("mflRelease134RuntimeStyles", "mflRelease135RuntimeStyles");
    source = source.replaceAll("mflRelease134Ready", "mflRelease135Ready");
    source += `\n//# sourceURL=mfl-release-runtime-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    console.error(error?.message || "Could not initialize the release runtime.");
  }
})();
