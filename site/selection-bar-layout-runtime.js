(() => {
  const VERSION = "1.120.8";
  window.__mflSelectionBarLayoutRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  let interval = 0;

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

  function selectionBottom() {
    const footer = document.querySelector(".siteFooter");
    if (!visible(footer)) return 12;
    return Math.max(12, Math.ceil(innerHeight - footer.getBoundingClientRect().top + 12));
  }

  function sync() {
    frame = 0;
    const bar = document.querySelector("#selectionBar");
    const main = document.querySelector("#appShell main, main");
    if (!(bar instanceof HTMLElement) || !(main instanceof HTMLElement)) return;

    if (bar.parentElement !== main) main.appendChild(bar);
    const rect = main.getBoundingClientRect();
    const bottom = selectionBottom();
    bar.dataset.contentLayoutVersion = VERSION;
    setImportant(bar, "position", "fixed");
    setImportant(bar, "left", `${Math.round(rect.left + rect.width / 2)}px`);
    setImportant(bar, "right", "auto");
    setImportant(bar, "bottom", `${bottom}px`);
    setImportant(bar, "transform", "translateX(-50%)");
    setImportant(bar, "z-index", "2147483500");
    document.documentElement.style.setProperty("--mfl-selection-bar-bottom", `${bottom}px`);
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
    attributeFilter: ["class", "hidden", "style", "data-page"],
  });
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  interval = window.setInterval(schedule, 250);
  sync();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    if (interval) clearInterval(interval);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    document.documentElement.style.removeProperty("--mfl-selection-bar-bottom");
  }

  window.__mflSelectionBarLayoutRuntime = {
    version: VERSION,
    destroy,
    sync: schedule,
  };
})();
