(() => {
  const VERSION = "1.120.16";
  const EXIT_MS = 220;
  const FAILSAFE_MS = 15000;
  const TOAST_ANCHOR_MS = 15000;
  const TOAST_SELECTOR = ".toastMessage, .watchlistToast, #watchlistToast, #toastMessage, .toast";

  const existing = window.__mflSelectionFeedbackRuntime;
  if (existing?.version === VERSION) {
    existing.rebind?.();
    return;
  }
  existing?.destroy?.();

  let frame = 0;
  let interval = 0;
  let observer = null;
  let observedRoot = null;
  let exitTimer = 0;
  let failsafeTimer = 0;
  let destroyed = false;
  let suppressionActive = false;
  let suppressionStartedAt = 0;
  let lastSelectionTop = null;
  let toastAnchorUntil = 0;

  function setImportant(element, property, value) {
    if (!(element instanceof HTMLElement)) return;
    if (element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  }

  function selectionBar() {
    const bar = document.getElementById("selectionBar");
    return bar instanceof HTMLElement ? bar : null;
  }

  function selectionCount() {
    const text = String(document.getElementById("selectionCount")?.textContent || "").trim();
    const match = text.match(/\d[\d,.]*/);
    if (!match) return null;
    const value = Number(match[0].replace(/[,.]/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  function barIsVisible(bar) {
    if (!(bar instanceof HTMLElement) || bar.hidden) return false;
    const style = getComputedStyle(bar);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01) return false;
    const rect = bar.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }

  function ensureStyles() {
    let style = document.getElementById("mflSelectionFeedbackStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflSelectionFeedbackStyles";
      document.head?.appendChild(style);
    }
    const css = `
      #selectionBar.mflSelectionActionDismissed {
        opacity: 0 !important;
        pointer-events: none !important;
        transform: translateX(-50%) translateY(12px) !important;
        transition: opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease !important;
      }

      #selectionBar.mflSelectionActionDismissed * {
        pointer-events: none !important;
      }
    `;
    if (style && style.textContent !== css) style.textContent = css;
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
    link.href = "/changelog";
    link.dataset.page = "changelog";
    link.dataset.releaseLabel = text;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}, open Changelog`);
    footer.dataset.releaseVersion = VERSION;
  }

  function actionTarget(target) {
    if (!(target instanceof Element)) return null;
    const bar = target.closest("#selectionBar");
    if (!(bar instanceof HTMLElement)) return null;
    const action = target.closest('button, a[href], [role="button"]');
    if (!(action instanceof HTMLElement) || !bar.contains(action)) return null;
    if (action.matches(":disabled") || action.getAttribute("aria-disabled") === "true") return null;
    return action;
  }

  function rememberBarTop(bar) {
    const rect = bar?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    lastSelectionTop = rect.top;
  }

  function releaseSuppression() {
    suppressionActive = false;
    suppressionStartedAt = 0;
    if (exitTimer) clearTimeout(exitTimer);
    if (failsafeTimer) clearTimeout(failsafeTimer);
    exitTimer = 0;
    failsafeTimer = 0;

    const bar = selectionBar();
    if (bar) {
      bar.hidden = false;
      bar.classList.remove("mflSelectionActionDismissed");
    }
    schedule();
  }

  function dismissSelectionBar() {
    if (suppressionActive) return;
    const bar = selectionBar();
    if (!bar) return;

    rememberBarTop(bar);
    toastAnchorUntil = Date.now() + TOAST_ANCHOR_MS;
    suppressionActive = true;
    suppressionStartedAt = Date.now();

    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("mflSelectionActionDismissed");
    bar.classList.remove("visible");

    exitTimer = window.setTimeout(() => {
      exitTimer = 0;
      if (!suppressionActive) return;
      const current = selectionBar();
      if (current) current.hidden = true;
      schedule();
    }, EXIT_MS);

    failsafeTimer = window.setTimeout(releaseSuppression, FAILSAFE_MS);
    schedule();
  }

  function syncSelectionState() {
    const bar = selectionBar();
    if (!bar) return;

    if (!suppressionActive) {
      if (barIsVisible(bar)) rememberBarTop(bar);
      return;
    }

    bar.classList.add("mflSelectionActionDismissed");
    const elapsed = Date.now() - suppressionStartedAt;
    if (elapsed >= EXIT_MS) bar.hidden = true;

    const count = selectionCount();
    if (count === 0 && elapsed >= EXIT_MS) releaseSuppression();
  }

  function desiredToastBottom() {
    const bar = selectionBar();
    if (!suppressionActive && barIsVisible(bar)) {
      rememberBarTop(bar);
      return Math.max(12, Math.ceil(innerHeight - bar.getBoundingClientRect().top + 12));
    }

    if (lastSelectionTop !== null && (suppressionActive || Date.now() < toastAnchorUntil)) {
      return Math.max(12, Math.ceil(innerHeight - lastSelectionTop + 12));
    }

    return 88;
  }

  function syncToastPosition() {
    const desiredBottom = desiredToastBottom();
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (!(toast instanceof HTMLElement)) return;
      const computedBottom = Number.parseFloat(getComputedStyle(toast).bottom);
      const actualBottom = Number.isFinite(computedBottom) ? computedBottom : 88;
      const translateY = Math.round(actualBottom - desiredBottom);
      setImportant(toast, "translate", `0 ${translateY}px`);
      setImportant(toast, "z-index", "2147483635");
    });
  }

  function bindObserver() {
    const root = document.documentElement;
    if (!root || root === observedRoot) return;
    observer?.disconnect();
    observedRoot = root;
    observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "hidden", "style", "aria-hidden", "data-page"],
    });
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    ensureStyles();
    bindObserver();
    syncFooter();
    syncSelectionState();
    syncToastPosition();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function onActionStart(event) {
    if (!actionTarget(event.target)) return;
    dismissSelectionBar();
  }

  function onResizeOrScroll() {
    schedule();
  }

  function rebind() {
    if (destroyed) return;
    observedRoot = null;
    bindObserver();
    schedule();
  }

  window.addEventListener("pointerdown", onActionStart, true);
  window.addEventListener("click", onActionStart, true);
  window.addEventListener("resize", onResizeOrScroll);
  window.addEventListener("scroll", onResizeOrScroll, true);
  interval = window.setInterval(schedule, 100);
  rebind();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    if (exitTimer) clearTimeout(exitTimer);
    if (failsafeTimer) clearTimeout(failsafeTimer);
    observer?.disconnect();
    window.removeEventListener("pointerdown", onActionStart, true);
    window.removeEventListener("click", onActionStart, true);
    window.removeEventListener("resize", onResizeOrScroll);
    window.removeEventListener("scroll", onResizeOrScroll, true);
    document.querySelectorAll(TOAST_SELECTOR).forEach((toast) => {
      if (toast instanceof HTMLElement) toast.style.removeProperty("translate");
    });
    const bar = selectionBar();
    if (bar) {
      bar.hidden = false;
      bar.classList.remove("mflSelectionActionDismissed");
    }
    document.getElementById("mflSelectionFeedbackStyles")?.remove();
  }

  window.__mflSelectionFeedbackRuntime = {
    version: VERSION,
    sync: schedule,
    rebind,
    destroy,
  };
})();
