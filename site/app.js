(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "1.120.35");
  const SOURCE_VERSION = "1.120.24";
  const SOURCE_COMMIT = "ada70b3e15aeb51c702dfbba1da51b1f17eed74d";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;

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

  try {
    const request = new XMLHttpRequest();
    request.open("GET", `${SOURCE_URL}?source=${encodeURIComponent(SOURCE_VERSION)}`, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load the application runtime (${request.status}).`);
    }

    const versionMarker = `const VERSION = "${SOURCE_VERSION}";`;
    if (!request.responseText.includes(versionMarker)) {
      throw new Error("Could not locate the application loader version marker.");
    }

    const source = request.responseText.replace(
      versionMarker,
      `const VERSION = ${JSON.stringify(RELEASE_VERSION)};`,
    ) + `\n//# sourceURL=mfl-front-office-app-v${RELEASE_VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    fail(error?.message || "Could not initialize the application runtime.");
  }
})();
