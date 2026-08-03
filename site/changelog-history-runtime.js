(() => {
  const VERSION = "1.119.7";
  const RELEASES_URL = `/releases.json?v=${VERSION}`;
  const previous = window.__mflChangelogHistoryRuntime;
  const expandedMinors = new Set();

  document.querySelectorAll(".changelogMinorSection.is-expanded .changelogMinorVersion").forEach((label) => {
    const minor = String(label.textContent || "").trim().replace(/^v/, "");
    if (minor) expandedMinors.add(minor);
  });
  if (!expandedMinors.size) expandedMinors.add("1.119");

  previous?.destroy?.();

  let observer = null;
  let frame = 0;
  let syncing = false;
  let releases = [];
  let releaseKey = "";
  let groups = new Map();

  function loadReleases() {
    const request = new XMLHttpRequest();
    request.open("GET", RELEASES_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      throw new Error(`Could not load release history (${request.status}).`);
    }
    const parsed = JSON.parse(request.responseText);
    if (!Array.isArray(parsed) || !parsed.length
        || parsed.some((entry) => !Array.isArray(entry) || entry.length !== 2)) {
      throw new Error("Release history is invalid.");
    }
    releases = parsed;
    releaseKey = JSON.stringify(releases);
    groups = groupedReleases();
  }

  function groupedReleases() {
    const result = new Map();
    releases.forEach(([version, description]) => {
      const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
      if (!match) return;
      const minor = `${match[1]}.${match[2]}`;
      if (!result.has(minor)) result.set(minor, []);
      result.get(minor).push({ version, description });
    });
    return result;
  }

  function minorFromSection(section) {
    return String(section?.querySelector(":scope > .changelogMinorToggle .changelogMinorVersion")?.textContent || "")
      .trim()
      .replace(/^v/, "");
  }

  function setSectionExpanded(section, button, expanded) {
    section.classList.toggle("is-expanded", expanded);
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    const minor = minorFromSection(section);
    if (!minor) return;
    if (expanded) expandedMinors.add(minor);
    else expandedMinors.delete(minor);
  }

  function onToggleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(".changelogMinorToggle");
    const section = button?.closest(".changelogMinorSection");
    const list = section?.closest(".changelogList");
    if (!button || !section || !list) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setSectionExpanded(section, button, !section.classList.contains("is-expanded"));
  }

  function buildList(list) {
    const fragment = document.createDocumentFragment();
    let sectionIndex = 0;

    groups.forEach((patches, minor) => {
      const section = document.createElement("li");
      section.className = "changelogMinorSection";
      const expanded = expandedMinors.has(minor) || (sectionIndex === 0 && expandedMinors.size === 0);
      if (expanded) section.classList.add("is-expanded");

      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");

      const title = document.createElement("span");
      title.className = "changelogMinorVersion";
      title.textContent = `v${minor}`;

      const meta = document.createElement("span");
      meta.className = "changelogMinorMeta";
      meta.textContent = `${patches.length} ${patches.length === 1 ? "patch" : "patches"}`;

      const chevron = document.createElement("span");
      chevron.className = "changelogMinorChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = ">";
      toggle.append(title, meta, chevron);

      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patchList = document.createElement("ol");
      patchList.className = "changelogPatchList";

      patches.forEach(({ version, description }) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        const text = document.createElement("p");
        label.textContent = version;
        text.textContent = description;
        item.append(label, text);
        patchList.appendChild(item);
      });

      inner.appendChild(patchList);
      panel.appendChild(inner);
      section.append(toggle, panel);
      fragment.appendChild(section);
      sectionIndex += 1;
    });

    list.replaceChildren(fragment);
    list.dataset.sectioned = "true";
    list.dataset.completeReleaseVersion = VERSION;
    list.dataset.rewrittenReleaseVersion = VERSION;
    list.dataset.rewrittenHistoryKey = releaseKey;
  }

  function listMatches(list) {
    if (list.dataset.rewrittenHistoryKey !== releaseKey) return false;
    const items = Array.from(list.querySelectorAll(".changelogPatchList > li"));
    if (items.length !== releases.length) return false;
    return items.every((item, index) => {
      const [version, description] = releases[index];
      return String(item.querySelector(":scope > span")?.textContent || "").trim() === version
        && String(item.querySelector(":scope > p")?.textContent || "").trim() === description;
    });
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
      if (!listMatches(list)) buildList(list);
    } finally {
      syncing = false;
    }
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  }

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    document.removeEventListener("click", onToggleClick, true);
  }

  try {
    loadReleases();
    document.addEventListener("click", onToggleClick, true);
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.__mflChangelogHistoryRuntime = {
      version: VERSION,
      releases: Object.freeze(releases.map((entry) => Object.freeze([...entry]))),
      sync,
      destroy,
    };

    sync();
    [0, 50, 150, 400, 1000, 2000, 5000].forEach((delay) => setTimeout(sync, delay));
  } catch (error) {
    console.error(error?.message || "Could not initialize Changelog history.");
  }
})();
