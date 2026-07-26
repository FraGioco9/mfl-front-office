const fs = require("node:fs");
const path = require("node:path");

const VERSION = "1.149.69";

const PATCH = String.raw`

/* v1.149.69 runtime fixes */
(() => {
  const currentVersion = "${VERSION}";

  function syncVisibleVersion() {
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.textContent = `v${currentVersion}`;
    });

    let footer = document.querySelector(".siteFooter, body > footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "siteFooter runtimeVersionFooter";
      document.body.appendChild(footer);
    }

    let version = footer.querySelector("[data-app-version]");
    if (!version) {
      version = document.createElement("span");
      version.dataset.appVersion = "";
      footer.appendChild(version);
    }
    version.textContent = `v${currentVersion}`;

    const changelog = document.querySelector(".changelogList");
    if (changelog && !Array.from(changelog.querySelectorAll("li span")).some((item) => item.textContent === `v${currentVersion}`)) {
      const entry = document.createElement("li");
      entry.innerHTML = `<span>v${currentVersion}</span><p>Keep every table column visible during sidebar transitions and wait for player data before rendering player pages</p>`;
      changelog.prepend(entry);
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .runtimeVersionFooter {
      display: flex;
      justify-content: center;
      padding: 10px 16px 18px;
      color: var(--muted, #8f98aa);
      font-size: 13px;
    }
    .appShell.menuAnimating .tableScroller table,
    .appShell.menuAnimating .tableScroller col,
    .appShell.menuAnimating .tableScroller th,
    .appShell.menuAnimating .tableScroller td {
      visibility: visible !important;
      opacity: 1 !important;
    }
    .appShell.menuAnimating .tableScroller th,
    .appShell.menuAnimating .tableScroller td,
    .appShell.menuAnimating .tableScroller a,
    .appShell.menuAnimating .tableScroller button {
      transition: none !important;
    }
    .appShell.menuAnimating .tableScroller {
      overflow-x: clip;
    }
  `;
  document.head.appendChild(style);

  syncVisibleVersion();
  document.addEventListener("DOMContentLoaded", syncVisibleVersion, { once: true });

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function stableBuildTableColGroup(...args) {
      if (appShell?.classList.contains("menuAnimating") && tableColGroup?.children.length) {
        return tableColGroup;
      }
      return originalBuildTableColGroup.apply(this, args);
    };

    if (typeof toggleMenu === "function") {
      const originalToggleMenu = toggleMenu;
      toggleMenu = function stableToggleMenu(...args) {
        const result = originalToggleMenu.apply(this, args);
        window.setTimeout(() => {
          originalBuildTableColGroup();
          if (typeof renderTable === "function" && typeof tablePageKey === "function" && tablePageKey()) {
            renderTable();
          }
        }, 230);
        return result;
      };
    }
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    let pendingPlayerId = "";
    let pendingTimer = 0;

    renderPlayerPage = function dataAwareRenderPlayerPage(playerId) {
      const id = String(playerId || "");
      const row = typeof rowByPlayerId === "function" ? rowByPlayerId(id) : null;

      if (!row && !state.dataLoaded) {
        pendingPlayerId = id;
        if (playerDetail) {
          playerDetail.innerHTML = `<div class="emptyState">Loading player...</div>`;
        }

        window.clearInterval(pendingTimer);
        const startedAt = Date.now();
        pendingTimer = window.setInterval(() => {
          const loadedRow = typeof rowByPlayerId === "function" ? rowByPlayerId(pendingPlayerId) : null;
          if (loadedRow || state.dataLoaded || Date.now() - startedAt > 20000) {
            window.clearInterval(pendingTimer);
            pendingTimer = 0;
            originalRenderPlayerPage(pendingPlayerId);
          }
        }, 50);
        return;
      }

      originalRenderPlayerPage(id);
    };
  }
})();
`;

module.exports = (request, response) => {
  try {
    const appPath = path.join(process.cwd(), "app.js");
    const source = fs.readFileSync(appPath, "utf8");
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    response.status(200).send(`${source}${PATCH}`);
  } catch (error) {
    response.status(500).send(`console.error(${JSON.stringify("Could not load application bundle.")});`);
  }
};
