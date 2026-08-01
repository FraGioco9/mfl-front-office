(() => {
  const VERSION = "1.119.12";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@0c70e9157c96a9b542022e8ae28e361783918436/site/mfl-season-ratios-runtime.js";
  const RELEASES = [
    ["v1.119.12", "Show the current footer version and complete Changelog on first paint"],
    ["v1.119.11", "Render Changelog before summary and account startup"],
    ["v1.119.10", "Finish the data-free Changelog boot and round the loading placeholder row"],
    ["v1.119.9", "Round the rendered loading table bottom and show Changelog immediately on refresh"],
    ["v1.119.8", "Keep the last rendered table row rounded while loading"],
    ["v1.119.7", "Complete Changelog history, disable the current-page footer link, and keep loading table bottoms square"],
    ["v1.119.6", "Reveal rows as soon as data renders, keep loading headers square, and restore the native Changelog link"],
    ["v1.119.5", "Keep the footer stable, restore Changelog navigation, and square loading table bottoms"],
    ["v1.119.4", "Prevent stale table rows and keep footer navigation stable"],
    ["v1.119.3", "Keep table header bottom corners square while loading"],
    ["v1.119.2", "Show a stable footer version immediately after loading"],
    ["v1.119.1", "Restore the Changelog footer link and synchronize the displayed version"],
    ["v1.119.0", "Optimize paged data loading, cache responses, and link player contract clubs"],
    ["v1.118.33", "Preserve native MFL Stats filters, keep the loading cursor, and link player contract teams"],
    ["v1.118.32", "Make player contract teams native links and restore MFL Stats filter clicks"],
    ["v1.118.31", "Remove the legacy Evaluation rate, stabilize Stats filters, and link player contracts"],
    ["v1.118.30", "Remove the legacy Evaluation rate, link player contracts, and restore MFL Stats controls"],
    ["v1.118.29", "Restore native MFL Stats filter interactions after loading"],
    ["v1.118.28", "Prevent Evaluation refresh stalls and require Supabase for the Discount Rate"],
    ["v1.118.27", "Restore immediate Home startup while keeping Evaluation and MFL Stats fixes route-scoped"],
    ["v1.118.26", "Prevent Evaluation value flashes, synchronize the Load action, and stabilize MFL Stats controls"],
    ["v1.118.25", "Link contract teams, reveal the Evaluation Load action early, and restore Stats filter clicks"],
    ["v1.118.24", "Prevent Home boot stalls and keep route fixes scoped to their pages"],
    ["v1.118.23", "Prevent false player-not-found flashes, link contract teams, and reveal the Evaluation shell immediately"],
    ["v1.118.22", "Keep player routes loading, link teams, restore Stats controls, and reveal the Evaluation shell"],
    ["v1.118.21", "Fix tooltip placement, player team links, Stats loading controls, and the Evaluation loading shell"],
    ["v1.118.20", "Keep tooltips clear of the header, link player teams, restore Stats filters, and reveal Evaluation together"],
    ["v1.118.19", "Reset Evaluation routes, link player teams, align loading UI, and restore MFL Stats filters"],
    ["v1.118.18", "Remove loading header rounding, prevent Evaluation flashes, and restore MFL Stats filters"],
    ["v1.118.17", "Restore Evaluation metric formatting, hide Load on player routes, and enable MFL Stats filters"],
    ["v1.118.16", "Synchronize the Evaluation discount-rate display with the active calculation"],
    ["v1.118.15", "Preserve Evaluation player and share routes and restore Stats filters"],
    ["v1.118.14", "Keep the Evaluation search inactive when a player is selected"],
    ["v1.118.13", "Allow opted-out evaluation shares, restore Stats filters, and focus empty Evaluation search"],
    ["v1.118.12", "Animate the discount tooltip, restore Stats filters, and support local season ratios"],
    ["v1.118.11", "Fix Evaluation tooltip placement, Stats filters, and Season 16 discount history"],
    ["v1.118.10", "Fix Evaluation tooltip, Stats interactions, footer timing, and season ratios"],
    ["v1.118.9", "Restore MFL Stats interactions after loading"],
    ["v1.118.8", "Complete SemVer changelog history and keep the latest version current"],
    ["v1.118.7", "Enforce API limits, lock loading views, and rebuild version history"],
    ["v1.118.6", "Show the content-area scrollbar from the first page render"],
    ["v1.118.5", "Extend the global shell to the right edge and keep version UI current"],
    ["v1.118.4", "Keep page scrollbars between the header and footer and sync the latest version"],
    ["v1.118.3", "Layer Evaluation search results above page content"],
    ["v1.118.2", "Fix Evaluation tooltip and empty height; cap MFL API at 50/min"],
    ["v1.118.1", "Keep the Evaluation header sticky and focus empty player search"],
    ["v1.118.0", "Use Supabase season ratios for Evaluation discount rates"],
    ["v1.117.6", "Keep Search, Advanced Settings, and Saved Evaluations above page content"],
    ["v1.117.5", "Keep Search and Advanced Settings above page content"],
    ["v1.117.4", "Extend the empty Evaluation page to the footer"],
    ["v1.117.3", "Layer Evaluation search results above page content without changing overflow"],
    ["v1.117.2", "Keep Evaluation search results above page content"],
  ];

  let scheduled = false;
  let rebuilding = false;

  function installStyles() {
    let style = document.getElementById("mflAuthoritativeReleaseStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflAuthoritativeReleaseStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html.mflRelease112Ready body .siteFooter.siteFooter a[href="/changelog"]::before,
      html[data-mfl-release-version="${VERSION}"] body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "MFL Front Office v${VERSION}" !important;
        display: inline !important;
        font-size: 14px !important;
      }
    `;
  }

  function syncVersion() {
    const root = document.documentElement;
    root.classList.add("mflRelease112Ready");
    root.dataset.mflReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) {
      const label = `MFL Front Office v${VERSION}`;
      if (footer.textContent !== label) footer.textContent = label;
      if (footer.getAttribute("href") !== "/changelog") footer.setAttribute("href", "/changelog");
      footer.dataset.releaseLabel = label;
      footer.setAttribute("aria-label", `${label}, open Changelog`);
    }

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.dataset.mflReleaseVersion = VERSION;
      if (element.textContent !== `v${VERSION}`) element.textContent = `v${VERSION}`;
    });
  }

  function semver(value) {
    const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function collectEntries(list) {
    const entries = new Map();
    list.querySelectorAll(".changelogPatchList > li, :scope > li:not(.changelogMinorSection)").forEach((item) => {
      const label = String(item.querySelector(":scope > span")?.textContent || "").trim();
      const description = String(item.querySelector(":scope > p")?.textContent || "").trim();
      if (!semver(label)) return;
      entries.set(label.startsWith("v") ? label : `v${label}`, description);
    });
    RELEASES.forEach(([label, description]) => entries.set(label, description));
    return entries;
  }

  function createSection(minor, patches, expanded) {
    const section = document.createElement("li");
    section.className = "changelogMinorSection";
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

    patches.forEach(({ label, description }) => {
      const item = document.createElement("li");
      const version = document.createElement("span");
      const text = document.createElement("p");
      version.textContent = label;
      text.textContent = description;
      item.append(version, text);
      patchList.appendChild(item);
    });

    inner.appendChild(patchList);
    panel.appendChild(inner);
    section.append(toggle, panel);
    toggle.addEventListener("click", () => {
      const next = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
    });
    return section;
  }

  function syncChangelog() {
    if (rebuilding) return false;
    const list = document.querySelector(".changelogList");
    if (!list) return false;

    const entries = collectEntries(list);
    const renderedCount = list.querySelectorAll(".changelogPatchList > li").length;
    if (list.dataset.completeReleaseVersion === VERSION
        && renderedCount === entries.size
        && list.querySelector(".changelogPatchList > li > span")?.textContent === `v${VERSION}`) {
      return true;
    }

    const groups = new Map();
    entries.forEach((description, label) => {
      const parts = semver(label);
      if (!parts) return;
      const minor = `${parts[0]}.${parts[1]}`;
      if (!groups.has(minor)) groups.set(minor, []);
      groups.get(minor).push({ label, description, patch: parts[2] });
    });

    const sections = [...groups.entries()]
      .sort(([left], [right]) => {
        const a = left.split(".").map(Number);
        const b = right.split(".").map(Number);
        return b[0] - a[0] || b[1] - a[1];
      })
      .map(([minor, patches], index) => {
        patches.sort((a, b) => b.patch - a.patch);
        return createSection(minor, patches, index === 0);
      });

    rebuilding = true;
    list.replaceChildren(...sections);
    list.dataset.sectioned = "true";
    list.dataset.completeReleaseVersion = VERSION;
    rebuilding = false;
    return true;
  }

  function maintain() {
    installStyles();
    syncVersion();
    syncChangelog();
  }

  function schedule() {
    if (scheduled || rebuilding) return;
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
    attributeFilter: ["class", "href", "data-page", "data-mfl-release-version", "data-complete-release-version"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  [0, 50, 200, 750, 2000].forEach((delay) => setTimeout(maintain, delay));

  const previous = document.createElement("script");
  previous.src = PREVIOUS_RUNTIME;
  previous.async = false;
  previous.addEventListener("load", () => {
    maintain();
    [0, 50, 250, 1000].forEach((delay) => setTimeout(maintain, delay));
  }, { once: true });
  previous.addEventListener("error", maintain, { once: true });
  document.head.appendChild(previous);
})();
