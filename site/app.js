(() => {
  const VERSION = "1.119.34";
  const SOURCE_COMMIT = "4cac1ca5b5f48034cdab2b0e2b5e0c1756d37b75";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;

  function fail(message) {
    console.error(message);
    document.documentElement.classList.remove("bootPending", "loading", "appBusy", "table-layout-pending", "mflInitialChromePreparing");
    document.body?.classList.remove("booting", "loading", "appBusy", "tableLayoutPending");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<p class="emptyState">Could not load MFL Front Office.</p>';
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(`Could not load the application runtime (${request.status}).`);
      return;
    }

    let source = request.responseText;
    const versionMarker = 'const VERSION = "1.119.29";';
    const guardedCapture = 'if (!activeClubId || state.currentPage !== CLUB_PAGE || !state.dataLoaded || !Array.isArray(state.rows)) return;';
    const unguardedCapture = 'if (!activeClubId || state.currentPage !== CLUB_PAGE || !Array.isArray(state.rows)) return;';

    if (!source.includes(versionMarker) || !source.includes(guardedCapture)) {
      fail("Could not locate the native club cache runtime.");
      return;
    }

    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = source.replace(guardedCapture, unguardedCapture);
    source += `\n//# sourceURL=mfl-front-office-loader-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    fail(error?.message || "Could not initialize the application runtime.");
  }
})();
