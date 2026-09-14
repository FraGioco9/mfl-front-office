(() => {
  "use strict";

  const VERSION = String(window.__mflRelease?.version || window.__mflReleaseVersion || "dev");
  const assetUrl = typeof window.__mflAssetUrl === "function"
    ? window.__mflAssetUrl
    : (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;
  const RELEASES_URL = assetUrl("releases.json");
  const expandedMinors = new Set();

  document.querySelectorAll(".changelogMinorSection.is-expanded .changelogMinorVersion").forEach((label) => {
    const minor = String(label.textContent || "").trim().replace(/^v/, "");
    if (minor) expandedMinors.add(minor);
  });

  window.__mflChangelogHistoryRuntime?.destroy?.();

  let destroyed = false;
  let releases = [];

  function versionParts(value) {
    const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareVersionsDescending(left, right) {
    const a = versionParts(left) || [0, 0, 0];
    const b = versionParts(right) || [0, 0, 0];
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
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

  async function loadReleases() {
    const response = await fetch(RELEASES_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Could not load release history (${response.status}).`);

    const parsed = await response.json();
    if (!Array.isArray(parsed) || !parsed.length
        || parsed.some((entry) => !Array.isArray(entry) || entry.length !== 2)) {
      throw new Error("Release history is invalid.");
    }

    const merged = new Map();
    parsed.forEach(([version, description]) => {
      if (!versionParts(version) || merged.has(version)) return;
      merged.set(version, String(description || ""));
    });
    releases = Array.from(merged.entries()).sort((left, right) => compareVersionsDescending(left[0], right[0]));

    if (!expandedMinors.size && releases.length) {
      const parts = versionParts(releases[0][0]);
      if (parts) expandedMinors.add(`${parts[0]}.${parts[1]}`);
    }
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
    if (!(button instanceof HTMLButtonElement) || !(section instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setSectionExpanded(section, button, !section.classList.contains("is-expanded"));
  }

  function buildList() {
    const list = document.querySelector(".changelogList");
    if (!(list instanceof HTMLElement)) return false;
    const fragment = document.createDocumentFragment();

    groupedReleases().forEach((patches, minor) => {
      const section = document.createElement("li");
      section.className = "changelogMinorSection";
      const expanded = expandedMinors.has(minor);
      section.classList.toggle("is-expanded", expanded);

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
    });

    list.replaceChildren(fragment);
    list.dataset.sectioned = "true";
    list.dataset.completeReleaseVersion = VERSION;
    list.dataset.releaseHistoryVersion = VERSION;
    delete list.dataset.historyLoading;
    list.hidden = false;
    return true;
  }

  function showLoadError() {
    const list = document.querySelector(".changelogList");
    if (!(list instanceof HTMLElement)) return;
    const item = document.createElement("li");
    item.className = "emptyState";
    item.textContent = "Could not load Changelog history.";
    list.replaceChildren(item);
    delete list.dataset.historyLoading;
    list.hidden = false;
  }

  function destroy() {
    destroyed = true;
    document.removeEventListener("click", onToggleClick, true);
  }

  async function initialize() {
    try {
      await loadReleases();
      if (destroyed) return false;
      buildList();
      document.addEventListener("click", onToggleClick, true);
      window.__mflChangelogHistoryRuntime = Object.freeze({
        version: VERSION,
        releases: Object.freeze(releases.map((entry) => Object.freeze([...entry]))),
        destroy,
      });
      return true;
    } catch (error) {
      console.error(error?.message || "Could not initialize Changelog history.");
      if (!destroyed) showLoadError();
      return false;
    }
  }

  window.__mflChangelogHistoryReady = initialize();
})();
