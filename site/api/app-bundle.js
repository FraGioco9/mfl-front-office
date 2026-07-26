const fs = require("node:fs");
const path = require("node:path");

function runtimeFix() {
  const currentVersion = "1.149.70";

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
    const exists = changelog && Array.from(changelog.querySelectorAll("li span"))
      .some((item) => item.textContent === `v${currentVersion}`);
    if (changelog && !exists) {
      const entry = document.createElement("li");
      entry.innerHTML = `<span>v${currentVersion}</span><p>Stabilize all table columns during sidebar transitions and reliably load player pages</p>`;
      changelog.prepend(entry);
    }
  }

  const style = document.createElement("style");
  style.textContent = [
    ".runtimeVersionFooter{display:flex;justify-content:center;padding:10px 16px 18px;color:var(--muted,#8f98aa);font-size:13px}",
    ".appShell.menuAnimating .tableScroller table,.appShell.menuAnimating .tableScroller col,.appShell.menuAnimating .tableScroller th,.appShell.menuAnimating .tableScroller td{visibility:visible!important;opacity:1!important}",
    ".appShell.menuAnimating .tableScroller th,.appShell.menuAnimating .tableScroller td,.appShell.menuAnimating .tableScroller a,.appShell.menuAnimating .tableScroller button{transition:none!important}",
    ".appShell.menuAnimating .tableScroller{overflow-x:hidden!important}"
  ].join("");
  document.head.appendChild(style);

  syncVisibleVersion();
  document.addEventListener("DOMContentLoaded", syncVisibleVersion, { once: true });

  let frozenColumns = null;
  let animationTimer = 0;

  if (typeof currentViewColumns === "function") {
    const originalCurrentViewColumns = currentViewColumns;
    currentViewColumns = function stableCurrentViewColumns(...args) {
      if (frozenColumns) {
        return [...frozenColumns];
      }
      return originalCurrentViewColumns.apply(this, args);
    };

    if (typeof toggleMenu === "function") {
      const originalToggleMenu = toggleMenu;
      toggleMenu = function stableToggleMenu(...args) {
        frozenColumns = [...originalCurrentViewColumns()];
        window.clearTimeout(animationTimer);
        const result = originalToggleMenu.apply(this, args);
        animationTimer = window.setTimeout(() => {
          frozenColumns = null;
          if (typeof buildHeader === "function") {
            buildHeader();
          }
          if (typeof applyFilters === "function" && typeof tablePageKey === "function" && tablePageKey()) {
            applyFilters();
          }
        }, 240);
        return result;
      };
    }
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function stableBuildTableColGroup(...args) {
      if (frozenColumns && tableColGroup?.children.length) {
        return tableColGroup;
      }
      return originalBuildTableColGroup.apply(this, args);
    };
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    let pendingToken = 0;

    renderPlayerPage = function dataAwareRenderPlayerPage(playerId) {
      const id = String(playerId || "");
      const row = typeof rowByPlayerId === "function" ? rowByPlayerId(id) : null;
      const dataIsChanging = Boolean(state.dataLoadPromise) || !state.dataLoaded || !state.rows.length;

      if (row || !dataIsChanging) {
        originalRenderPlayerPage(id);
        return;
      }

      const token = ++pendingToken;
      if (playerDetail) {
        playerDetail.innerHTML = '<div class="emptyState">Loading player...</div>';
      }

      const startedAt = Date.now();
      const checkPlayer = () => {
        if (token !== pendingToken || state.currentPage !== "player") {
          return;
        }

        const loadedRow = typeof rowByPlayerId === "function" ? rowByPlayerId(id) : null;
        const stillLoading = Boolean(state.dataLoadPromise) || !state.dataLoaded || !state.rows.length;

        if (loadedRow || !stillLoading || Date.now() - startedAt >= 30000) {
          originalRenderPlayerPage(id);
          return;
        }

        window.setTimeout(checkPlayer, 50);
      };

      window.setTimeout(checkPlayer, 50);
    };
  }
}

const PATCH = `\n;(${runtimeFix.toString()})();\n`;

module.exports = (request, response) => {
  try {
    const source = fs.readFileSync(path.join(process.cwd(), "app.js"), "utf8");
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    response.status(200).send(source + PATCH);
  } catch (error) {
    response.status(500).send(`console.error(${JSON.stringify("Could not load application bundle.")});`);
  }
};