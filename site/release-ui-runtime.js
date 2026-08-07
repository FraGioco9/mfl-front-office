(() => {
  const VERSION = String(window.__mflRelease?.version || window.__mflReleaseVersion || "dev");
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage";
  const STATS_PATH = /^\/database\/stats\/?$/i;

  window.__mflReleaseUiRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  let interval = 0;

  function installFirstPaintGuards() {
    if (document.getElementById("mflReleaseFirstPaintGuards")) return;
    const style = document.createElement("style");
    style.id = "mflReleaseFirstPaintGuards";
    style.textContent = `
      html[data-stored-progression-access="true"]:not([data-mfl-ready="true"]) #homeOptInButton,
      html[data-stored-progression-access="true"]:not([data-mfl-ready="true"]) #myPlayersOptInButton {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function setImportant(element, property, value) {
    if (!(element instanceof HTMLElement)) return;
    if (element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  }

  function visible(element) {
    if (!(element instanceof HTMLElement) || element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;

    let link = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(link instanceof HTMLAnchorElement)) {
      link = document.createElement("a");
      footer.prepend(link);
    }

    const text = `MFL Front Office v${VERSION}`;
    link.hidden = false;
    link.removeAttribute("aria-hidden");
    link.setAttribute("href", "/changelog");
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
    setImportant(link, "display", "inline-block");
    setImportant(link, "visibility", "visible");
    setImportant(link, "opacity", "1");
  }

  function selectionBottom() {
    const footer = document.querySelector(".siteFooter");
    if (!visible(footer)) return 12;
    return Math.max(12, Math.ceil(innerHeight - footer.getBoundingClientRect().top + 12));
  }

  function syncSelectionBar() {
    const bar = document.querySelector("#selectionBar");
    const main = document.querySelector("#appShell main, main");
    if (!(bar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

    if (bar.parentElement !== main) main.appendChild(bar);
    const mainRect = main.getBoundingClientRect();
    const bottom = selectionBottom();
    setImportant(bar, "position", "fixed");
    setImportant(bar, "left", `${Math.round(mainRect.left + mainRect.width / 2)}px`);
    setImportant(bar, "right", "auto");
    setImportant(bar, "bottom", `${bottom}px`);
    setImportant(bar, "transform", "translateX(-50%)");
    setImportant(bar, "z-index", "2147483500");
    document.documentElement.style.setProperty("--mfl-selection-bar-bottom", `${bottom}px`);
  }

  function syncToasts() {
    const bar = document.querySelector("#selectionBar");
    const bottom = visible(bar)
      ? Math.max(12, Math.ceil(innerHeight - bar.getBoundingClientRect().top + 12))
      : 88;
    const value = `${bottom}px`;
    document.documentElement.style.setProperty("--mfl-toast-bottom", value);
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      setImportant(toast, "position", "fixed");
      setImportant(toast, "bottom", value);
      setImportant(toast, "z-index", "2147483635");
    });
  }

  function syncStatsChrome() {
    if (!STATS_PATH.test(location.pathname)) return;
    document.body.dataset.page = "databasestats";
    document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const allowed = ["attributes", "contracts", "stats"].includes(button.dataset.view);
      const active = button.dataset.view === "stats";
      button.hidden = !allowed;
      button.removeAttribute("aria-hidden");
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    window.__mflDatabaseStatsRuntime?.sync?.();
    const page = document.querySelector("#databaseStatsPage");
    if (!(page instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (candidate instanceof HTMLElement) candidate.hidden = candidate !== page;
    });
    page.hidden = false;
    page.removeAttribute("aria-hidden");
  }

  function sync() {
    frame = 0;
    installFirstPaintGuards();
    syncFooter();
    syncSelectionBar();
    syncToasts();
    syncStatsChrome();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  installFirstPaintGuards();
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["class", "hidden", "style", "data-page", "aria-hidden"],
  });
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("popstate", schedule);
  interval = window.setInterval(schedule, 250);
  sync();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    if (interval) clearInterval(interval);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("popstate", schedule);
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
    document.getElementById("mflReleaseFirstPaintGuards")?.remove();
  }

  window.__mflReleaseUiRuntime = { version: VERSION, sync: schedule, destroy };
})();
