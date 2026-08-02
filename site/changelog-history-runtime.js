(() => {
  const VERSION = "1.119.6";
  const RELEASES = [["v1.119.6","Load shared evaluations before validating their player"],["v1.119.5","Calculate the Discount Ratio from the current MFL/USD value"],["v1.119.4","Lock global search loading while keeping table data visible"],["v1.119.3","Stabilize club controls, sorting, selection, and My Players view state"],["v1.119.2","Cache completed club views and restore them without rebuilding"],["v1.119.1","Rebuild first-paint release UI, footer versioning, and complete Changelog history"],["v1.119.0","Optimize paged data loading, cache responses, and link player contract clubs"],["v1.118.3","Link player contract teams and restore MFL Stats filters"],["v1.118.2","Finalize Evaluation sharing, saved routes, and Discount Rate synchronization"],["v1.118.1","Enforce API limits and stabilize loading, scrolling, and page overlays"],["v1.118.0","Use Supabase season ratios for Evaluation discount rates"],["v1.117.1","Prioritize search results and finalize Evaluation overlays"],["v1.117.0","Build player data batches from PlayMFL instead of Flow"]];
  const previous = window.__mflChangelogHistoryRuntime;
  previous?.destroy?.();

  let observer = null;
  let frame = 0;
  let syncing = false;
  const byMinor = new Map();
  RELEASES.forEach(([version, description]) => {
    const minor = version.split(".").slice(0, 2).join(".").replace(/^v/, "");
    if (!byMinor.has(minor)) byMinor.set(minor, []);
    byMinor.get(minor).push([version, description]);
  });

  function patchSection(list, minor, releases) {
    const section = Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).find((item) => (
      String(item.querySelector(".changelogMinorVersion")?.textContent || "").trim() === `v${minor}`
    ));
    if (!section) return false;

    const patchList = section.querySelector(".changelogPatchList");
    const meta = section.querySelector(".changelogMinorMeta");
    if (!patchList) return false;

    const key = JSON.stringify(releases);
    if (patchList.dataset.rewrittenHistoryKey !== key) {
      const fragment = document.createDocumentFragment();
      releases.forEach(([version, description]) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        const text = document.createElement("p");
        label.textContent = version;
        text.textContent = description;
        item.append(label, text);
        fragment.appendChild(item);
      });
      patchList.replaceChildren(fragment);
      patchList.dataset.rewrittenHistoryKey = key;
    }

    if (meta) meta.textContent = `${releases.length} ${releases.length === 1 ? "patch" : "patches"}`;
    if (minor === "1.119" && !list.querySelector(".changelogMinorSection.is-expanded")) {
      section.classList.add("is-expanded");
      section.querySelector(".changelogMinorToggle")?.setAttribute("aria-expanded", "true");
    }
    return true;
  }

  function sync() {
    frame = 0;
    if (syncing) return;
    syncing = true;
    try {
      const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
      const footerLabel = `MFL Front Office v${VERSION}`;
      if (footer && footer.textContent !== footerLabel) footer.textContent = footerLabel;

      const list = document.querySelector(".changelogList");
      if (!list) return;
      byMinor.forEach((releases, minor) => patchSection(list, minor, releases));
      list.dataset.completeReleaseVersion = VERSION;
      list.dataset.rewrittenReleaseVersion = VERSION;
    } finally {
      syncing = false;
    }
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
  }

  window.__mflChangelogHistoryRuntime = {
    version: VERSION,
    releases: Object.freeze(RELEASES.map((entry) => Object.freeze([...entry]))),
    sync,
    destroy,
  };

  sync();
  [0, 50, 150, 400, 1000, 2000, 5000].forEach((delay) => setTimeout(sync, delay));
})();
