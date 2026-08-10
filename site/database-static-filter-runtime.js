(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.26");
  const previous = window.__mflDatabaseStaticFilterRuntime;
  previous?.destroy?.();

  let destroyed = false;

  function isDatabaseTableRoute(pathname = window.location.pathname) {
    const path = String(pathname || "/").replace(/\/+$/, "") || "/";
    return /^\/database(?:\/(?:attributes|contracts))?$/i.test(path);
  }

  function sync() {
    if (destroyed) return;
    const filter = document.getElementById("hideMflPlayersFilter");
    if (!(filter instanceof HTMLElement)) return;

    const visible = isDatabaseTableRoute();
    filter.hidden = !visible;
    if (visible) filter.removeAttribute("aria-hidden");
    else filter.setAttribute("aria-hidden", "true");
  }

  function onNavigation() {
    sync();
  }

  window.addEventListener("popstate", onNavigation);
  sync();

  function destroy() {
    destroyed = true;
    window.removeEventListener("popstate", onNavigation);
  }

  window.__mflDatabaseStaticFilterRuntime = Object.freeze({
    version: VERSION,
    sync,
    destroy,
  });
})();
