(() => {
  const VERSION = "1.119.1";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@55797cced17e5cd2d5a40e65a58b5a022c7b7099/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Restore the footer version and Changelog navigation";
  let scheduled = false;

  function installFooterStyles() {
    let style = document.getElementById("mflFooterVersionPatchStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflFooterVersionPatchStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html body .siteFooter a[data-page="changelog"],
      html body .siteFooter a[href="/changelog"] {
        font-size: 14px !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      html body .siteFooter a[data-page="changelog"]::before,
      html body .siteFooter a[href="/changelog"]::before {
        content: none !important;
        display: none !important;
      }
    `;
  }

  function footerLink() {
    return document.querySelector('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]');
  }

  function syncFooter() {
    const link = footerLink();
    if (link) {
      const label = `MFL Front Office v${VERSION}`;
      if (link.textContent !== label) link.textContent = label;
      if (link.getAttribute("href") !== "/changelog") link.setAttribute("href", "/changelog");
      if (link.dataset.page !== "changelog") link.dataset.page = "changelog";
      link.removeAttribute("aria-disabled");
      link.removeAttribute("inert");
      link.tabIndex = 0;
    }
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      const label = `v${VERSION}`;
      if (element.textContent !== label) element.textContent = label;
    });
  }

  function changelogEntryExists(list) {
    return Array.from(list.querySelectorAll(".changelogPatchList li > span, .changelogList > li > span"))
      .some((label) => String(label.textContent || "").trim() === `v${VERSION}`);
  }

  function updateMinorMeta(section) {
    const items = section?.querySelectorAll(".changelogPatchList > li") || [];
    const meta = section?.querySelector(".changelogMinorMeta");
    if (meta) meta.textContent = `${items.length} ${items.length === 1 ? "patch" : "patches"}`;
  }

  function createPatchItem() {
    const item = document.createElement("li");
    const version = document.createElement("span");
    const description = document.createElement("p");
    version.textContent = `v${VERSION}`;
    description.textContent = RELEASE_DESCRIPTION;
    item.append(version, description);
    return item;
  }

  function createMinorSection() {
    const section = document.createElement("li");
    section.className = "changelogMinorSection is-expanded";
    const toggle = document.createElement("button");
    toggle.className = "changelogMinorToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "true");
    toggle.innerHTML = '<span class="changelogMinorVersion">v1.119</span><span class="changelogMinorMeta">1 patch</span><span class="changelogMinorChevron" aria-hidden="true">&gt;</span>';
    const panel = document.createElement("div");
    panel.className = "changelogMinorPanel";
    const inner = document.createElement("div");
    inner.className = "changelogMinorPanelInner";
    const patches = document.createElement("ol");
    patches.className = "changelogPatchList";
    patches.appendChild(createPatchItem());
    inner.appendChild(patches);
    panel.appendChild(inner);
    section.append(toggle, panel);
    toggle.addEventListener("click", () => {
      const expanded = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    return section;
  }

  function syncChangelog() {
    const list = document.querySelector(".changelogList");
    if (!list || changelogEntryExists(list)) return;
    const section = Array.from(list.querySelectorAll(".changelogMinorSection"))
      .find((candidate) => String(candidate.querySelector(".changelogMinorVersion")?.textContent || "").trim() === "v1.119");
    if (section) {
      const patches = section.querySelector(".changelogPatchList");
      if (patches) patches.prepend(createPatchItem());
      updateMinorMeta(section);
      return;
    }
    list.prepend(createMinorSection());
  }

  function openChangelog() {
    try {
      if (typeof setPage === "function") {
        Promise.resolve(setPage("changelog", true, { replaceUrl: "/changelog" })).catch(() => {});
        return true;
      }
    } catch {
      // Fall back to the application's popstate router.
    }
    if (window.location.pathname !== "/changelog") {
      window.history.pushState({}, "", "/changelog");
    }
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    return true;
  }

  function footerLinkFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]') || null;
  }

  window.addEventListener("click", (event) => {
    const link = footerLinkFromEvent(event);
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button === 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openChangelog();
  }, true);

  window.addEventListener("keydown", (event) => {
    const link = footerLinkFromEvent(event);
    if (!link || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openChangelog();
  }, true);

  function maintain() {
    installFooterStyles();
    syncFooter();
    syncChangelog();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      maintain();
    });
  }

  function startPatch() {
    maintain();
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-page", "href", "hidden", "aria-disabled"],
      childList: true,
      subtree: true,
      characterData: true,
    });
    ["popstate", "hashchange"].forEach((name) => window.addEventListener(name, schedule));
    [0, 50, 150, 400, 1000, 2000, 4000, 7000].forEach((delay) => setTimeout(maintain, delay));
  }

  installFooterStyles();
  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", startPatch, { once: true });
  previous.addEventListener("error", startPatch, { once: true });
  document.head.appendChild(previous);
})();
