(() => {
  const VERSION = "1.119.46";
  const CONTENT_GAP = 22;
  const previousRuntime = window.__mflSelectionBarLayoutRuntime;

  previousRuntime?.destroy?.();

  let frame = 0;
  let resizeObserver = null;
  let bodyObserver = null;
  let selectionObserver = null;

  function viewportHeight() {
    return Math.max(0, Number(window.visualViewport?.height || window.innerHeight || 0));
  }

  function applySelectionBarPosition() {
    frame = 0;
    const selectionBar = document.querySelector("#selectionBar");
    const pageContent = document.querySelector("main");
    if (!(selectionBar instanceof HTMLElement) || !(pageContent instanceof HTMLElement)) return;

    const height = viewportHeight();
    const bounds = pageContent.getBoundingClientRect();
    const visibleContentBottom = Math.min(height, Math.max(0, bounds.bottom));
    const bottom = Math.max(CONTENT_GAP, Math.round(height - visibleContentBottom + CONTENT_GAP));

    selectionBar.style.setProperty("--selection-content-bottom", `${bottom}px`);
    selectionBar.dataset.contentBottomVersion = VERSION;
  }

  function scheduleSelectionBarPosition() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(applySelectionBarPosition);
  }

  let style = document.getElementById("selectionBarContentPositionStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "selectionBarContentPositionStyles";
    document.head.appendChild(style);
  }
  style.textContent = `
    #selectionBar.selectionBar {
      bottom: var(--selection-content-bottom, 22px) !important;
    }
  `;

  const pageContent = document.querySelector("main");
  const selectionBar = document.querySelector("#selectionBar");

  if (pageContent && typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(scheduleSelectionBarPosition);
    resizeObserver.observe(pageContent);
  }

  if (document.body) {
    bodyObserver = new MutationObserver(scheduleSelectionBarPosition);
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-page"],
    });
  }

  if (selectionBar) {
    selectionObserver = new MutationObserver(scheduleSelectionBarPosition);
    selectionObserver.observe(selectionBar, {
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });
  }

  window.addEventListener("resize", scheduleSelectionBarPosition, { passive: true });
  window.addEventListener("scroll", scheduleSelectionBarPosition, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleSelectionBarPosition, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleSelectionBarPosition, { passive: true });

  function destroy() {
    if (frame) window.cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    bodyObserver?.disconnect();
    selectionObserver?.disconnect();
    window.removeEventListener("resize", scheduleSelectionBarPosition);
    window.removeEventListener("scroll", scheduleSelectionBarPosition);
    window.visualViewport?.removeEventListener("resize", scheduleSelectionBarPosition);
    window.visualViewport?.removeEventListener("scroll", scheduleSelectionBarPosition);
  }

  window.__mflSelectionBarLayoutRuntime = {
    version: VERSION,
    destroy,
    sync: scheduleSelectionBarPosition,
  };

  scheduleSelectionBarPosition();
})();
