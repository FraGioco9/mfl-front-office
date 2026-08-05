(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.34");
  const SOURCE_VERSION = "1.120.3";
  const SOURCE_COMMIT = "ada70b3e15aeb51c702dfbba1da51b1f17eed74d";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/changelog-history-runtime.js`;
  const CURRENT_RELEASES = [
    ["v1.120.34", "Centralize release versioning and prevent legacy footer overrides"],
    ["v1.120.33", "Clarify the Evaluation Discount Rate tooltip"],
    ["v1.120.32", "Recalculate the Evaluation Discount Rate from a fresh request on every load"],
    ["v1.120.31", "Refresh the Evaluation Discount Rate from live season ratios"],
    ["v1.120.30", "Restore stable site loading after Discount Rate changes"],
  ];

  window.__mflReleaseVersion = RELEASE_VERSION;

  try {
    const request = new XMLHttpRequest();
    request.open("GET", `${SOURCE_URL}?source=${encodeURIComponent(SOURCE_VERSION)}`, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the Changelog history runtime (${request.status}).`);
    }

    const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
    const releasesMarker = "  const CURRENT_RELEASES = [";
    if (!request.responseText.includes(versionMarker)
        || !request.responseText.includes(releasesMarker)) {
      throw new Error("Could not locate the Changelog history version markers.");
    }

    let source = request.responseText.replace(
      versionMarker,
      `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
    );
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
  } catch (error) {
    console.error(error?.message || "Could not initialize Changelog history.");
  }
})();
