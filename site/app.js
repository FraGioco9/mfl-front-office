(() => {
  const VERSION = "1.119.43";
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

  function patchClubViewCache(source) {
    const guardedCapture = 'if (!activeClubId || state.currentPage !== CLUB_PAGE || !state.dataLoaded || !Array.isArray(state.rows)) return;';
    const accessAwarePayloadKey = 'return String(route.clubId) + ":" + String(route.view) + ":" + String(route.access || "public");';
    const accessAwareRenderKey = /function clubViewRenderCacheKey\(clubId = activeClubId, view = state\.view, access = ""\) \{[\s\S]*?return String\(clubId \|\| ""\) \+ ":" \+ String\(view \|\| "attributes"\) \+ ":" \+ String\(resolvedAccess\);\n  \}/;
    const captureRoute = `    const route = typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view })
      : null;
    if (!route) return;`;
    const stableCaptureRoute = `    const route = (typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view })
      : null) || {
      pageName: CLUB_PAGE,
      scope: CLUB_PAGE,
      view,
      clubId: activeClubId,
      access: "public",
    };`;
    const restoreHeader = `  function restoreCachedClubView(view) {
    if (typeof incrementalRouteTarget !== "function"
      || typeof cachedClubViewPayload !== "function"
      || typeof applyIncrementalPayload !== "function") return false;
    const route = incrementalRouteTarget("club", { view });
    if (!route) return false;`;
    const stableRestoreHeader = `  function restoreCachedClubView(view) {
    if (typeof cachedClubViewPayload !== "function"
      || typeof applyIncrementalPayload !== "function") return false;
    const route = (typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view })
      : null) || {
      pageName: CLUB_PAGE,
      scope: CLUB_PAGE,
      view,
      clubId: activeClubId,
      access: "public",
    };`;
    const captureBeforeFinish = `        captureClubView(nextView);
      } finally {
        await finishClubSwitch();
      }`;
    const captureAfterFinish = `      } finally {
        await finishClubSwitch();
        captureClubView(nextView);
      }`;

    let patched = source;
    let changes = 0;

    if (patched.includes(guardedCapture)) {
      patched = patched.replace(
        guardedCapture,
        'if (!activeClubId || state.currentPage !== CLUB_PAGE || !Array.isArray(state.rows)) return;',
      );
      changes += 1;
    }

    if (patched.includes(accessAwarePayloadKey)) {
      patched = patched.replace(
        accessAwarePayloadKey,
        'return String(route.clubId) + ":" + String(route.view);',
      );
      changes += 1;
    }

    if (accessAwareRenderKey.test(patched)) {
      patched = patched.replace(
        accessAwareRenderKey,
        `function clubViewRenderCacheKey(clubId = activeClubId, view = state.view) {
    return String(clubId || "") + ":" + String(view || "attributes");
  }`,
      );
      changes += 1;
    }

    if (patched.includes("clubViewRenderCacheKey(activeClubId, view, route.access)")) {
      patched = patched.replaceAll(
        "clubViewRenderCacheKey(activeClubId, view, route.access)",
        "clubViewRenderCacheKey(activeClubId, view)",
      );
      changes += 1;
    }

    if (patched.includes(captureRoute)) {
      patched = patched.replace(captureRoute, stableCaptureRoute);
      changes += 1;
    }

    if (patched.includes(restoreHeader)) {
      patched = patched.replace(restoreHeader, stableRestoreHeader);
      changes += 1;
    }

    if (patched.includes(captureBeforeFinish)) {
      patched = patched.replace(captureBeforeFinish, captureAfterFinish);
      changes += 1;
    }

    if (changes < 5) {
      console.warn(`Applied ${changes} club view cache patches; some optional markers were not present.`);
    }
    return patched;
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
    if (!source.includes(versionMarker)) {
      fail("Could not locate the application runtime version marker.");
      return;
    }

    source = source.replace(versionMarker, `const VERSION = "${VERSION}";`);
    source = patchClubViewCache(source);
    source += `\n//# sourceURL=mfl-front-office-loader-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  } catch (error) {
    fail(error?.message || "Could not initialize the application runtime.");
  }
})();
