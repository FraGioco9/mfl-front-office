(() => {
  "use strict";

  const VERSION = String(window.__mflRelease?.version || window.__mflReleaseVersion || "dev");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const AGENT_PATH = /^\/agents\/([^/?#]+)(?:\/|$)/i;
  const CLUB_PATH = /^\/(?:clubs|club)\/[^/?#]+(?:\/|$)/i;
  const STYLE_ID = "mflStaticUiGuards";
  const AGENT_VIEWS = Object.freeze(["attributes", "contracts", "next", "current", "all"]);
  const CLUB_VIEWS = Object.freeze(["attributes", "contracts", "current", "all"]);

  window.__mflStaticUiRuntime?.destroy?.();

  let frame = 0;
  let observer = null;

  function installFirstPaintGuards() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
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

      body[data-page="agents"] #progressionPage .views > .viewButton[data-view="stats"],
      body[data-page="club"] #progressionPage .views > .viewButton:is([data-view="stats"], [data-view="next"]) {
        display: none !important;
      }

      html body[data-page="agents"] #progressionPage .views > .viewButton:is(
        [data-view="attributes"],
        [data-view="contracts"],
        [data-view="next"],
        [data-view="current"],
        [data-view="all"]
      ),
      html body[data-page="club"] #progressionPage .views > .viewButton:is(
        [data-view="attributes"],
        [data-view="contracts"],
        [data-view="current"],
        [data-view="all"]
      ) {
        display: inline-flex !important;
      }

      #tableBody > .staticTableBlankRow,
      #tableBody > .staticTableBlankRow > td {
        opacity: 1 !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="1"] > td {
        background: color-mix(in srgb, var(--border-strong) 28%, transparent) !important;
        background-image: none !important;
        border-bottom-color: color-mix(in srgb, var(--border-strong) 85%, transparent) !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="2"] > td {
        background: color-mix(in srgb, var(--border-strong) 21%, transparent) !important;
        background-image: none !important;
        border-bottom-color: color-mix(in srgb, var(--border-strong) 65%, transparent) !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="3"] > td {
        background: color-mix(in srgb, var(--border-strong) 14%, transparent) !important;
        background-image: none !important;
        border-bottom-color: color-mix(in srgb, var(--border-strong) 45%, transparent) !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="4"] > td {
        background: color-mix(in srgb, var(--border-strong) 8%, transparent) !important;
        background-image: none !important;
        border-bottom-color: color-mix(in srgb, var(--border-strong) 28%, transparent) !important;
      }

      #tableBody > .staticTableBlankRow[data-loading-row="5"] > td {
        background: color-mix(in srgb, var(--border-strong) 3%, transparent) !important;
        background-image: none !important;
        border-bottom-color: color-mix(in srgb, var(--border-strong) 12%, transparent) !important;
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

  function syncDatabaseStatsPage() {
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

  function decodedPathSegment(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch {
      return String(value || "").trim();
    }
  }

  function normalizedAgentAddressFromPath() {
    const match = String(location.pathname || "").match(AGENT_PATH);
    const rawAddress = decodedPathSegment(match?.[1] || "");
    if (!rawAddress) return "";
    return (rawAddress.startsWith("0x") ? rawAddress : `0x${rawAddress}`).toLowerCase();
  }

  function liveAgentName(address) {
    if (!address) return "";
    window.__mflStaticAgentAddress = address;
    try {
      return String(window.eval(`(() => {
        try {
          const address = String(window.__mflStaticAgentAddress || "");
          return typeof agentNameForWallet === "function" ? agentNameForWallet(address) : "";
        } catch {
          return "";
        }
      })()` ) || "").trim();
    } catch {
      return "";
    } finally {
      delete window.__mflStaticAgentAddress;
    }
  }

  function syncViewSet(order, labels = {}) {
    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement)) return;
    const allowed = new Set(order);
    const buttons = Array.from(views.querySelectorAll(":scope > .viewButton[data-view]"));

    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const view = String(button.dataset.view || "");
      const shouldHide = !allowed.has(view);
      if (button.hidden !== shouldHide) button.hidden = shouldHide;
      const expectedLabel = labels[view];
      if (expectedLabel && button.textContent !== expectedLabel) button.textContent = expectedLabel;
    });

    const currentVisibleOrder = buttons
      .filter((button) => button instanceof HTMLButtonElement && allowed.has(String(button.dataset.view || "")))
      .map((button) => String(button.dataset.view || ""));
    if (currentVisibleOrder.join("|") === order.join("|")) return;

    const switcher = document.getElementById("watchlistSwitcher");
    order.forEach((viewName) => {
      const button = views.querySelector(`:scope > .viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
  }

  function syncAgentPage() {
    if (document.body?.dataset.page !== "agents" && !AGENT_PATH.test(location.pathname)) return;
    const address = normalizedAgentAddressFromPath();
    if (!address) return;

    syncViewSet(AGENT_VIEWS, {
      attributes: "Attributes",
      contracts: "Contracts",
      next: "Next Overall",
      current: "Current Season",
      all: "All Time",
    });

    const title = document.getElementById("tablePageTitle");
    if (!(title instanceof HTMLElement)) return;
    const name = liveAgentName(address);
    const displayName = name && name.toLowerCase() !== address.toLowerCase()
      ? `${name} - ${address}`
      : address;
    if (String(title.textContent || "").trim() !== displayName) title.textContent = displayName;
  }

  function syncClubPage() {
    if (document.body?.dataset.page !== "club" && !CLUB_PATH.test(location.pathname)) return;
    syncViewSet(CLUB_VIEWS, {
      attributes: "Squad",
      contracts: "Contracts",
      current: "Current Season",
      all: "All Time",
    });
  }

  function sync() {
    frame = 0;
    installFirstPaintGuards();
    syncFooter();
    syncDatabaseStatsPage();
    syncAgentPage();
    syncClubPage();
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
    document.getElementById(STYLE_ID)?.remove();
  }

  window.__mflStaticUiRuntime = Object.freeze({
    version: VERSION,
    sync: schedule,
    destroy,
  });
})();
