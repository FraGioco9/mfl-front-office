(() => {
  const VERSION = "1.119.15";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@1ab9b6aeb9836e0f80353c03cbdd648a65880b9c/site/mfl-season-ratios-runtime.js";

  function syncVersion() {
    const root = document.documentElement;
    root.classList.add("mflRelease115Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) {
      const label = `MFL Front Office v${VERSION}`;
      footer.textContent = label;
      footer.setAttribute("href", "/changelog");
      footer.dataset.releaseLabel = label;
      footer.setAttribute("aria-label", `${label}, open Changelog`);
      footer.style.cursor = "pointer";
    }
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
