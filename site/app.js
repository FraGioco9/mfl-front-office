(() => {
  const RELEASE_VERSION = "1.120.47";
  const SOURCE_VERSION = "1.120.24";
  const scriptUrl = document.currentScript?.src || new URL("app.js", window.location.href).href;
  const assetBaseUrl = new URL(".", scriptUrl);
  const assetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), assetBaseUrl).href;
  const releaseToken = `${RELEASE_VERSION}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.__mflReleaseVersion = RELEASE_VERSION;

  function fail(message) {
    const detail = String(message || "Could not initialize the application runtime.");
    console.error(detail);
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
    if (main) {
      main.replaceChildren();
      const state = document.createElement("p");
      state.className = "emptyState";
      state.textContent = "Could not load MFL Front Office.";
      const error = document.createElement("p");
      error.className = "emptyState";
      error.style.fontSize = "12px";
      error.style.opacity = "0.7";
      error.textContent = detail;
      main.append(state, error);
    }
  }

  async function loadText(path, label) {
    const response = await fetch(
      `${assetUrl(path)}?v=${encodeURIComponent(RELEASE_VERSION)}&release=${encodeURIComponent(releaseToken)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/javascript,text/plain;q=0.9,*/*;q=0.8",
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
    if (!response.ok) throw new Error(`Could not load ${label} (${response.status}).`);
    const text = await response.text();
    if (!text) throw new Error(`Could not load ${label} (empty response).`);
    return text.replace(/\r\n?/g, "\n");
  }

  function replaceRequired(source, marker, replacement, label) {
    if (!source.includes(marker)) throw new Error(`Could not locate ${label}.`);
    return source.replace(marker, replacement);
  }

  function exposeLoaderError(source) {
    const marker = 'if (main) main.innerHTML = \'<p class="emptyState">Could not load MFL Front Office.</p>\';';
    const replacement = `if (main) {
      main.replaceChildren();
      const state = document.createElement("p");
      state.className = "emptyState";
      state.textContent = "Could not load MFL Front Office.";
      const error = document.createElement("p");
      error.className = "emptyState";
      error.style.fontSize = "12px";
      error.style.opacity = "0.7";
      error.textContent = String(message || "Unknown startup error.");
      main.append(state, error);
    }`;
    return source.includes(marker) ? source.replace(marker, replacement) : source;
  }

  function patchBoundedStartupWaits(source) {
    const fontMarker = `      await document.fonts?.ready?.catch(() => undefined);`;
    const fontReplacement = `      await Promise.race([
        document.fonts?.ready?.catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);`;
    const preferencesMarker = `    await loadWalletPreferences();`;
    const preferencesReplacement = `    await Promise.race([
      loadWalletPreferences(),
      new Promise((resolve) => window.setTimeout(resolve, 5000)),
    ]);`;

    let patched = replaceRequired(
      source,
      fontMarker,
      fontReplacement,
      "the initial font wait",
    );
    patched = replaceRequired(
      patched,
      preferencesMarker,
      preferencesReplacement,
      "the initial wallet preference wait",
    );
    return patched;
  }

  async function start() {
    const [
      originalLoaderSource,
      originalLoaderBaseSource,
      appBaseSource,
      evaluationRuntimeSource,
    ] = await Promise.all([
      loadText("app-loader.js", "the application loader"),
      loadText("app-loader-base.js", "the base application loader"),
      loadText("app-base.js", "the application source"),
      loadText("evaluation-route-stability-runtime.js", "the Evaluation stability runtime"),
    ]);

    const loaderBaseRequestMarker = `    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(\`Could not load the pinned application source (\${request.status}).\`);
      return;
    }

    const source = request.responseText;`;
    const loaderBaseRequestReplacement = `    const source = String(window.__mflPreloadedAppBaseSource || "");
    if (!source) {
      fail("Could not load the preloaded application source.");
      return;
    }`;

    const loaderRequestMarker = `    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(\`Could not load the application runtime (\${request.status}).\`);
      return;
    }

    let source = request.responseText;`;
    const loaderRequestReplacement = `    let source = String(window.__mflPreloadedLoaderBaseSource || "");
    if (!source) {
      fail("Could not load the preloaded application runtime.");
      return;
    }`;

    let loaderBaseSource = replaceRequired(
      originalLoaderBaseSource,
      loaderBaseRequestMarker,
      loaderBaseRequestReplacement,
      "the base loader source request",
    );
    loaderBaseSource = patchBoundedStartupWaits(loaderBaseSource);
    loaderBaseSource = exposeLoaderError(loaderBaseSource);

    let loaderSource = replaceRequired(
      originalLoaderSource,
      loaderRequestMarker,
      loaderRequestReplacement,
      "the loader source request",
    );
    const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
    loaderSource = replaceRequired(
      loaderSource,
      versionMarker,
      `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
      "the application loader version marker",
    );
    loaderSource = exposeLoaderError(loaderSource);
    loaderSource += `\n//# sourceURL=mfl-front-office-app-v${RELEASE_VERSION}.js`;

    window.__mflPreloadedAppBaseSource = appBaseSource;
    window.__mflPreloadedLoaderBaseSource = loaderBaseSource;

    const application = document.createElement("script");
    application.textContent = loaderSource;
    document.head.appendChild(application);

    const runtime = document.createElement("script");
    runtime.textContent = `${evaluationRuntimeSource}\n//# sourceURL=mfl-evaluation-route-stability-v${RELEASE_VERSION}.js`;
    document.head.appendChild(runtime);

    delete window.__mflPreloadedAppBaseSource;
    delete window.__mflPreloadedLoaderBaseSource;
  }

  window.__mflApplicationReady = start()
    .then(() => true)
    .catch((error) => {
      fail(error?.message || error);
      return false;
    });
})();
