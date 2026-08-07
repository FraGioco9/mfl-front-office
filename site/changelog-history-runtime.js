(() => {
  const releaseVersion = String(window.__mflRelease?.version || window.__mflReleaseVersion || "dev");
  const sourceVersion = "1.120.3";
  const assetUrl = typeof window.__mflAssetUrl === "function"
    ? window.__mflAssetUrl
    : (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;
  const sourceUrl = assetUrl("changelog-history-source-v1.120.3.js");

  fetch(`${sourceUrl}?source=${encodeURIComponent(sourceVersion)}&release=${encodeURIComponent(releaseVersion)}`, {
    cache: "no-store",
    headers: { Accept: "application/javascript" },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load Changelog history (${response.status}).`);
      return response.text();
    })
    .then((originalSource) => {
      const versionMarker = `const VERSION = "${sourceVersion}";`;
      const releasesUrlMarker = "  const RELEASES_URL = `/releases.json?v=${VERSION}`;";
      const normalizedSource = originalSource.replace(/\r\n?/g, "\n");
      if (!normalizedSource.includes(versionMarker) || !normalizedSource.includes(releasesUrlMarker)) {
        throw new Error("Could not locate Changelog runtime markers.");
      }

      let source = normalizedSource.replace(versionMarker, `const VERSION = ${JSON.stringify(releaseVersion)};`);
      source = source.replace(
        releasesUrlMarker,
        `  const RELEASES_URL = ${JSON.stringify(assetUrl("releases.json"))} + \`?v=\${VERSION}\`;`,
      );
      source += `\n//# sourceURL=mfl-changelog-history-v${releaseVersion}.js`;

      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    })
    .catch((error) => {
      console.error(error?.message || "Could not initialize Changelog history.");
    });
})();
