(() => {
  const VERSION = "1.119.12";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@840e22b5a01cafb70e0cffe6a54d86c2c7696c8a/site/mfl-season-ratios-runtime.js";

  function syncVersion() {
    const root = document.documentElement;
    root.classList.add("mflRelease112Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) {
      const label = `MFL Front Office v${VERSION}`;
      footer.textContent = label;
      footer.setAttribute("href", "/changelog");
      footer.dataset.releaseLabel = label;
      footer.setAttribute("aria-label", `${label}, open Changelog`);
    }

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.textContent = `v${VERSION}`;
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
    [0, 50, 250, 1000, 2500].forEach((delay) => setTimeout(syncVersion, delay));
  }, { once: true });
  previous.addEventListener("error", syncVersion, { once: true });
  document.head.appendChild(previous);
})();
