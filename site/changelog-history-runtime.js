(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.40");
  const SOURCE_VERSION = "1.120.3";
  const assetUrl = typeof window.__mflAssetUrl === "function"
    ? window.__mflAssetUrl
    : (path) => new URL(String(path || "").replace(/^\/+/, ""), window.location.origin + "/").href;
  const SOURCE_URL = assetUrl("changelog-history-source-v1.120.3.js");
  const releaseToken = `${RELEASE_VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const CURRENT_RELEASES = [
    ["v1.120.40", "Support Windows line endings in the local startup chain"],
    ["v1.120.39", "Use one stable asynchronous startup chain locally and on Vercel"],
    ["v1.120.38", "Stabilize Evaluation loading, first-paint MFL views, and Database Stats animations"],
    ["v1.120.37", "Restore static startup content, full MFL Stats, and the live Discount Rate"],
    ["v1.120.36", "Remove remaining first-paint version conflicts and restore Evaluation loading"],
    ["v1.120.35", "Remove legacy version conflicts and restore the Evaluation Discount Rate tooltip"],
    ["v1.120.34", "Centralize release versioning and prevent legacy footer overrides"],
    ["v1.120.33", "Clarify the Evaluation Discount Rate tooltip"],
    ["v1.120.32", "Recalculate the Evaluation Discount Rate from a fresh request on every load"],
    ["v1.120.31", "Refresh the Evaluation Discount Rate from live season ratios"],
    ["v1.120.30", "Restore stable site loading after Discount Rate changes"],
  ];

  window.__mflReleaseVersion = RELEASE_VERSION;

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
        throw new Error(`Could not load the Changelog history runtime (${response.status}).`);
      }
      return response.text();
    })
    .then((originalSource) => {
      const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
      const releasesUrlMarker = "  const RELEASES_URL = `/releases.json?v=${VERSION}`;";
      const releasesMarker = "  const CURRENT_RELEASES = [";
      const expandedStateMarker = `  const previous = window.__mflChangelogHistoryRuntime;
  const expandedMinors = new Set();

  document.querySelectorAll(".changelogMinorSection.is-expanded .changelogMinorVersion").forEach((label) => {
    const minor = String(label.textContent || "").trim().replace(/^v/, "");
    if (minor) expandedMinors.add(minor);
  });`;
      const expandedStateReplacement = `  const previous = window.__mflChangelogHistoryRuntime;
  const expandedMinors = new Set();`;
      const normalizedSource = originalSource.replace(/\r\n?/g, "\n");
      if (!normalizedSource.includes(versionMarker)
          || !normalizedSource.includes(releasesUrlMarker)
          || !normalizedSource.includes(releasesMarker)
          || !normalizedSource.includes(expandedStateMarker)) {
        throw new Error("Could not locate the Changelog history release markers.");
      }

      let source = normalizedSource.replace(
        versionMarker,
        `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
      );
      source = source.replace(
        releasesUrlMarker,
        `  const RELEASES_URL = ${JSON.stringify(assetUrl("releases.json"))} + \`?v=\${VERSION}&release=\${Date.now()}\`;`,
      );
      source = source.replace(expandedStateMarker, expandedStateReplacement);
      source = source.replace(
        releasesMarker,
        `  const CURRENT_RELEASES = ${JSON.stringify(CURRENT_RELEASES)}.concat([`,
      );
      source = source.replace(
        "  ];\n\n  const previous = window.__mflChangelogHistoryRuntime;",
        "  ]);\n\n  const previous = window.__mflChangelogHistoryRuntime;",
      );
      source += `\n//# sourceURL=mfl-changelog-history-v${RELEASE_VERSION}.js`;

      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    })
    .catch((error) => {
      console.error(error?.message || "Could not initialize Changelog history.");
    });
})();
