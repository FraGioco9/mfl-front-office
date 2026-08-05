(() => {
  const FEATURE_VERSION = "1.120.26";
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.36");
  const SOURCE_URL = "/selection-stack-source-v1.120.26.js";
  const releaseToken = `${RELEASE_VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.__mflReleaseVersion = RELEASE_VERSION;

  fetch(
    `${SOURCE_URL}?feature=${encodeURIComponent(FEATURE_VERSION)}&release=${encodeURIComponent(releaseToken)}`,
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
        throw new Error(`Could not load the Selection Stack runtime (${response.status}).`);
      }
      return response.text();
    })
    .then((originalSource) => {
      const versionMarker = `const VERSION = "${FEATURE_VERSION}";`;
      const footerTextMarker = "    const text = `MFL Front Office v${VERSION}`;";
      const footerCheckMarker = "        && footer.dataset.releaseVersion === VERSION";
      const footerAssignmentMarker = "    footer.dataset.releaseVersion = VERSION;";
      if (!originalSource.includes(versionMarker)
          || !originalSource.includes(footerTextMarker)
          || !originalSource.includes(footerCheckMarker)
          || !originalSource.includes(footerAssignmentMarker)) {
        throw new Error("Could not locate the Selection Stack release markers.");
      }

      let source = originalSource.replace(
        versionMarker,
        `const VERSION = ${JSON.stringify(FEATURE_VERSION)};\n  const RELEASE_VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
      );
      source = source
        .replace(footerTextMarker, "    const text = `MFL Front Office v${RELEASE_VERSION}`;")
        .replace(footerCheckMarker, "        && footer.dataset.releaseVersion === RELEASE_VERSION")
        .replace(footerAssignmentMarker, "    footer.dataset.releaseVersion = RELEASE_VERSION;");
      source += `\n//# sourceURL=mfl-selection-stack-v${FEATURE_VERSION}-release-${RELEASE_VERSION}.js`;

      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    })
    .catch((error) => {
      console.error(error?.message || "Could not initialize the Selection Stack runtime.");
    });
})();
