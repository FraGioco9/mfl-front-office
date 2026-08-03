(() => {
  const VERSION = "1.120.6";
  const DEFAULT_TOAST_BOTTOM = 88;
  const TOAST_GAP = 12;
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage";
  const STYLE_TEXT = `
    .siteFooter,
    .siteFooter a[href="/changelog"],
    .siteFooter a[data-page="changelog"] {
      visibility: visible !important;
      opacity: 1 !important;
    }
    .siteFooter a::before {
      content: none !important;
      display: none !important;
    }
    ${TOAST_SELECTOR} {
      position: fixed !important;
      z-index: 2147483635 !important;
    }
  `;

  window.__mflReleaseUiRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  let interval = 0;

  function ensureStyles() {
    let style = document.getElementById("mflReleaseUiStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflReleaseUiStyles";
      document.head.appendChild(style);
    }
    if (style.textContent !== STYLE_TEXT) style.textContent = STYLE_TEXT;
  }

  function setImportantStyle(element, property, value) {
    if (element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!(footer instanceof HTMLElement)) return;

    let target = footer.querySelector('a[href="/changelog"], a[data-page="changelog"]');
    if (!(target instanceof HTMLAnchorElement)) {
      target = document.createElement("a");
      footer.prepend(target);
    }

    const text = `MFL Front Office v${VERSION}`;
    target.hidden = false;
    target.removeAttribute("aria-hidden");
    setImportantStyle(target, "display", "inline-block");
    setImportantStyle(target, "visibility", "visible");
    setImportantStyle(target, "opacity", "1");
    if (target.textContent !== text) target.textContent = text;
    if (target.getAttribute("href") !== "/changelog") target.setAttribute("href", "/changelog");
    if (target.dataset.page !== "changelog") target.dataset.page = "changelog";
    if (target.dataset.releaseLabel !== text) target.dataset.releaseLabel = text;
    const ariaLabel = `${text}, open Changelog`;
    if (target.getAttribute("aria-label") !== ariaLabel) target.setAttribute("aria-label", ariaLabel);
    if (footer.dataset.releaseVersion !== VERSION) footer.dataset.releaseVersion = VERSION;
  }

  function selectionBarIsVisible(bar) {
    if (!(bar instanceof HTMLElement) || bar.hidden) return false;
    if (!bar.classList.contains("visible") && !bar.classList.contains("is-visible")) return false;
    const style = getComputedStyle(bar);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = bar.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function toastBottom() {
    const bar = document.querySelector("#selectionBar");
    if (!selectionBarIsVisible(bar)) return DEFAULT_TOAST_BOTTOM;
    const rect = bar.getBoundingClientRect();
    return Math.max(DEFAULT_TOAST_BOTTOM, Math.ceil(innerHeight - rect.top + TOAST_GAP));
  }

  function syncToastPosition() {
    const bottom = toastBottom();
    const value = `${bottom}px`;
    if (document.documentElement.style.getPropertyValue("--mfl-toast-bottom") !== value) {
      document.documentElement.style.setProperty("--mfl-toast-bottom", value);
    }
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      setImportantStyle(toast, "position", "fixed");
      setImportantStyle(toast, "bottom", value);
      setImportantStyle(toast, "z-index", "2147483635");
    });
  }

  function syncDatabaseStatsRoute() {
    if (!/^\/database\/stats\/?$/i.test(location.pathname)) return;
    window.__mflDatabaseStatsRuntime?.sync?.();

    const page = document.querySelector("#databaseStatsPage");
    if (!(page instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const shouldHide = candidate !== page;
      if (candidate.hidden !== shouldHide) candidate.hidden = shouldHide;
    });
    if (page.hidden) page.hidden = false;
    if (document.body.dataset.page !== "databasestats") document.body.dataset.page = "databasestats";
    page.querySelectorAll('.viewButton[data-view]').forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const active = button.dataset.view === "stats";
      if (button.hidden) button.hidden = false;
      if (button.classList.contains("active") !== active) button.classList.toggle("active", active);
      const pressed = String(active);
      if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    });
  }

  function sync() {
    frame = 0;
    ensureStyles();
    syncFooter();
    syncToastPosition();
    syncDatabaseStatsRoute();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

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
  interval = window.setInterval(schedule, 500);
  sync();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    if (interval) clearInterval(interval);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("popstate", schedule);
    document.getElementById("mflReleaseUiStyles")?.remove();
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
  }

  window.__mflReleaseUiRuntime = { version: VERSION, sync, destroy };
})();
