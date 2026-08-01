(() => {
  const VERSION = "1.119.11";
  const PREVIOUS_RUNTIME = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@b18df9adc1282923b834bb421c6f28a504505bfb/site/mfl-season-ratios-runtime.js";
  const RELEASES = [
    ["v1.119.11", "Render Changelog before summary and account startup"],
    ["v1.119.10", "Finish the data-free Changelog boot and round the loading placeholder row"],
    ["v1.119.9", "Round the rendered loading table bottom and show Changelog immediately on refresh"],
  ];

  let scheduled = false;

  function installStyles() {
    let style = document.getElementById("mflDirectChangelogReleaseStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflDirectChangelogReleaseStyles";
      document.head.appendChild(style);
    }

    style.textContent = `
      html.mflRelease111Ready body .siteFooter.siteFooter a[href="/changelog"]::before {
        content: "MFL Front Office v${VERSION}" !important;
        display: inline !important;
        font-size: 14px !important;
      }
    `;
  }

  function syncVersion() {
    const root = document.documentElement;
    root.classList.add("mflRelease111Ready");
    root.dataset.mflReleaseVersion = VERSION;

    const link = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (link) {
      link.setAttribute("href", "/changelog");
      link.dataset.releaseLabel = `MFL Front Office v${VERSION}`;
      link.setAttribute("aria-label", `MFL Front Office v${VERSION}, open Changelog`);
    }

    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.dataset.mflReleaseVersion = VERSION;
      element.textContent = `v${VERSION}`;
    });
  }

  function syncReleaseEntries() {
    const list = document.querySelector(".changelogList");
    if (!list) return false;

    const section = Array.from(list.querySelectorAll(".changelogMinorSection"))
      .find((candidate) => String(candidate.querySelector(".changelogMinorVersion")?.textContent || "").trim() === "v1.119");
    const patches = section?.querySelector(".changelogPatchList");
    if (!patches) return false;

    RELEASES.slice().reverse().forEach(([label, description]) => {
      const exists = Array.from(patches.querySelectorAll(":scope > li > span"))
        .some((version) => String(version.textContent || "").trim() === label);
      if (exists) return;

      const item = document.createElement("li");
      const version = document.createElement("span");
      const text = document.createElement("p");
      version.textContent = label;
      text.textContent = description;
      item.append(version, text);
      patches.prepend(item);
    });

    const count = patches.querySelectorAll(":scope > li").length;
    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) meta.textContent = `${count} ${count === 1 ? "patch" : "patches"}`;
    return true;
  }

  function maintain() {
    installStyles();
    syncVersion();
    syncReleaseEntries();
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
    attributeFilter: ["class", "data-mfl-release-version"],
    childList: true,
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
