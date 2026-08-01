(() => {
  const VERSION = "1.119.14";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@25706e938db204eb0b2f6f43c9db900767a8a133/site/mfl-season-ratios-runtime.js";
  let footerObserver = null;
  let changelogDelegationBound = false;

  function installChangelogDelegation() {
    if (changelogDelegationBound) return;
    const list = document.querySelector(".changelogList");
    if (!list) return;

    changelogDelegationBound = true;
    list.addEventListener("click", (event) => {
      const toggle = event.target instanceof Element
        ? event.target.closest(".changelogMinorToggle")
        : null;
      if (!toggle || !list.contains(toggle)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const section = toggle.closest(".changelogMinorSection");
      if (!section) return;
      const expanded = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }, true);
  }

  function syncVersion() {
    const root = document.documentElement;
    root.classList.add("mflRelease114Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) {
      const label = `MFL Front Office v${VERSION}`;
      if (footer.textContent !== label) footer.textContent = label;
      if (footer.getAttribute("href") !== "/changelog") footer.setAttribute("href", "/changelog");
      if (footer.dataset.releaseLabel !== label) footer.dataset.releaseLabel = label;
      const ariaLabel = `${label}, open Changelog`;
      if (footer.getAttribute("aria-label") !== ariaLabel) footer.setAttribute("aria-label", ariaLabel);
      if (footer.style.cursor !== "pointer") footer.style.cursor = "pointer";

      if (!footerObserver) {
        footerObserver = new MutationObserver(() => syncVersion());
        footerObserver.observe(footer, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    }

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      if (element.textContent !== `v${VERSION}`) element.textContent = `v${VERSION}`;
      if (element.dataset.mflLatestReleaseVersion !== VERSION) {
        element.dataset.mflLatestReleaseVersion = VERSION;
      }
    });
    installChangelogDelegation();
  }

  syncVersion();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncVersion, { once: true });
  }

  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", () => {
    syncVersion();
    [0, 50, 250, 1000, 2500, 5000].forEach((delay) => setTimeout(syncVersion, delay));
  }, { once: true });
  previous.addEventListener("error", syncVersion, { once: true });
  document.head.appendChild(previous);
})();
