(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.34");
  const FEATURE_VERSION = "1.120.10";
  const SOURCE_COMMIT = "ada70b3e15aeb51c702dfbba1da51b1f17eed74d";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/v1-120-10-runtime.js`;

  window.__mflReleaseVersion = RELEASE_VERSION;

  fetch(`${SOURCE_URL}?feature=${encodeURIComponent(FEATURE_VERSION)}`, {
    cache: "force-cache",
    headers: { Accept: "application/javascript" },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load the v${FEATURE_VERSION} compatibility runtime (${response.status}).`);
      }
      return response.text();
    })
    .then((originalSource) => {
      const versionMarker = `const VERSION = "${FEATURE_VERSION}";`;
      if (!originalSource.includes(versionMarker)) {
        throw new Error("Could not locate the legacy runtime version marker.");
      }

      let source = originalSource.replace(
        versionMarker,
        `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
      );
      source = source.replace(
        "  safelyDestroy(window.__mflReleaseUiRuntime);\n",
        "",
      );
      source += `\n//# sourceURL=mfl-v1-120-10-compat-v${RELEASE_VERSION}.js`;

      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    })
    .catch((error) => {
      console.error(error?.message || "Could not initialize the v1.120.10 compatibility runtime.");
    });
})();
