(() => {
  const VERSION = "1.119.16";
  const LABEL = `MFL Front Office v${VERSION}`;
  let footerObserver = null;
  let documentObserver = null;

  function synchronizeFooter() {
    const root = document.documentElement;
    root.classList.add("mflRelease116Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (!footer) return false;

    if (footer.textContent !== LABEL) footer.textContent = LABEL;
    if (footer.getAttribute("href") !== "/changelog") footer.setAttribute("href", "/changelog");
    if (footer.dataset.releaseLabel !== LABEL) footer.dataset.releaseLabel = LABEL;
    const ariaLabel = `${LABEL}, open Changelog`;
    if (footer.getAttribute("aria-label") !== ariaLabel) footer.setAttribute("aria-label", ariaLabel);
    if (footer.style.cursor !== "pointer") footer.style.cursor = "pointer";

    if (!footerObserver) {
      footerObserver = new MutationObserver(synchronizeFooter);
      footerObserver.observe(footer, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    if (documentObserver) {
      documentObserver.disconnect();
      documentObserver = null;
    }
    return true;
  }

  function startWatching() {
    if (synchronizeFooter()) return;
    if (documentObserver) return;
    documentObserver = new MutationObserver(() => synchronizeFooter());
    documentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  startWatching();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching, { once: true });
  }
  [0, 50, 250, 1000, 2500, 5000].forEach((delay) => setTimeout(startWatching, delay));
})();
