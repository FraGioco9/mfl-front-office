(() => {
  "use strict";

  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-player-label-v1:";
  const EVALUATION_PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
  const PROFILE_LABELS = ["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract"];
  const ATTRIBUTE_LABELS = ["Overall", "Pace", "Dribbling", "Shooting", "Defense", "Passing", "Physical"];
  const ATTRIBUTE_VIEWS = ["Attributes", "Training", "Next Overall", "Current Season", "All Time"];
  let renderingSkeleton = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function playerIdFromPath() {
    const match = String(window.location.pathname || "").match(/^\/players\/([^/]+)\/?$/i);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return String(match[1] || "").trim();
    }
  }

  function playerIdFromHref(href) {
    try {
      const url = new URL(String(href || ""), window.location.origin);
      if (url.origin !== window.location.origin) return "";
      const match = url.pathname.match(/^\/players\/([^/]+)\/?$/i);
      return match ? decodeURIComponent(match[1]).trim() : "";
    } catch {
      return "";
    }
  }

  function storePlayerName(playerId, playerName) {
    const id = String(playerId || "").trim();
    const name = String(playerName || "").trim();
    if (!id || !name) return;
    try {
      localStorage.setItem(`${PLAYER_LABEL_STORAGE_PREFIX}${id}`, name);
    } catch {
      // First paint still works when browser storage is unavailable.
    }
  }

  function storedPlayerName(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return "";
    try {
      return String(
        localStorage.getItem(`${PLAYER_LABEL_STORAGE_PREFIX}${id}`)
        || localStorage.getItem(`${EVALUATION_PLAYER_LABEL_STORAGE_PREFIX}${id}`)
        || "",
      ).trim();
    } catch {
      return "";
    }
  }

  function rememberRenderedPlayerName(playerId, detail) {
    const name = detail?.querySelector?.(".playerTitleName")?.textContent?.trim() || "";
    storePlayerName(playerId, name);
  }

  function rememberNavigationPlayerName(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const playerLink = target.closest("a.playerNameLink[href]");
    if (playerLink instanceof HTMLAnchorElement) {
      storePlayerName(playerIdFromHref(playerLink.href), playerLink.textContent);
      return;
    }

    const searchResult = target.closest('.searchResult[data-search-key^="player:"]');
    if (!(searchResult instanceof HTMLElement)) return;
    const key = String(searchResult.dataset.searchKey || "");
    const playerId = key.startsWith("player:") ? key.slice("player:".length).trim() : "";
    const playerName = searchResult.querySelector("strong")?.textContent || "";
    storePlayerName(playerId, playerName);
  }

  function storedWalletOptIn() {
    return document.documentElement.dataset.storedWalletOptIn === "true";
  }

  function profileCardsMarkup() {
    return PROFILE_LABELS.map((label) => `
      <div${label === "Contract" ? ' class="contractDetailCard"' : ""}>
        <span>${label}</span>
        <strong class="mflPlayerLoadingEmptyValue" aria-hidden="true">&nbsp;</strong>
      </div>
    `).join("");
  }

  function attributeCardsMarkup() {
    return ATTRIBUTE_LABELS.map((label) => `
      <div class="playerAttributeCard mflPlayerLoadingAttributeCard">
        <span>${label}</span>
        <strong class="mflPlayerLoadingEmptyValue" aria-hidden="true">&nbsp;</strong>
      </div>
    `).join("");
  }

  function attributeViewsMarkup() {
    return ATTRIBUTE_VIEWS.map((label) => `<span class="playerAttributeViewButton mflPlayerLoadingView">${label}</span>`).join("");
  }

  function actionBoxesMarkup() {
    const count = storedWalletOptIn() ? 3 : 2;
    return Array.from({ length: count }, () => '<span class="mflPlayerLoadingAction" aria-hidden="true"></span>').join("");
  }

  function playerLoadingMarkup(playerId) {
    const id = escapeHtml(playerId);
    const playerName = storedPlayerName(playerId);
    const nameMarkup = playerName
      ? `<span class="playerTitleName">${escapeHtml(playerName)}</span>`
      : '<span class="playerTitleName mflPlayerLoadingEmptyName" aria-hidden="true">&nbsp;</span>';
    const notesMarkup = storedWalletOptIn()
      ? `
        <div class="playerPanel playerNotesPanel">
          <h3>Notes</h3>
          <div class="playerNotesInputWrap">
            <textarea class="playerNotesInput mflPlayerLoadingNotes" aria-hidden="true" disabled></textarea>
          </div>
        </div>
      `
      : "";

    return `
      <section class="playerHero" data-mfl-player-loading-shell="true" aria-busy="true">
        <div>
          <span class="playerEyebrow playerIdText">ID #${id}</span>
          <h2 class="playerTitle">${nameMarkup}</h2>
          <p><span class="mflPlayerLoadingEmptyPosition" aria-hidden="true">&nbsp;</span></p>
        </div>
        <div class="playerHeroActions">${actionBoxesMarkup()}</div>
      </section>
      <section class="playerGrid" data-mfl-player-loading-grid="true">
        <div class="playerStack">
          <div class="playerPanel playerInfoPanel">
            <h3>Profile</h3>
            <div class="detailGrid">${profileCardsMarkup()}</div>
          </div>
          <div class="playerPanel attributesPanel">
            <div class="playerPanelHeader">
              <h3>Attributes</h3>
              <div class="playerAttributeViews">${attributeViewsMarkup()}</div>
            </div>
            <div class="attributeGrid">${attributeCardsMarkup()}</div>
          </div>
          ${notesMarkup}
        </div>
        <div class="playerPanel pitchPanel">
          <h3>Positions</h3>
          <div class="pitch mflPlayerLoadingPitch" aria-hidden="true"></div>
        </div>
      </section>
    `;
  }

  function installStyles() {
    if (document.getElementById("mflPlayerLoadingStyles")) return;
    const style = document.createElement("style");
    style.id = "mflPlayerLoadingStyles";
    style.textContent = `
      #playerDetail .mflPlayerLoadingEmptyValue,
      #playerDetail .mflPlayerLoadingEmptyName,
      #playerDetail .mflPlayerLoadingEmptyPosition {
        visibility: hidden;
      }

      #playerDetail .mflPlayerLoadingAction {
        display: block;
        width: 172px;
        min-width: 172px;
        height: 40px;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--surface-muted);
      }

      #playerDetail .mflPlayerLoadingView {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }

      #playerDetail .mflPlayerLoadingAttributeCard {
        cursor: default;
      }

      #playerDetail .mflPlayerLoadingNotes {
        pointer-events: none;
        resize: none;
      }

      #playerDetail .mflPlayerLoadingPitch {
        background: var(--surface-muted);
        border-color: var(--border);
        box-shadow: none;
      }
    `;
    document.head.appendChild(style);
  }

  function renderSkeleton({ force = false } = {}) {
    if (renderingSkeleton) return false;
    const playerId = playerIdFromPath();
    const detail = document.getElementById("playerDetail");
    if (!playerId || !(detail instanceof HTMLElement)) return false;

    const realHero = detail.querySelector(".playerHero:not([data-mfl-player-loading-shell])");
    if (realHero) {
      rememberRenderedPlayerName(playerId, detail);
      return false;
    }

    if (detail.querySelector('[data-mfl-player-loading-shell="true"]')) return true;
    const loadingText = String(detail.textContent || "").trim();
    const loadingPlaceholder = !detail.children.length || loadingText === "Loading player...";
    if (!force && !loadingPlaceholder) return false;

    renderingSkeleton = true;
    try {
      detail.innerHTML = playerLoadingMarkup(playerId);
      detail.dataset.mflPlayerLoading = "true";
    } finally {
      renderingSkeleton = false;
    }
    return true;
  }

  function syncPlayerLoadingState() {
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement)) return;
    const playerId = playerIdFromPath();
    if (!playerId) return;

    const realHero = detail.querySelector(".playerHero:not([data-mfl-player-loading-shell])");
    if (realHero) {
      rememberRenderedPlayerName(playerId, detail);
      delete detail.dataset.mflPlayerLoading;
      return;
    }

    if (detail.querySelector('[data-mfl-player-loading-shell="true"]')) return;
    const text = String(detail.textContent || "").trim();
    if (!detail.children.length || text === "Loading player...") renderSkeleton();
  }

  document.addEventListener("click", rememberNavigationPlayerName, true);
  installStyles();
  renderSkeleton({ force: true });

  const playerDetail = document.getElementById("playerDetail");
  if (playerDetail instanceof HTMLElement) {
    const observer = new MutationObserver(() => queueMicrotask(syncPlayerLoadingState));
    observer.observe(playerDetail, { childList: true });
  }

  window.addEventListener("popstate", () => queueMicrotask(() => renderSkeleton({ force: true })));
})();
