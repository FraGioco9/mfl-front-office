(() => {
  const VERSION = "1.119.2";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@d6b09d4794046c2dec0b7364830bebeda41e760c/site/mfl-season-ratios-runtime.js";
  const RELEASE_DESCRIPTION = "Show a stable footer version immediately after loading";
  const FOOTER_LABEL = `MFL Front Office v${VERSION}`;
  const SHORT_LABEL = `v${VERSION}`;
  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  let scheduled = false;

  function writeNodeText(node, value) {
    if (!node) return;
    if (textContentDescriptor?.set) {
      textContentDescriptor.set.call(node, value);
    } else {
      node.replaceChildren(document.createTextNode(value));
    }
  }

  function readNodeText(node) {
    if (!node) return "";
    if (textContentDescriptor?.get) {
      return String(textContentDescriptor.get.call(node) || "");
    }
    return String(node.innerText || "");
  }

  function lockNodeText(node, allowedValue, rejectPattern) {
    if (!node || node.dataset.mflVersionLock === VERSION || !textContentDescriptor) return;
    writeNodeText(node, allowedValue);
    try {
      Object.defineProperty(node, "textContent", {
        configurable: true,
        enumerable: false,
        get() {
          return String(textContentDescriptor.get.call(this) || "");
        },
        set(value) {
          const nextValue = String(value ?? "");
          if (rejectPattern.test(nextValue) && nextValue !== allowedValue) return;
          textContentDescriptor.set.call(this, value);
        },
      });
      node.dataset.mflVersionLock = VERSION;
    } catch {
      // The visual CSS fallback still prevents stale versions from appearing.
    }
  }

  function installFooterStyles() {
    let style = document.getElementById("mflDeterministicFooterVersionStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflDeterministicFooterVersionStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html body .siteFooter.siteFooter a[data-page="changelog"],
      html body .siteFooter.siteFooter a[href="/changelog"] {
        font-size: 0 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      html body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "${FOOTER_LABEL}" !important;
        display: inline !important;
        font-size: 14px !important;
      }
      html.bootPending body .siteFooter.siteFooter a[data-page="changelog"]::before,
      html.bootPending body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "MFL Front Office -" !important;
      }
    `;
  }

  function footerLink() {
    return document.querySelector('.siteFooter a[data-page="changelog"], .siteFooter a[href="/changelog"]');
  }

  function syncVersionUi() {
    const link = footerLink();
    if (link) {
      lockNodeText(link, FOOTER_LABEL, /^MFL Front Office(?:\s+v\d+\.\d+\.\d+|\s+-)$/);
      if (readNodeText(link) !== FOOTER_LABEL) writeNodeText(link, FOOTER_LABEL);
      link.dataset.releaseLabel = FOOTER_LABEL;
      link.dataset.page = "changelog";
      link.setAttribute("href", "/changelog");
      link.setAttribute("aria-label", `${FOOTER_LABEL}, open Changelog`);
      link.removeAttribute("aria-disabled");
      link.removeAttribute("inert");
      link.tabIndex = 0;
    }

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      lockNodeText(element, SHORT_LABEL, /^v\d+\.\d+\.\d+$/);
      if (readNodeText(element) !== SHORT_LABEL) writeNodeText(element, SHORT_LABEL);
    });
  }

  function changelogEntryExists(list) {
    return Array.from(list.querySelectorAll(".changelogPatchList li > span, .changelogList > li > span"))
      .some((label) => String(label.textContent || "").trim() === SHORT_LABEL);
  }

  function createPatchItem() {
    const item = document.createElement("li");
    const version = document.createElement("span");
    const description = document.createElement("p");
    version.textContent = SHORT_LABEL;
    description.textContent = RELEASE_DESCRIPTION;
    item.append(version, description);
    return item;
  }

  function syncChangelog() {
    const list = document.querySelector(".changelogList");
    if (!list || changelogEntryExists(list)) return;

    let section = Array.from(list.querySelectorAll(".changelogMinorSection"))
      .find((candidate) => String(candidate.querySelector(".changelogMinorVersion")?.textContent || "").trim() === "v1.119");

    if (!section) {
      section = document.createElement("li");
      section.className = "changelogMinorSection is-expanded";
      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = '<span class="changelogMinorVersion">v1.119</span><span class="changelogMinorMeta">0 patches</span><span class="changelogMinorChevron" aria-hidden="true">&gt;</span>';
      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patches = document.createElement("ol");
      patches.className = "changelogPatchList";
      inner.appendChild(patches);
      panel.appendChild(inner);
      section.append(toggle, panel);
      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.prepend(section);
    }

    const patches = section.querySelector(".changelogPatchList");
    if (patches) patches.prepend(createPatchItem());
    const count = section.querySelectorAll(".changelogPatchList > li").length;
    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) meta.textContent = `${count} ${count === 1 ? "patch" : "patches"}`;
  }

  function openChangelog() {
    try {
      if (typeof setPage === "function") {
        Promise.resolve(setPage("changelog", true, { replaceUrl: "/changelog" })).catch(() => {});
        return;
      }
    } catch {
      // Fall through to popstate routing.
    }
    if (window.location.pathname !== "/changelog") {
      window.history.pushState({}, "", "/changelog");
    }
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
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
    syncVersionUi();
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

  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", schedule, { once: true });
  previous.addEventListener("error", schedule, { once: true });
  document.head.appendChild(previous);
})();
