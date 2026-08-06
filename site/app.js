(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.37");
  const SOURCE_VERSION = "1.120.24";
  const SOURCE_URL = "/app-loader-v1.120.24.js";
  const NESTED_SOURCE_MARKER = "  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;";
  const FINAL_SOURCE_URL = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@dc3265ceb18ee501e6107f3a31869c6500738e92/site/app.js";
  const releaseToken = `${RELEASE_VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.__mflReleaseVersion = RELEASE_VERSION;

  function fail(message) {
    console.error(message);
    document.documentElement.classList.remove(
      "bootPending",
      "loading",
      "appBusy",
      "table-layout-pending",
      "mflInitialChromePreparing",
    );
    document.body?.classList.remove("booting", "loading", "appBusy", "tableLayoutPending");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<p class="emptyState">Could not load MFL Front Office.</p>';
  }

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function openLocalPinnedSource(method, url) {
    const originalUrl = String(url || "");
    const normalizedUrl = originalUrl.split("?")[0];
    const forwardedUrl = normalizedUrl === FINAL_SOURCE_URL
      ? `/app-base-v1.119.29.js?v=${encodeURIComponent(RELEASE_VERSION)}&release=${encodeURIComponent(releaseToken)}`
      : originalUrl;
    return nativeOpen.call(this, method, forwardedUrl, ...Array.prototype.slice.call(arguments, 2));
  };

  try {
    const request = new XMLHttpRequest();
    request.open(
      "GET",
      `${SOURCE_URL}?source=${encodeURIComponent(SOURCE_VERSION)}&release=${encodeURIComponent(releaseToken)}`,
      false,
    );
    request.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
    request.setRequestHeader("Pragma", "no-cache");
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the application runtime (${request.status}).`);
    }

    const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
    if (!request.responseText.includes(versionMarker)
        || !request.responseText.includes(NESTED_SOURCE_MARKER)) {
      throw new Error("Could not locate the local application loader markers.");
    }

    let source = request.responseText.replace(
      versionMarker,
      `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
    );
    source = source.replace(
      NESTED_SOURCE_MARKER,
      `  const SOURCE_URL = "/app-loader-v1.119.29.js?v=${encodeURIComponent(RELEASE_VERSION)}&release=${encodeURIComponent(releaseToken)}";`,
    );
    source += `\n//# sourceURL=mfl-front-office-app-v${RELEASE_VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    fail(error?.message || "Could not initialize the application runtime.");
  } finally {
    XMLHttpRequest.prototype.open = nativeOpen;
  }
})();
