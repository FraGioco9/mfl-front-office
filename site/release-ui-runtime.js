(() => {
  const VERSION = "1.120.5";
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
      .toastMessage {
        position: fixed !important;
        bottom: var(--mfl-toast-bottom, 88px) !important;
        z-index: 2147483635 !important;
      }
    `;
  window.__mflReleaseUiRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  const timers = new Set();

  function ensureStyles() {
    let style = document.getElementById("mflReleaseUiStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflReleaseUiStyles";
      style.textContent = STYLE_TEXT;
      document.head.appendChild(style);
    } else if (style.textContent !== STYLE_TEXT) {
      style.textContent = STYLE_TEXT;
    }
  }

  function footerLink() {
    const footer = document.querySelector(".siteFooter");
    if (!footer) return null;
    return footer.querySelector('a[href="/changelog"], a[data-page="changelog"]') || null;
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!footer) return;

    let target = footerLink();
    if (!target) {
      target = document.createElement("a");
      footer.replaceChildren(target);
    }

    const text = `MFL Front Office v${VERSION}`;
    const ariaLabel = `${text}, open Changelog`;
    target.hidden = false;
    target.removeAttribute("aria-hidden");
    if (target.textContent !== text) target.textContent = text;
    if (target instanceof HTMLAnchorElement && target.getAttribute("href") !== "/changelog") {
      target.setAttribute("href", "/changelog");
    }
    if (target.dataset.page !== "changelog") target.dataset.page = "changelog";
    if (target.dataset.releaseLabel !== text) target.dataset.releaseLabel = text;
    if (target.getAttribute("aria-label") !== ariaLabel) target.setAttribute("aria-label", ariaLabel);
    if (footer.dataset.releaseVersion !== VERSION) footer.dataset.releaseVersion = VERSION;
  }

  function selectionBarIsVisible(bar) {
    if (!(bar instanceof HTMLElement) || bar.hidden) return false;
    const style = getComputedStyle(bar);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = bar.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function syncToastPosition() {
    const bar = document.querySelector("#selectionBar");
    let bottom = 88;
    if (selectionBarIsVisible(bar)) {
      const rect = bar.getBoundingClientRect();
      bottom = Math.max(bottom, Math.ceil(innerHeight - rect.top + 12));
    }
    const value = `${bottom}px`;
    if (document.documentElement.style.getPropertyValue("--mfl-toast-bottom") !== value) {
      document.documentElement.style.setProperty("--mfl-toast-bottom", value);
    }
  }

  function customTooltipContains(target) {
    return target instanceof Element && Boolean(target.closest("#databaseStatsCustomTooltipPortal"));
  }

  function guardCustomTooltipEvent(event) {
    const target = event.target;
    if (!customTooltipContains(target)) return;

    if (event.type === "click" && target instanceof Element && target.closest('[data-role="apply"]')) {
      return;
    }
    if (event.type === "keydown" && (event.key === "Enter" || event.key === "Escape")) return;

    event.stopImmediatePropagation();
  }

  function sync() {
    frame = 0;
    ensureStyles();
    syncFooter();
    syncToastPosition();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  function scheduleDelayed(delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      schedule();
    }, delay);
    timers.add(timer);
  }

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["class", "hidden", "style", "data-page"],
  });
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("popstate", schedule);
  window.addEventListener("click", guardCustomTooltipEvent, true);
  window.addEventListener("input", guardCustomTooltipEvent, true);
  window.addEventListener("change", guardCustomTooltipEvent, true);
  window.addEventListener("keydown", guardCustomTooltipEvent, true);

  sync();
  [0, 50, 150, 400, 1000, 2000, 5000, 10000].forEach(scheduleDelayed);

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("click", guardCustomTooltipEvent, true);
    window.removeEventListener("input", guardCustomTooltipEvent, true);
    window.removeEventListener("change", guardCustomTooltipEvent, true);
    window.removeEventListener("keydown", guardCustomTooltipEvent, true);
    document.getElementById("mflReleaseUiStyles")?.remove();
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
  }

  window.__mflReleaseUiRuntime = {
    version: VERSION,
    sync,
    destroy,
  };
})();
