(() => {
  "use strict";

  const VERSION = String(window.__mflRelease?.version || window.__mflReleaseVersion || "dev");
  const STATS_PATH = /^\/database\/stats\/?$/i;

  window.__mflReleaseUiRuntime?.destroy?.();

  let frame = 0;
  let observer = null;

  function installFirstPaintGuards() {
    if (document.getElementById("mflReleaseFirstPaintGuards")) return;
    const style = document.createElement("style");
    style.id = "mflReleaseFirstPaintGuards";
    style.textContent = `
      html[data-stored-progression-access="true"] #homeOptInButton,
      html[data-stored-progression-access="true"] #myPlayersOptInButton {
        display: none !important;
      }

      button:focus,
      button:focus-visible,
      [role="button"]:focus,
      [role="button"]:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
      }

      button::-moz-focus-inner,
      [role="button"]::-moz-focus-inner {
        border: 0 !important;
      }

      /* Fade loading placeholders at the cell layer. Table-row opacity can be
         flattened by table painting or later row rules, so keep the row fully
         opaque and make each placeholder cell authoritative instead. */
      #tableBody > .staticTableBlankRow {
        opacity: 1 !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="1"] > td {
        opacity: 0.90 !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="2"] > td {
        opacity: 0.68 !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="3"] > td {
        opacity: 0.46 !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="4"] > td {
        opacity: 0.26 !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="5"] > td {
        opacity: 0.10 !important;
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

  function setAttributeIfChanged(element, name, value) {
    if (!(element instanceof Element) || element.getAttribute(name) === value) return;
    element.setAttribute(name, value);
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
    if (link.hidden) link.hidden = false;
    if (link.hasAttribute("aria-hidden")) link.removeAttribute("aria-hidden");
    setAttributeIfChanged(link, "href", "/changelog");
    if (link.dataset.page !== "changelog") link.dataset.page = "changelog";
    if (link.dataset.releaseLabel !== text) link.dataset.releaseLabel = text;
    if (link.textContent !== text) link.textContent = text;
    setAttributeIfChanged(link, "aria-label", `${text}, open Changelog`);
    if (footer.dataset.releaseVersion !== VERSION) footer.dataset.releaseVersion = VERSION;
    setImportant(link, "display", "inline-block");
    setImportant(link, "visibility", "visible");
    setImportant(link, "opacity", "1");
  }

  function syncStatsChrome() {
    if (!STATS_PATH.test(location.pathname)) return;
    if (document.body.dataset.page !== "databasestats") document.body.dataset.page = "databasestats";
    document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const allowed = ["attributes", "contracts", "stats"].includes(button.dataset.view);
      const active = button.dataset.view === "stats";
      if (button.hidden === allowed) button.hidden = !allowed;
      if (button.hasAttribute("aria-hidden")) button.removeAttribute("aria-hidden");
      button.classList.toggle("active", active);
      setAttributeIfChanged(button, "aria-pressed", String(active));
    });

    const page = document.querySelector("#databaseStatsPage");
    if (!(page instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const shouldHide = candidate !== page;
      if (candidate.hidden !== shouldHide) candidate.hidden = shouldHide;
    });
    if (page.hidden) page.hidden = false;
    if (page.hasAttribute("aria-hidden")) page.removeAttribute("aria-hidden");
  }

  function sync() {
    frame = 0;
    installFirstPaintGuards();
    syncFooter();
    syncStatsChrome();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  installFirstPaintGuards();
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["class", "hidden", "data-page", "aria-hidden"],
  });
  window.addEventListener("popstate", schedule);
  sync();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
    document.getElementById("mflReleaseFirstPaintGuards")?.remove();
  }

  window.__mflReleaseUiRuntime = Object.freeze({
    version: VERSION,
    sync: schedule,
    destroy,
  });
})();
