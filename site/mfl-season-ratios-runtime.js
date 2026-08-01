(() => {
  const VERSION = "1.119.14";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@25706e938db204eb0b2f6f43c9db900767a8a133/site/mfl-season-ratios-runtime.js";
  let footerObserver = null;

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
      footer.dataset.releaseLabel = label;
      footer.setAttribute("aria-label", `${label}, open Changelog`);
      footer.style.cursor = "pointer";

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
      element.dataset.mflLatestReleaseVersion = VERSION;
    });
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
