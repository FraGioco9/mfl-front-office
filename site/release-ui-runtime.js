(() => {
  const VERSION = "1.120.4";
  window.__mflReleaseUiRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  const timers = new Set();

  function ensureStyles() {
    let style = document.getElementById("mflReleaseUiStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflReleaseUiStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      .siteFooter a::before {
        content: none !important;
        display: none !important;
      }
      .toastMessage {
        bottom: var(--mfl-toast-bottom, 88px) !important;
      }
    `;
  }

  function footerLink() {
    const footer = document.querySelector(".siteFooter");
    if (!footer) return null;
    return footer.querySelector('a[href="/changelog"], a[data-page="changelog"], [data-page="changelog"], a') || null;
  }

  function syncFooter() {
    const footer = document.querySelector(".siteFooter");
    if (!footer) return;

    let target = footerLink();
    if (!target) {
      target = document.createElement("a");
      footer.appendChild(target);
    }

    const text = `MFL Front Office v${VERSION}`;
    if (target.textContent !== text) target.textContent = text;
    if (target instanceof HTMLAnchorElement) target.href = "/changelog";
    target.dataset.page = "changelog";
    target.dataset.releaseLabel = text;
    target.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
  }

  function selectionBarIsVisible(bar) {
    if (!(bar instanceof HTMLElement) || bar.hidden || !bar.classList.contains("visible")) return false;
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
    document.documentElement.style.setProperty("--mfl-toast-bottom", `${bottom}px`);
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
    document.getElementById("mflReleaseUiStyles")?.remove();
    document.documentElement.style.removeProperty("--mfl-toast-bottom");
  }

  window.__mflReleaseUiRuntime = {
    version: VERSION,
    sync,
    destroy,
  };
})();
