// @ts-check

import {
  extractRequiredSection,
  extractRequiredSections,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  normalizeSplitterInput,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const PLAYER_SECTIONS = [
  ["function renderPitch(row) {", "function playerPositions(row) {", "Player pitch renderer"],
  ["function playerTrainingKey(row) {", "function primaryPreciseOverall(row) {", "Player training and attribute configuration"],
  ["function nextOverallDetailHtml(row, column) {", "async function copyPlayerId(id) {", "Player attribute panel renderer"],
];

const PLAYER_ROUTE_ONLY_FUNCTIONS = [
  "showPlayerNoteTooltip",
  "setPlayerNote",
  "normalizePlayerAttributeView",
  "formatFootedness",
  "rarityColorForOverall",
  "shortStatLabel",
  "playerNoteIconHtml",
  "measureTooltipAnchorWidth",
  "queueWalletNotesSave",
  "allowedPlayerAttributeViews",
  "toggleWatchlistPlayer",
  "createWatchlistStar",
];

const PLAYER_CONTRACT_LINK_FUNCTIONS = ["contractClubId", "bindContractTeamLink"];
const PLAYER_CONTRACT_LINK_WRAPPER = `  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithStableContractLink(playerId) {
      const result = originalRenderPlayerPage.apply(this, arguments);
      bindContractTeamLink(playerId);
      return result;
    };
  }
`;

const PLAYER_FIRST_PAINT_RUNTIME = String.raw`(() => {
  "use strict";

  const PLAYER_PORTRAIT_ORIGIN = "https://d13e14gtps4iwl.cloudfront.net";
  const PLAYER_EXTERNAL_ORIGIN = "https://app.playmfl.com";
  const PLAYER_PORTRAIT_CROP_HEIGHT_PX = 500;
  const PLAYER_PORTRAIT_SOURCE_WIDTH_PX = 912;
  const PLAYER_PORTRAIT_DISPLAY_HEIGHT_PX = 112;
  const PLAYER_HERO_OVERALL_SIZE_PX = 100;
  const PLAYER_HERO_ACTION_MENU_WIDTH_PX = 190;
  const PLAYER_HERO_ACTION_CHEVRON_WIDTH_PX = 34;
  const PLAYER_HERO_PRIMARY_ACTION_WIDTH_PX = 152;
  const PLAYER_HERO_ACTION_HEIGHT_PX = 40;
  const PLAYER_HERO_IDENTITY_WIDTH_PX = 360;
  const PLAYER_HERO_IDENTITY_OVERALL_GAP_PX = 220;
  const PLAYER_HERO_IDENTITY_ACTION_GAP_PX = 16;
  const PLAYER_CONTEXT_CACHE_PREFIX = "mfl-player-first-paint-v1:";
  const PLAYER_NOTE_MAX_LENGTH = 100;
  const PLAYER_DETAIL_REQUIRED_COLUMNS = ["height", "preferred_foot", "goalkeeping", "retirement_years"];
  const PLAYER_READY_TRANSITION = "color 180ms ease, opacity 180ms ease, background-color 180ms ease, border-color 180ms ease";
  const portraitSources = new Map();
  let activeHeroActionMenu = null;
  let pendingDetailPlayerId = "";
  let readyDetailPlayerId = "";
  let readyTransitionPlayerId = "";

  function loadingBlank() {
    return "\u00A0";
  }

  function normalizePlayerId(value) {
    const playerId = String(value || "").trim();
    return /^\d{1,20}$/.test(playerId) ? playerId : "";
  }

  function playerIdFromLocation() {
    const match = String(location.pathname || "").match(/^\/players\/(\d{1,20})\/?$/i);
    return match ? normalizePlayerId(match[1]) : "";
  }

  function normalizePositions(value) {
    if (Array.isArray(value)) return value.map((position) => String(position || "").trim()).filter(Boolean);
    const text = String(value || "").trim();
    return text ? text.split(",").map((position) => position.trim()).filter(Boolean) : [];
  }

  function normalizeKnownValueEntry(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const rawValue = value.raw;
      const rawType = typeof rawValue;
      const raw = rawValue === null || rawValue === undefined
        ? ""
        : (rawType === "string" || rawType === "number" || rawType === "boolean" ? rawValue : String(rawValue));
      const display = String(value.display ?? (raw === "" ? "" : raw)).trim();
      return display || raw !== "" ? { raw, display } : null;
    }
    if (value === null || value === undefined || value === "") return null;
    const rawType = typeof value;
    const raw = rawType === "string" || rawType === "number" || rawType === "boolean" ? value : String(value);
    const display = String(value).trim();
    return display || raw !== "" ? { raw, display } : null;
  }

  function normalizeKnownValues(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const normalized = {};
    Object.entries(source).forEach(([column, entry]) => {
      const known = normalizeKnownValueEntry(entry);
      if (known) normalized[column] = known;
    });
    return normalized;
  }

  function mergeKnownValues(baseValue, nextValue) {
    return {
      ...normalizeKnownValues(baseValue),
      ...normalizeKnownValues(nextValue),
    };
  }

  function knownValue(context, column) {
    return normalizeKnownValueEntry(context?.knownValues?.[column]);
  }

  function knownDisplayValue(context, column) {
    return String(knownValue(context, column)?.display || "").trim();
  }

  function knownRawValue(context, column) {
    const entry = knownValue(context, column);
    return entry ? entry.raw : "";
  }

  function normalizeContext(value) {
    const source = value && typeof value === "object" ? value : {};
    const playerId = normalizePlayerId(source.playerId);
    const knownValues = normalizeKnownValues(source.knownValues);
    const suppliedPositions = normalizePositions(source.positions);
    const cachedPositions = normalizePositions(knownValues.positions?.display || "");
    const suppliedOverall = source.overall === null || source.overall === undefined ? "" : String(source.overall).trim();
    return {
      playerId,
      name: String(source.name || knownValues.name?.display || "").trim(),
      positions: suppliedPositions.length ? suppliedPositions : cachedPositions,
      overall: suppliedOverall || String(knownValues.overall?.display || "").trim(),
      externalUrl: String(source.externalUrl || (playerId ? PLAYER_EXTERNAL_ORIGIN + "/players/" + playerId : "")).trim(),
      knownValues,
    };
  }

  function mergeContext(baseValue, nextValue) {
    const base = normalizeContext(baseValue);
    const next = normalizeContext(nextValue);
    return {
      playerId: next.playerId || base.playerId,
      name: next.name || base.name,
      positions: next.positions.length ? next.positions : base.positions,
      overall: next.overall || base.overall,
      externalUrl: next.externalUrl || base.externalUrl,
      knownValues: mergeKnownValues(base.knownValues, next.knownValues),
    };
  }

  function cacheKey(playerId) {
    return PLAYER_CONTEXT_CACHE_PREFIX + playerId;
  }

  function readCachedContext(playerId) {
    try {
      return normalizeContext(JSON.parse(sessionStorage.getItem(cacheKey(playerId)) || "null"));
    } catch {
      return normalizeContext(null);
    }
  }

  function rememberContext(value) {
    const context = normalizeContext(value);
    if (!context.playerId) return false;
    const current = readCachedContext(context.playerId);
    const merged = mergeContext(current, context);
    try {
      sessionStorage.setItem(cacheKey(context.playerId), JSON.stringify(merged));
    } catch {}
    return true;
  }

  function snapshotRowKnownValues(row) {
    const knownValues = {};
    if (!Array.isArray(row) || !Array.isArray(state.columns)) return knownValues;
    state.columns.forEach((column, index) => {
      if (!column || index >= row.length) return;
      const rawValue = row[index];
      if (rawValue === null || rawValue === undefined || rawValue === "") return;
      const rawType = typeof rawValue;
      const raw = rawType === "string" || rawType === "number" || rawType === "boolean" ? rawValue : String(rawValue);
      let display = "";
      try {
        display = String(formatCellValue(row, column) ?? "").trim();
      } catch {
        display = String(raw).trim();
      }
      if (!display) display = String(raw).trim();
      const known = normalizeKnownValueEntry({ raw, display });
      if (known) knownValues[column] = known;
    });
    return knownValues;
  }

  function portraitUrl(playerIdValue) {
    const playerId = normalizePlayerId(playerIdValue);
    return playerId ? PLAYER_PORTRAIT_ORIGIN + "/players/v2/" + playerId + "/photo.webp" : "";
  }

  function rarityColor(overall) {
    const value = Number(overall || 0);
    if (value >= 95) return "#00ffe9";
    if (value >= 85) return "#fa53ff";
    if (value >= 75) return "#0077ff";
    if (value >= 65) return "#71ff30";
    if (value >= 55) return "#ecd17f";
    return "#bebebe";
  }

  function storedWalletOptIn() {
    return document.documentElement.dataset.storedWalletOptIn === "true";
  }

  function storedProgressionAccess() {
    return document.documentElement.dataset.storedProgressionAccess === "true";
  }

  function beginDetailNavigation(value) {
    const context = normalizeContext(value);
    if (!context.playerId) return false;
    pendingDetailPlayerId = context.playerId;
    readyDetailPlayerId = "";
    if (playerIdFromLocation() !== context.playerId) {
      const targetPlayerId = context.playerId;
      queueMicrotask(() => {
        if (pendingDetailPlayerId !== targetPlayerId || playerIdFromLocation() !== targetPlayerId) return;
        const pendingContext = window.__mflPlayerFirstPaintPendingContext;
        renderPending(
          normalizePlayerId(pendingContext?.playerId) === targetPlayerId ? pendingContext : context,
        );
      });
    }
    return true;
  }

  function markDetailPayloadReady(route, payload) {
    const routePlayerId = route?.scope === "player" ? normalizePlayerId(route.playerId) : "";
    if (!routePlayerId || !payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows)) return false;
    const playerIdIndex = payload.columns.indexOf("player_id");
    const requiredIndexes = PLAYER_DETAIL_REQUIRED_COLUMNS.map((column) => payload.columns.indexOf(column));
    if (playerIdIndex < 0 || requiredIndexes.some((index) => index < 0)) return false;
    readyDetailPlayerId = routePlayerId;
    const matchingRow = payload.rows.find((row) => Array.isArray(row) && normalizePlayerId(row[playerIdIndex]) === routePlayerId);
    return Boolean(matchingRow && matchingRow.length === payload.columns.length);
  }

  function detailDataReady(row, playerIdValue) {
    const playerId = normalizePlayerId(playerIdValue);
    if (!playerId) return false;
    if (pendingDetailPlayerId === playerId && readyDetailPlayerId !== playerId) return false;
    if (!Array.isArray(row)) return pendingDetailPlayerId !== playerId || readyDetailPlayerId === playerId;
    if (!Array.isArray(state.columns) || !state.columns.length) return false;
    const playerIdIndex = state.columns.indexOf("player_id");
    const requiredIndexes = PLAYER_DETAIL_REQUIRED_COLUMNS.map((column) => state.columns.indexOf(column));
    if (playerIdIndex < 0 || requiredIndexes.some((index) => index < 0)) return false;
    const maximumRequiredIndex = Math.max(playerIdIndex, ...requiredIndexes);
    if (row.length !== state.columns.length || row.length <= maximumRequiredIndex) return false;
    return normalizePlayerId(row[playerIdIndex]) === playerId;
  }

  function portraitDisplayHeight() {
    return PLAYER_PORTRAIT_DISPLAY_HEIGHT_PX;
  }

  function sizeHeroOverall(overall) {
    if (!(overall instanceof HTMLElement)) return false;
    const size = PLAYER_HERO_OVERALL_SIZE_PX;
    overall.style.flex = "0 0 " + size + "px";
    overall.style.width = size + "px";
    overall.style.minWidth = size + "px";
    overall.style.maxWidth = size + "px";
    overall.style.height = size + "px";
    overall.style.minHeight = size + "px";
    overall.style.maxHeight = size + "px";
    return true;
  }

  function applyPortraitGeometry(canvas, sourceWidthValue = PLAYER_PORTRAIT_SOURCE_WIDTH_PX, sourceHeightValue = PLAYER_PORTRAIT_CROP_HEIGHT_PX) {
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const frame = canvas.closest(".playerHeroPortraitFrame");
    if (!(frame instanceof HTMLElement)) return null;

    const sourceWidth = Math.max(1, Number(sourceWidthValue || PLAYER_PORTRAIT_SOURCE_WIDTH_PX));
    const sourceHeight = Math.max(1, Number(sourceHeightValue || PLAYER_PORTRAIT_CROP_HEIGHT_PX));
    const sourceCropHeight = Math.max(1, Math.min(PLAYER_PORTRAIT_CROP_HEIGHT_PX, sourceHeight));
    const displayHeight = portraitDisplayHeight();
    const displayWidth = sourceWidth * (displayHeight / sourceCropHeight);

    frame.style.position = "relative";
    frame.style.flex = "0 0 " + displayWidth + "px";
    frame.style.width = displayWidth + "px";
    frame.style.minWidth = displayWidth + "px";
    frame.style.maxWidth = displayWidth + "px";
    frame.style.height = displayHeight + "px";
    frame.style.minHeight = displayHeight + "px";
    frame.style.maxHeight = displayHeight + "px";
    frame.style.alignSelf = "flex-end";
    frame.style.marginBottom = "0";
    frame.style.overflow = "hidden";
    frame.style.borderRadius = "6px 6px 0 0";
    frame.style.background = "transparent";

    canvas.style.display = "block";
    canvas.style.width = displayWidth + "px";
    canvas.style.minWidth = displayWidth + "px";
    canvas.style.maxWidth = displayWidth + "px";
    canvas.style.height = displayHeight + "px";
    canvas.style.minHeight = displayHeight + "px";
    canvas.style.maxHeight = displayHeight + "px";
    canvas.style.margin = "0";
    canvas.style.background = "transparent";

    return { sourceWidth, sourceHeight, sourceCropHeight, displayWidth, displayHeight };
  }

  function drawPortraitCrop(canvas, source) {
    if (!(canvas instanceof HTMLCanvasElement) || !(source instanceof HTMLImageElement)) return false;
    const sourceWidth = Number(source.naturalWidth || 0);
    const sourceHeight = Number(source.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) return false;

    const geometry = applyPortraitGeometry(canvas, sourceWidth, sourceHeight);
    if (!geometry) return false;
    const { sourceCropHeight, displayWidth, displayHeight } = geometry;
    const pixelRatio = Math.max(1, Number(window.devicePixelRatio || 1));
    const rasterWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
    const rasterHeight = Math.max(1, Math.round(displayHeight * pixelRatio));

    canvas.width = rasterWidth;
    canvas.height = rasterHeight;

    const context = canvas.getContext("2d");
    if (!context) return false;
    context.clearRect(0, 0, rasterWidth, rasterHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      source,
      0,
      0,
      sourceWidth,
      sourceCropHeight,
      0,
      0,
      rasterWidth,
      rasterHeight,
    );
    canvas.dataset.sourceWidth = String(sourceWidth);
    canvas.dataset.sourceHeight = String(sourceHeight);
    canvas.dataset.sourceCropHeight = String(sourceCropHeight);
    canvas.dataset.displayWidth = String(displayWidth);
    canvas.dataset.displayHeight = String(displayHeight);
    return true;
  }

  function loadPortraitCrop(canvas, playerIdValue) {
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const playerId = normalizePlayerId(playerIdValue);
    const sourceUrl = portraitUrl(playerId);
    if (!sourceUrl) return false;

    applyPortraitGeometry(canvas);
    canvas.dataset.playerId = playerId;
    const existing = portraitSources.get(playerId);
    if (existing instanceof HTMLImageElement) {
      if (existing.complete && existing.naturalWidth) drawPortraitCrop(canvas, existing);
      else existing.addEventListener("load", () => drawPortraitCrop(canvas, existing), { once: true });
      return true;
    }

    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    image.addEventListener("load", () => drawPortraitCrop(canvas, image), { once: true });
    image.src = sourceUrl;
    portraitSources.set(playerId, image);
    return true;
  }

  function createHeroMedia(context) {
    const media = document.createElement("div");
    media.className = "playerHeroMedia";
    media.dataset.playerHeroMedia = "true";
    media.style.display = "inline-flex";
    media.style.flex = "0 0 auto";
    media.style.alignItems = "flex-end";
    media.style.alignSelf = "stretch";
    media.style.gap = "8px";
    media.style.minWidth = "0";

    const overall = document.createElement("div");
    overall.className = "playerHeroOverall";
    overall.style.display = "grid";
    overall.style.alignSelf = "center";
    overall.style.alignContent = "center";
    overall.style.justifyItems = "center";
    overall.style.border = "1px solid var(--border)";
    overall.style.borderRadius = "8px";
    overall.style.background = "linear-gradient(180deg, color-mix(in srgb, var(--rarity-color) 67%, transparent) 0%, var(--color-bg-default-secondary) 100%), linear-gradient(0deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2))";
    sizeHeroOverall(overall);
    const overallValue = document.createElement("strong");
    overallValue.style.color = "var(--text)";
    overallValue.style.fontSize = "48px";
    overallValue.style.fontWeight = "800";
    overallValue.style.lineHeight = "1";
    overall.appendChild(overallValue);

    const portraitFrame = document.createElement("div");
    portraitFrame.className = "playerHeroPortraitFrame";
    portraitFrame.style.alignSelf = "flex-end";
    portraitFrame.style.marginBottom = "0";
    const portrait = document.createElement("canvas");
    portrait.className = "playerHeroPortrait";
    portrait.setAttribute("role", "img");
    portrait.setAttribute("aria-label", "Player portrait");
    portraitFrame.appendChild(portrait);

    media.append(overall, portraitFrame);
    updateHeroMedia(media, context);
    return media;
  }

  function updateHeroMedia(media, contextValue) {
    if (!(media instanceof HTMLElement)) return false;
    const context = normalizeContext(contextValue);
    const overall = media.querySelector(".playerHeroOverall");
    const overallValue = overall?.querySelector("strong");
    if (overall instanceof HTMLElement && overallValue instanceof HTMLElement) {
      overall.style.setProperty("--rarity-color", rarityColor(context.overall));
      overall.classList.toggle("isPending", !context.overall);
      overallValue.style.color = context.overall ? "var(--text)" : "var(--text-soft)";
      overallValue.textContent = context.overall || loadingBlank();
    }

    const portrait = media.querySelector(".playerHeroPortrait");
    if (portrait instanceof HTMLCanvasElement) loadPortraitCrop(portrait, context.playerId);
    return true;
  }

  function createChevronIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("playerHeroChevronIcon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m7 10 5 5 5-5");
    svg.appendChild(path);
    return svg;
  }

  function createEvaluateIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("playerHeroMenuIcon", "playerEvaluateIcon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const stem = document.createElementNS("http://www.w3.org/2000/svg", "path");
    stem.setAttribute("d", "M12 3v18");
    const curve = document.createElementNS("http://www.w3.org/2000/svg", "path");
    curve.setAttribute("d", "M17 7.5c-.8-1.4-2.4-2.2-5-2.2-3 0-5 1.3-5 3.4 0 2.4 2.4 3.1 5 3.4 3 .4 5 1.1 5 3.4 0 2.1-2 3.4-5 3.4-2.7 0-4.4-.9-5.3-2.5");
    svg.append(stem, curve);
    return svg;
  }

  function styleHeroMenuItem(item) {
    if (!(item instanceof HTMLElement)) return false;
    item.style.boxSizing = "border-box";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "flex-start";
    item.style.gap = "8px";
    item.style.width = "100%";
    item.style.minWidth = "0";
    item.style.height = "36px";
    item.style.minHeight = "36px";
    item.style.maxHeight = "36px";
    item.style.padding = "0 10px";
    item.style.border = "1px solid transparent";
    item.style.borderRadius = "6px";
    item.style.background = "transparent";
    item.style.color = "var(--text)";
    item.style.fontSize = "14px";
    item.style.lineHeight = "1";
    item.style.textAlign = "left";
    item.style.whiteSpace = "nowrap";
    if (item.dataset.playerHeroMenuHoverBound !== "true") {
      item.dataset.playerHeroMenuHoverBound = "true";
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--row-hover)";
        item.style.borderColor = "var(--border)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        item.style.borderColor = "transparent";
      });
    }
    const icon = item.querySelector(".playerHeroMenuIcon");
    if (icon instanceof SVGElement) {
      icon.style.width = "18px";
      icon.style.height = "18px";
      icon.style.flex = "0 0 18px";
      icon.style.fill = "none";
      icon.style.stroke = "currentColor";
      icon.style.strokeWidth = "2";
      icon.style.strokeLinecap = "round";
      icon.style.strokeLinejoin = "round";
    }
    const star = item.querySelector(".watchlistButtonStar");
    if (star instanceof HTMLElement) {
      star.style.display = "inline-flex";
      star.style.alignItems = "center";
      star.style.justifyContent = "center";
      star.style.width = "18px";
      star.style.height = "18px";
      star.style.flex = "0 0 18px";
      star.style.fontSize = "18px";
      star.style.lineHeight = "1";
    }
    return true;
  }

  function setHeroActionMenuOpen(menu, open) {
    if (!(menu instanceof HTMLElement)) return false;
    const wrapper = menu.closest(".playerHeroActionMenu");
    const toggle = wrapper?.querySelector(".playerHeroActionMenuButton");
    const icon = toggle?.querySelector(".playerHeroChevronIcon");
    menu.hidden = false;
    menu.dataset.open = open ? "true" : "false";
    menu.style.visibility = open ? "visible" : "hidden";
    menu.style.opacity = open ? "1" : "0";
    menu.style.transform = open ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.98)";
    menu.style.pointerEvents = open ? "auto" : "none";
    menu.style.transition = open
      ? "opacity 150ms ease, transform 150ms ease, visibility 0s linear 0s"
      : "opacity 150ms ease, transform 150ms ease, visibility 0s linear 150ms";
    if (toggle instanceof HTMLElement) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (icon instanceof SVGElement) {
      icon.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
      icon.style.transition = "transform 150ms ease";
    }
    return true;
  }

  function applyHeroActionMenuLayout(actions) {
    if (!(actions instanceof HTMLElement)) return false;
    const wrapper = actions.querySelector(":scope > .playerHeroActionMenu");
    if (!(wrapper instanceof HTMLElement)) return false;
    const primary = wrapper.querySelector(":scope > .playerHeroPrimaryAction");
    const toggle = wrapper.querySelector(":scope > .playerHeroActionMenuButton");
    const menu = wrapper.querySelector(":scope > .playerHeroActionMenuDropdown");

    actions.style.gap = "0";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "stretch";
    wrapper.style.gap = "4px";
    wrapper.style.flex = "0 0 " + PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";
    wrapper.style.width = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";
    wrapper.style.minWidth = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";
    wrapper.style.maxWidth = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";

    if (primary instanceof HTMLElement) {
      const width = PLAYER_HERO_PRIMARY_ACTION_WIDTH_PX + "px";
      const height = PLAYER_HERO_ACTION_HEIGHT_PX + "px";
      const unavailable = primary.getAttribute("aria-disabled") === "true";
      primary.style.boxSizing = "border-box";
      primary.style.display = "inline-flex";
      primary.style.alignItems = "center";
      primary.style.justifyContent = "center";
      primary.style.flex = "0 0 " + width;
      primary.style.width = width;
      primary.style.minWidth = width;
      primary.style.maxWidth = width;
      primary.style.height = height;
      primary.style.minHeight = height;
      primary.style.maxHeight = height;
      primary.style.padding = "0 10px";
      primary.style.fontSize = "16px";
      primary.style.lineHeight = "1";
      primary.style.whiteSpace = "nowrap";
      primary.style.textDecoration = "none";
      primary.style.color = unavailable ? "var(--text-soft)" : "var(--text)";
      primary.style.opacity = unavailable ? "0.5" : "1";
      primary.style.cursor = unavailable ? "default" : "";
      primary.style.pointerEvents = unavailable ? "none" : "";
      primary.style.transition = PLAYER_READY_TRANSITION;
    }

    if (toggle instanceof HTMLElement) {
      const width = PLAYER_HERO_ACTION_CHEVRON_WIDTH_PX + "px";
      const height = PLAYER_HERO_ACTION_HEIGHT_PX + "px";
      const unavailable = toggle.getAttribute("aria-disabled") === "true";
      toggle.style.boxSizing = "border-box";
      toggle.style.display = "grid";
      toggle.style.placeItems = "center";
      toggle.style.flex = "0 0 " + width;
      toggle.style.width = width;
      toggle.style.minWidth = width;
      toggle.style.maxWidth = width;
      toggle.style.height = height;
      toggle.style.minHeight = height;
      toggle.style.maxHeight = height;
      toggle.style.padding = "0";
      toggle.style.color = unavailable ? "var(--text-soft)" : "var(--text)";
      toggle.style.opacity = unavailable ? "0.5" : "1";
      toggle.style.cursor = unavailable ? "default" : "";
      toggle.style.transition = PLAYER_READY_TRANSITION;
      const icon = toggle.querySelector(".playerHeroChevronIcon");
      if (icon instanceof SVGElement) {
        icon.style.width = "16px";
        icon.style.height = "16px";
        icon.style.fill = "none";
        icon.style.stroke = "currentColor";
        icon.style.strokeWidth = "2";
        icon.style.strokeLinecap = "round";
        icon.style.strokeLinejoin = "round";
      }
    }

    if (menu instanceof HTMLElement) {
      menu.style.position = "absolute";
      menu.style.top = "calc(100% + 6px)";
      menu.style.right = "0";
      menu.style.zIndex = "var(--mfl-z-dropdown)";
      menu.style.boxSizing = "border-box";
      menu.style.width = PLAYER_HERO_ACTION_MENU_WIDTH_PX + "px";
      menu.style.padding = "4px";
      menu.style.border = "1px solid var(--border-strong)";
      menu.style.borderRadius = "8px";
      menu.style.background = "var(--surface)";
      menu.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.16)";
      menu.style.transformOrigin = "top right";
      menu.style.willChange = "opacity, transform";
      menu.querySelectorAll(":scope > .playerHeroActionMenuItem").forEach(styleHeroMenuItem);
      if (menu.dataset.open !== "true") setHeroActionMenuOpen(menu, false);
      else setHeroActionMenuOpen(menu, true);
    }
    return true;
  }

  function closeHeroActionMenu(menu = activeHeroActionMenu) {
    if (!(menu instanceof HTMLElement)) return false;
    setHeroActionMenuOpen(menu, false);
    if (activeHeroActionMenu === menu) activeHeroActionMenu = null;
    return true;
  }

  function bindHeroActionMenu(container = document) {
    const actions = container?.querySelector?.(".playerHeroActions");
    if (!(actions instanceof HTMLElement)) return false;
    const wrapper = actions.querySelector(":scope > .playerHeroActionMenu");
    const toggle = wrapper?.querySelector(":scope > .playerHeroActionMenuButton");
    const menu = wrapper?.querySelector(":scope > .playerHeroActionMenuDropdown");
    if (!(wrapper instanceof HTMLElement) || !(toggle instanceof HTMLElement) || !(menu instanceof HTMLElement)) return false;
    toggle.removeAttribute("aria-disabled");
    applyHeroActionMenuLayout(actions);
    if (toggle.dataset.playerHeroMenuBound === "true") return true;
    toggle.dataset.playerHeroMenuBound = "true";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = menu.dataset.open !== "true";
      if (activeHeroActionMenu && activeHeroActionMenu !== menu) closeHeroActionMenu(activeHeroActionMenu);
      setHeroActionMenuOpen(menu, willOpen);
      activeHeroActionMenu = willOpen ? menu : null;
    });
    menu.querySelectorAll(":scope > .playerHeroActionMenuItem").forEach((item) => {
      item.addEventListener("click", () => closeHeroActionMenu(menu));
    });
    return true;
  }

  function animateReadyControls(container = document) {
    const playerId = playerIdFromLocation();
    if (!playerId || readyTransitionPlayerId !== playerId) return false;
    readyTransitionPlayerId = "";
    const controls = Array.from(container?.querySelectorAll?.(".playerHeroActionMenuButton, .playerAttributeViewButton") || [])
      .filter((control) => control instanceof HTMLElement);
    if (!controls.length) return false;
    controls.forEach((control) => {
      control.style.transition = "none";
      control.style.opacity = "0.5";
      control.style.color = "var(--text-soft)";
      if (control.classList.contains("playerAttributeViewButton")) {
        control.style.backgroundColor = "var(--surface-muted)";
        control.style.borderColor = "var(--border-strong)";
      }
    });
    controls[0]?.getBoundingClientRect();
    window.requestAnimationFrame(() => {
      controls.forEach((control) => {
        control.style.transition = PLAYER_READY_TRANSITION;
        control.style.opacity = "1";
        control.style.removeProperty("color");
        if (control.classList.contains("playerAttributeViewButton")) {
          control.style.removeProperty("background-color");
          control.style.removeProperty("border-color");
        }
      });
    });
    return true;
  }

  document.addEventListener("pointerdown", (event) => {
    if (!(activeHeroActionMenu instanceof HTMLElement)) return;
    const wrapper = activeHeroActionMenu.closest(".playerHeroActionMenu");
    if (wrapper instanceof HTMLElement && event.target instanceof Node && wrapper.contains(event.target)) return;
    closeHeroActionMenu(activeHeroActionMenu);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeHeroActionMenu instanceof HTMLElement) closeHeroActionMenu(activeHeroActionMenu);
  });

  function applyHeroLayout(hero) {
    if (!(hero instanceof HTMLElement)) return false;
    const identity = hero.querySelector(":scope > .playerHeroIdentity");
    const media = hero.querySelector(":scope > .playerHeroMedia");
    const actions = hero.querySelector(":scope > .playerHeroActions");

    hero.style.gap = "0";
    if (media instanceof HTMLElement) {
      const identityOffset = PLAYER_HERO_OVERALL_SIZE_PX + PLAYER_HERO_IDENTITY_OVERALL_GAP_PX;
      const width = identityOffset + "px";
      media.style.order = "1";
      media.style.alignSelf = "stretch";
      media.style.flex = "0 0 " + width;
      media.style.width = width;
      media.style.minWidth = width;
      media.style.maxWidth = width;
      media.style.marginRight = "0";
    }
    if (identity instanceof HTMLElement) {
      const width = PLAYER_HERO_IDENTITY_WIDTH_PX + "px";
      identity.style.order = "2";
      identity.style.flex = "0 1 " + width;
      identity.style.width = width;
      identity.style.maxWidth = width;
      identity.style.minWidth = "0";
      identity.style.marginLeft = "0";
      identity.style.marginRight = PLAYER_HERO_IDENTITY_ACTION_GAP_PX + "px";
      identity.style.alignSelf = "center";
      const eyebrow = identity.querySelector(".playerEyebrow");
      const title = identity.querySelector(".playerTitle");
      const positions = identity.querySelector("p");
      if (eyebrow instanceof HTMLElement) eyebrow.style.fontSize = "14px";
      if (title instanceof HTMLElement) title.style.fontSize = "28px";
      if (positions instanceof HTMLElement) positions.style.fontSize = "16px";
    }
    if (actions instanceof HTMLElement) {
      actions.style.order = "3";
      actions.style.alignSelf = "center";
      actions.style.marginLeft = "auto";
      applyHeroActionMenuLayout(actions);
    }

    const detail = hero.parentElement;
    if (detail instanceof HTMLElement && detail.id === "playerDetail") detail.style.marginTop = "0";
    return true;
  }

  function placeHeroMedia(hero, context) {
    if (!(hero instanceof HTMLElement)) return false;
    let media = hero.querySelector(":scope > .playerHeroMedia");
    const identity = hero.querySelector(":scope > .playerHeroIdentity");
    if (!(media instanceof HTMLElement)) {
      media = createHeroMedia(context);
      hero.insertBefore(media, identity instanceof HTMLElement ? identity : hero.firstChild);
    } else {
      updateHeroMedia(media, context);
      if (identity instanceof HTMLElement && media.nextElementSibling !== identity) hero.insertBefore(media, identity);
    }
    applyHeroLayout(hero);
    return true;
  }

  function createPendingHeroActions(context) {
    const actions = document.createElement("div");
    actions.className = "playerHeroActions playerHeroActionsPending";
    const wrapper = document.createElement("div");
    wrapper.className = "playerHeroActionMenu";

    const external = document.createElement("a");
    external.className = "playerExternalButton playerHeroPrimaryAction";
    external.textContent = "Open link";
    external.href = context.externalUrl;
    external.target = "_blank";
    external.rel = "noopener noreferrer";

    const toggle = document.createElement("button");
    toggle.className = "playerHeroActionMenuButton";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "More player actions");
    toggle.setAttribute("aria-haspopup", "menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-disabled", "true");
    toggle.appendChild(createChevronIcon());

    const menu = document.createElement("div");
    menu.className = "playerHeroActionMenuDropdown";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    const evaluate = document.createElement("button");
    evaluate.className = "playerEvaluateButton playerHeroActionMenuItem";
    evaluate.type = "button";
    evaluate.setAttribute("role", "menuitem");
    evaluate.append(createEvaluateIcon(), document.createTextNode("Evaluate"));
    menu.appendChild(evaluate);

    if (storedWalletOptIn()) {
      const watchlist = document.createElement("button");
      watchlist.className = "playerWatchlistButton playerHeroActionMenuItem";
      watchlist.type = "button";
      watchlist.setAttribute("role", "menuitem");
      const watchlistReady = Boolean(state.walletPreferencesLoaded);
      const inWatchlist = watchlistReady && state.watchlistPlayerIds instanceof Set && state.watchlistPlayerIds.has(context.playerId);
      watchlist.innerHTML = '<span class="watchlistButtonStar" aria-hidden="true">' + (inWatchlist ? "\u2605" : "\u2606") + '</span><span>' + (inWatchlist ? "In watchlist" : "Add to watchlist") + "</span>";
      menu.appendChild(watchlist);
    }

    wrapper.append(external, toggle, menu);
    actions.appendChild(wrapper);
    applyHeroActionMenuLayout(actions);
    return actions;
  }

  function pendingProfileText(context, label) {
    if (label === "Nationality") return knownDisplayValue(context, "nationality");
    if (label === "Age") return knownDisplayValue(context, "age");
    if (label === "Height") {
      const height = knownDisplayValue(context, "height");
      return height && height !== "NULL" ? height + " cm" : height;
    }
    if (label === "Foot") {
      const rawFoot = knownRawValue(context, "preferred_foot");
      return rawFoot !== "" ? formatFootedness(rawFoot) : knownDisplayValue(context, "preferred_foot");
    }
    if (label === "Seasons") return knownDisplayValue(context, "player_seasons");
    if (label === "Agent") return knownDisplayValue(context, "wallet_name");
    if (label === "Rev Share") {
      const rawRevenueShare = knownRawValue(context, "active_contract_revenue_share");
      return rawRevenueShare !== "" ? formatContractRevenueShare(rawRevenueShare) : knownDisplayValue(context, "active_contract_revenue_share");
    }
    return "";
  }

  function appendPendingAgentValue(value, context) {
    const agentName = knownDisplayValue(context, "wallet_name");
    const walletAddress = String(knownRawValue(context, "wallet_address") || "").trim();
    value.style.fontWeight = "600";
    if (!agentName) {
      value.textContent = loadingBlank();
      return;
    }
    if (!walletAddress) {
      value.textContent = agentName;
      return;
    }
    const link = document.createElement("a");
    link.className = "agentTableLink playerAgentLink";
    link.href = typeof agentRoute === "function" ? agentRoute(walletAddress) : "/agents/" + encodeURIComponent(walletAddress) + "/attributes";
    link.textContent = agentName;
    link.addEventListener("click", (event) => {
      if (typeof openAgentPage !== "function") return;
      event.preventDefault();
      openAgentPage(walletAddress, agentName);
    });
    value.replaceChildren(link);
  }

  function appendPendingContractValue(value, context) {
    const line = document.createElement("span");
    line.className = "playerContractLine";
    const teamName = knownDisplayValue(context, "active_contract_club_name");
    const clubId = String(knownRawValue(context, "active_contract_club_id") || "").trim();
    let team;
    if (teamName && clubId) {
      team = document.createElement("a");
      team.className = "playerContractTeam playerContractTeamLink clubPageLink";
      team.href = window.__mflAppConfig?.routes?.clubPath?.(clubId, "attributes") || "/clubs/" + encodeURIComponent(clubId) + "/squad";
      team.dataset.clubId = clubId;
      team.textContent = teamName;
      team.addEventListener("click", (event) => {
        if (typeof window.mflOpenClubPage !== "function") return;
        event.preventDefault();
        window.mflOpenClubPage(clubId, "attributes");
      });
    } else {
      team = document.createElement("span");
      team.className = "playerContractTeam";
      team.textContent = teamName || loadingBlank();
    }
    const division = document.createElement("span");
    division.className = "playerContractDivision";
    const divisionRaw = knownRawValue(context, "active_contract_club_division");
    const divisionInfo = divisionRaw !== "" ? contractDivisionInfo(divisionRaw) : null;
    division.textContent = divisionInfo?.name || knownDisplayValue(context, "active_contract_club_division") || loadingBlank();
    if (divisionInfo?.color) division.style.color = divisionInfo.color;
    line.append(team, division);
    value.replaceChildren(line);
  }

  function createPendingProfilePanel(context) {
    const panel = document.createElement("div");
    panel.className = "playerPanel playerInfoPanel";
    const heading = document.createElement("h3");
    heading.textContent = "Profile";
    const grid = document.createElement("div");
    grid.className = "detailGrid";
    ["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract", "Rev Share"].forEach((label) => {
      const card = document.createElement("div");
      if (label === "Contract") card.className = "contractDetailCard";
      const name = document.createElement("span");
      name.textContent = label;
      const value = document.createElement("strong");
      if (label === "Contract") {
        appendPendingContractValue(value, context);
      } else if (label === "Agent") {
        appendPendingAgentValue(value, context);
      } else if (label === "Nationality") {
        const knownNationality = knownDisplayValue(context, "nationality");
        if (knownNationality) {
          value.innerHTML = countryFlagHtml(knownRawValue(context, "nationality")) + " " + escapeHtml(knownNationality);
        } else {
          value.textContent = loadingBlank();
        }
      } else {
        value.textContent = pendingProfileText(context, label) || loadingBlank();
      }
      card.append(name, value);
      grid.appendChild(card);
    });
    panel.append(heading, grid);
    return panel;
  }

  function createPendingAttributeViews() {
    const views = document.createElement("div");
    views.className = "playerAttributeViews";
    views.style.visibility = "visible";
    const items = storedProgressionAccess()
      ? [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"], ["current", "Current Season"], ["all", "All Time"]]
      : [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"]];
    items.forEach(([view, label]) => {
      const button = document.createElement("button");
      button.className = "playerAttributeViewButton";
      button.type = "button";
      button.disabled = true;
      button.dataset.playerAttributeView = view;
      button.textContent = label;
      button.style.transition = PLAYER_READY_TRANSITION;
      views.appendChild(button);
    });
    return views;
  }

  function pendingAttributeColumns(context) {
    if (!context.positions.length) return ["overall"];
    const goalkeeper = context.positions.some((position) => String(position).toUpperCase() === "GK");
    return goalkeeper
      ? ["overall", "goalkeeping"]
      : ["overall", "pace", "dribbling", "shooting", "defense", "passing", "physical"];
  }

  function pendingAttributeValue(context, column) {
    if (column === "overall") return context.overall || knownDisplayValue(context, column);
    return knownDisplayValue(context, column);
  }

  function createPendingAttributesPanel(context) {
    const panel = document.createElement("div");
    panel.className = "playerPanel attributesPanel";
    const header = document.createElement("div");
    header.className = "playerPanelHeader";
    const heading = document.createElement("h3");
    heading.textContent = "Attributes";
    header.append(heading, createPendingAttributeViews());

    const grid = document.createElement("div");
    grid.className = "attributeGrid";
    const columns = pendingAttributeColumns(context);
    const goalkeeper = columns.length === 2;
    columns.forEach((column) => {
      const label = column === "goalkeeping" ? "Goalkeeping" : columnLabels[column];
      const card = document.createElement("div");
      const fullWidth = column === "overall" || (goalkeeper && column === "goalkeeping");
      card.className = "playerAttributeCard" + (column === "overall" ? " featured" : "") + (fullWidth ? " fullWidth" : "");
      if (column === "overall") card.style.setProperty("--rarity-color", rarityColor(context.overall));
      const name = document.createElement("span");
      name.textContent = label;
      const strong = document.createElement("strong");
      const value = document.createElement("span");
      value.className = "attributeValueText";
      value.textContent = pendingAttributeValue(context, column) || loadingBlank();
      strong.appendChild(value);
      card.append(name, strong);
      grid.appendChild(card);
    });
    panel.append(header, grid);
    return panel;
  }

  function stableAttributePanelHtml(row) {
    return renderPlayerAttributePanel(row);
  }

  function createPendingNotesPanel(context) {
    const panel = document.createElement("div");
    panel.className = "playerPanel playerNotesPanel";
    const heading = document.createElement("h3");
    heading.textContent = "Notes";
    const wrap = document.createElement("div");
    wrap.className = "playerNotesInputWrap";
    const input = document.createElement("textarea");
    input.className = "playerNotesInput";
    input.placeholder = "Write private notes for this player...";
    input.maxLength = PLAYER_NOTE_MAX_LENGTH;
    input.disabled = true;
    const notesReady = Boolean(state.walletPreferencesLoaded);
    const note = notesReady && typeof playerNote === "function" ? playerNote(context.playerId) : "";
    if (note) input.value = note;
    const count = document.createElement("span");
    count.className = "playerNotesCount";
    count.textContent = notesReady ? String(note.length) + "/" + PLAYER_NOTE_MAX_LENGTH : loadingBlank();
    wrap.append(input, count);
    panel.append(heading, wrap);
    return panel;
  }

  function pendingPitchHtml() {
    const pitchLines = '<span class="pitchLine pitchBoxTop"></span><span class="pitchLine pitchGoalTop"></span><span class="pitchLine pitchArcTop"></span><span class="pitchLine pitchBoxBottom"></span><span class="pitchLine pitchGoalBottom"></span><span class="pitchLine pitchArcBottom"></span>';
    return pitchLines + PITCH_ROWS.map((pitchRow) =>
      '\n      <div class="pitchRow pitchRow' + pitchRow.length + '" style="--pitch-columns: ' + pitchRow.length + '">\n        ' +
      pitchRow.map(() => '<div class="pitchPositionSlot" style="cursor:default;user-select:none;-webkit-user-select:none"><span class="pitchPositionBlank" aria-hidden="true"></span></div>').join("") +
      "\n      </div>"
    ).join("");
  }

  function pendingGridSignature(context) {
    return JSON.stringify([
      context.positions,
      context.overall,
      context.knownValues,
      storedWalletOptIn(),
      Boolean(state.walletPreferencesLoaded),
    ]);
  }

  function createPendingPlayerGrid(context) {
    const playerGrid = document.createElement("section");
    playerGrid.className = "playerGrid playerGridPending";
    playerGrid.dataset.playerPendingSignature = pendingGridSignature(context);
    const stack = document.createElement("div");
    stack.className = "playerStack";
    stack.append(createPendingProfilePanel(context), createPendingAttributesPanel(context));
    if (storedWalletOptIn()) stack.appendChild(createPendingNotesPanel(context));

    const pitchPanel = document.createElement("div");
    pitchPanel.className = "playerPanel pitchPanel";
    const heading = document.createElement("h3");
    heading.textContent = "Positions";
    const pitch = document.createElement("div");
    pitch.className = "pitch";
    pitch.innerHTML = pendingPitchHtml();
    pitchPanel.append(heading, pitch);

    playerGrid.append(stack, pitchPanel);
    return playerGrid;
  }

  function updatePendingHero(hero, context) {
    if (!(hero instanceof HTMLElement)) return false;
    const identity = hero.querySelector(":scope > .playerHeroIdentity");
    if (identity instanceof HTMLElement) {
      const idText = identity.querySelector(".playerIdText");
      if (idText instanceof HTMLElement) idText.textContent = "ID #" + context.playerId;
      const titleName = identity.querySelector(".playerTitleName");
      if (titleName instanceof HTMLElement) {
        titleName.classList.toggle("playerTitleNamePending", !context.name);
        titleName.textContent = context.name || loadingBlank();
      }
      const noteIcon = identity.querySelector("[data-player-note-title-icon]");
      if (noteIcon instanceof HTMLElement && state.walletPreferencesLoaded && typeof playerNoteIconHtml === "function") {
        noteIcon.innerHTML = playerNoteIconHtml(context.playerId);
      }
      const positions = identity.querySelector("p");
      if (positions instanceof HTMLElement) {
        positions.classList.toggle("playerPositionsPending", !context.positions.length);
        positions.textContent = context.positions.length ? context.positions.join(", ") : loadingBlank();
      }
    }
    const external = hero.querySelector(".playerHeroPrimaryAction");
    if (external instanceof HTMLAnchorElement) {
      external.href = context.externalUrl;
      external.target = "_blank";
      external.rel = "noopener noreferrer";
      external.removeAttribute("aria-disabled");
    }
    placeHeroMedia(hero, context);
    return true;
  }

  function showPlayerPage() {
    const page = document.getElementById("playerPage");
    if (!(page instanceof HTMLElement)) return false;
    document.querySelectorAll("main > .pageView").forEach((candidate) => {
      if (candidate instanceof HTMLElement) candidate.hidden = candidate !== page;
    });
    page.hidden = false;
    if (document.body) document.body.dataset.page = "player";
    const actions = page.querySelector(".playerHeroActions");
    if (actions instanceof HTMLElement) applyHeroActionMenuLayout(actions);
    return true;
  }

  function renderPending(value = {}) {
    const incoming = normalizeContext(value);
    const playerId = incoming.playerId || playerIdFromLocation();
    if (!playerId) return false;
    if (playerIdFromLocation() !== playerId) return false;
    const context = mergeContext(readCachedContext(playerId), { ...incoming, playerId });
    readyTransitionPlayerId = playerId;
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement)) return false;

    detail.style.marginTop = "0";
    const existingHero = detail.querySelector(":scope > .playerHero");
    if (existingHero instanceof HTMLElement
        && existingHero.dataset.playerShellId === playerId
        && existingHero.classList.contains("playerHeroPending")) {
      updatePendingHero(existingHero, context);
      const existingGrid = detail.querySelector(":scope > .playerGridPending");
      const nextSignature = pendingGridSignature(context);
      if (!(existingGrid instanceof HTMLElement) || existingGrid.dataset.playerPendingSignature !== nextSignature) {
        const nextGrid = createPendingPlayerGrid(context);
        if (existingGrid instanceof HTMLElement) existingGrid.replaceWith(nextGrid);
        else detail.appendChild(nextGrid);
      }
      showPlayerPage();
      if (context.name || context.positions.length || context.overall || context.externalUrl) rememberContext(context);
      return true;
    }

    const hero = document.createElement("section");
    hero.className = "playerHero playerHeroPending";
    hero.dataset.playerShellId = playerId;

    const identity = document.createElement("div");
    identity.className = "playerHeroIdentity";
    const eyebrow = document.createElement("button");
    eyebrow.id = "copyPlayerIdButton";
    eyebrow.className = "playerEyebrow playerIdText";
    eyebrow.type = "button";
    eyebrow.dataset.tooltip = "Click to copy";
    eyebrow.setAttribute("aria-label", "Click to copy player ID");
    eyebrow.textContent = "ID #" + playerId;
    const title = document.createElement("h2");
    title.className = "playerTitle";
    const titleName = document.createElement("span");
    titleName.className = "playerTitleName" + (context.name ? "" : " playerTitleNamePending");
    titleName.textContent = context.name || loadingBlank();
    const titleNoteIcon = document.createElement("span");
    titleNoteIcon.className = "playerTitleNoteIcon";
    titleNoteIcon.dataset.playerNoteTitleIcon = "";
    if (state.walletPreferencesLoaded && typeof playerNoteIconHtml === "function") {
      titleNoteIcon.innerHTML = playerNoteIconHtml(playerId);
    }
    title.append(titleName, titleNoteIcon);
    const positions = document.createElement("p");
    positions.className = context.positions.length ? "" : "playerPositionsPending";
    positions.textContent = context.positions.length ? context.positions.join(", ") : loadingBlank();
    identity.append(eyebrow, title, positions);

    const actions = createPendingHeroActions(context);
    hero.append(createHeroMedia(context), identity, actions);
    applyHeroLayout(hero);
    detail.replaceChildren(hero, createPendingPlayerGrid(context));
    showPlayerPage();
    if (playerIdFromLocation() === playerId) {
      document.documentElement.dataset.initialEntityVerified = "player";
    }
    if (context.name || context.positions.length || context.overall || context.externalUrl) rememberContext(context);
    return true;
  }

  function hydrateHero(value = {}) {
    const context = normalizeContext(value);
    if (!context.playerId) return false;
    const routePlayerId = playerIdFromLocation();
    if (routePlayerId && routePlayerId !== context.playerId) return false;
    const container = value.container instanceof HTMLElement ? value.container : document.getElementById("playerDetail");
    if (!(container instanceof HTMLElement)) return false;
    const hero = container.querySelector(":scope > .playerHero");
    if (!(hero instanceof HTMLElement)) return false;

    const identity = hero.querySelector(":scope > .playerHeroIdentity") || hero.querySelector(":scope > div:not(.playerHeroMedia):not(.playerHeroActions)");
    if (identity instanceof HTMLElement) identity.classList.add("playerHeroIdentity");
    hero.dataset.playerShellId = context.playerId;
    hero.classList.remove("playerHeroPending");
    container.style.marginTop = "0";
    placeHeroMedia(hero, context);
    const viewRow = container.querySelector(".playerAttributeViews");
    if (viewRow instanceof HTMLElement) viewRow.style.visibility = "visible";
    if (normalizePlayerId(window.__mflPlayerFirstPaintPendingContext?.playerId) === context.playerId) {
      window.__mflPlayerFirstPaintPendingContext = null;
    }
    if (pendingDetailPlayerId === context.playerId) pendingDetailPlayerId = "";
    if (readyDetailPlayerId === context.playerId) readyDetailPlayerId = "";
    rememberContext(context);
    return true;
  }

  window.addEventListener("resize", () => {
    document.querySelectorAll(".playerHeroPortrait").forEach((portrait) => {
      if (!(portrait instanceof HTMLCanvasElement)) return;
      const source = portraitSources.get(normalizePlayerId(portrait.dataset.playerId));
      if (source instanceof HTMLImageElement && source.complete && source.naturalWidth) drawPortraitCrop(portrait, source);
      else applyPortraitGeometry(portrait);
    });
    document.querySelectorAll(".playerHeroActions").forEach((actions) => {
      if (actions instanceof HTMLElement) applyHeroActionMenuLayout(actions);
    });
  }, { passive: true });

  const pendingContext = window.__mflPlayerFirstPaintPendingContext;
  const pendingPlayerId = normalizePlayerId(pendingContext?.playerId);
  const routePlayerId = playerIdFromLocation();
  if (pendingPlayerId) {
    beginDetailNavigation(pendingContext);
    renderPending(pendingContext);
  } else if (routePlayerId) {
    renderPending({ playerId: routePlayerId });
  }

  window.__mflPlayerFirstPaintRuntime = Object.freeze({
    cropHeightPx: PLAYER_PORTRAIT_CROP_HEIGHT_PX,
    portraitUrl,
    renderPending,
    hydrateHero,
    rememberContext,
    drawPortraitCrop,
    snapshotRowKnownValues,
    bindHeroActionMenu,
    animateReadyControls,
    stableAttributePanelHtml,
    beginDetailNavigation,
    markDetailPayloadReady,
    detailDataReady,
  });
})();`;

export function splitPlayerApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core: inputCore } = normalizeSplitterInput(
    artifacts,
    "player",
    "Player ownership",
  );
  if (alreadySplit) return artifacts;

  const routeOnly = extractRequiredFunctions(inputCore, PLAYER_ROUTE_ONLY_FUNCTIONS, "Player route-only helper");
  const extractedSections = extractRequiredSections(routeOnly.core, PLAYER_SECTIONS);
  const playerSectionChunks = [...extractedSections.chunks];
  playerSectionChunks[0] = replaceRequired(
    playerSectionChunks[0],
    ' title="${position} ${rating}"',
    "",
    "Player pitch position native tooltip removal",
  );
  playerSectionChunks[0] = replaceRequired(
    playerSectionChunks[0],
    'return `<div class="pitchPositionSlot">${content}</div>`;',
    'return `<div class="pitchPositionSlot" style="cursor:default;user-select:none;-webkit-user-select:none">${content}</div>`;',
    "Player pitch position passive hover behavior",
  );
  let core = extractedSections.core;
  const playerParts = [PLAYER_FIRST_PAINT_RUNTIME, ...routeOnly.chunks, ...playerSectionChunks];

  const renderer = extractRequiredSection(
    core,
    "const playerDetailRenderReuse = createRenderReuseGuard();",
    "function showModal(modal) {",
    "Player page renderer owner",
  );
  core = renderer.core;
  let playerRenderer = renderer.chunk.replace(
    "function renderPlayerPage(playerId) {",
    "function renderPlayerPageOwner(playerId) {",
  );
  if (!playerRenderer.includes("function renderPlayerPageOwner(playerId) {")) {
    throw new Error("Could not rename the Player page renderer owner.");
  }
  playerRenderer = replaceRequired(
    playerRenderer,
    `  const row = rowByPlayerId(playerId);

  if (!row) {`,
    `  const row = rowByPlayerId(playerId);

  if (window.__mflPlayerFirstPaintRuntime?.detailDataReady?.(row, playerId) === false) {
    const key = String(playerId || "").trim();
    const pendingContext = window.__mflPlayerFirstPaintPendingContext;
    window.__mflPlayerFirstPaintRuntime?.renderPending?.(
      String(pendingContext?.playerId || "").trim() === key ? pendingContext : { playerId: key },
    );
    return;
  }

  if (!row) {`,
    "Player partial-row loading gate",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    `  const ageMarkerHtml = ageMarker
    ? \` <span class="retirementMarker playerAgeMarker retirementMarker--\${escapeHtml(ageMarker.status || "default")}" data-tooltip="\${escapeHtml(ageMarker.label)}" aria-label="\${escapeHtml(ageMarker.label)}"><img src="/retirement-\${escapeHtml(ageMarker.icon)}.svg" width="16" height="16" alt="" aria-hidden="true"></span>\`
    : "";`,
    `  const ageMarkerHtml = ageMarker
    ? \` <i class="retirementMarker playerAgeMarker retirementMarker--\${escapeHtml(ageMarker.status || "default")}" data-tooltip="\${escapeHtml(ageMarker.label)}" aria-label="\${escapeHtml(ageMarker.label)}"><img src="/retirement-\${escapeHtml(ageMarker.icon)}.svg" width="16" height="16" alt="" aria-hidden="true"></i>\`
    : "";`,
    "Player retirement marker color ownership",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    "      openAgentPage(agentWalletAddress);",
    '      openAgentPage(agentWalletAddress, formatCellValue(row, "wallet_name"));',
    "Player Agent name handoff",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    `  if (revenueShare) {
    infoCardsData.push(["Rev Share", escapeHtml(revenueShare)]);
  }`,
    `  infoCardsData.push(["Rev Share", escapeHtml(revenueShare || "–")]);`,
    "Player Profile Rev Share box stability",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    `    <section class="playerHero">
      <div>`,
    `    <section class="playerHero">
      <div class="playerHeroIdentity">`,
    "Player hero identity stable markup",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    `      <div class="playerHeroActions">
        <button id="playerEvaluateButton" class="playerEvaluateButton" type="button">Evaluate</button>
        \${hasWalletOptIn() ? '<button id="playerWatchlistButton" class="playerWatchlistButton" type="button"></button>' : ""}
        <a id="openPlayerExternalButton" class="playerExternalButton" href="\${escapeHtml(formatCellValue(row, linkColumn))}" target="_blank" rel="noopener noreferrer">Open link</a>
      </div>`,
    `      <div class="playerHeroActions">
        <div class="playerHeroActionMenu">
          <a id="openPlayerExternalButton" class="playerExternalButton playerHeroPrimaryAction" href="\${escapeHtml(formatCellValue(row, linkColumn))}" target="_blank" rel="noopener noreferrer">Open link</a>
          <button id="playerHeroActionMenuButton" class="playerHeroActionMenuButton" type="button" aria-label="More player actions" aria-haspopup="menu" aria-expanded="false"><svg class="playerHeroChevronIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg></button>
          <div id="playerHeroActionMenu" class="playerHeroActionMenuDropdown" role="menu" hidden>
            <button id="playerEvaluateButton" class="playerEvaluateButton playerHeroActionMenuItem" type="button" role="menuitem"><svg class="playerHeroMenuIcon playerEvaluateIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M17 7.5c-.8-1.4-2.4-2.2-5-2.2-3 0-5 1.3-5 3.4 0 2.4 2.4 3.1 5 3.4 3 .4 5 1.1 5 3.4 0 2.1-2 3.4-5 3.4-2.7 0-4.4-.9-5.3-2.5"></path></svg><span>Evaluate</span></button>
            \${hasWalletOptIn() ? '<button id="playerWatchlistButton" class="playerWatchlistButton playerHeroActionMenuItem" type="button" role="menuitem"></button>' : ""}
          </div>
        </div>
      </div>`,
    "Player consolidated hero action menu",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    '<div class="attributeGrid">${renderPlayerAttributePanel(displayRow)}</div>',
    '<div class="attributeGrid">${window.__mflPlayerFirstPaintRuntime?.stableAttributePanelHtml?.(displayRow) || renderPlayerAttributePanel(displayRow)}</div>',
    "Player stable attribute-grid geometry",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    '  const watchButton = playerDetail.querySelector("#playerWatchlistButton");',
    `  window.__mflPlayerFirstPaintRuntime?.hydrateHero?.({
    container: playerDetail,
    playerId: id,
    name: playerName,
    positions,
    overall: statDisplayValue(row, "overall"),
    externalUrl: formatCellValue(row, linkColumn),
    knownValues: window.__mflPlayerFirstPaintRuntime?.snapshotRowKnownValues?.(row) || {},
  });
  const watchButton = playerDetail.querySelector("#playerWatchlistButton");`,
    "Player portrait hero hydration",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    '    watchButton.className = `playerWatchlistButton ${inAnyWatchlist ? "active" : ""}`;',
    '    watchButton.className = `playerWatchlistButton playerHeroActionMenuItem ${inAnyWatchlist ? "active" : ""}`;',
    "Player dropdown watchlist class stability",
  );
  playerRenderer = replaceRequired(
    playerRenderer,
    '  const evaluateButton = playerDetail.querySelector("#playerEvaluateButton");',
    `  window.__mflPlayerFirstPaintRuntime?.bindHeroActionMenu?.(playerDetail);
  window.__mflPlayerFirstPaintRuntime?.animateReadyControls?.(playerDetail);
  const evaluateButton = playerDetail.querySelector("#playerEvaluateButton");`,
    "Player hero action menu binding",
  );

  const contractLink = extractRequiredFunctions(
    core,
    PLAYER_CONTRACT_LINK_FUNCTIONS,
    "Player contract-link helper",
  );
  core = contractLink.core;
  core = replaceRequired(
    core,
    PLAYER_CONTRACT_LINK_WRAPPER,
    "",
    "Player contract-link shared wrapper",
  );
  core = replaceRequired(
    core,
    '  const RELEASE_VERSION = String(window.__mflReleaseVersion || "");\n\n',
    "",
    "Player contract-link release constant",
  );
  core = replaceRequired(
    core,
    `  state.dataAccess = route.access;
  state.dataLoaded = true;
  clearRowSortCache();`,
    `  state.dataAccess = route.access;
  state.dataLoaded = true;
  window.__mflPlayerFirstPaintRuntime?.markDetailPayloadReady?.(route, payload);
  clearRowSortCache();`,
    "Player route payload readiness handoff",
  );
  core = replaceRequired(
    core,
    `function openPlayerPage(playerId) {
  setPage("player", true, { playerId: String(playerId) });
}`,
    `function playerFirstPaintKnownValues(row) {
  const knownValues = {};
  if (!Array.isArray(row) || !Array.isArray(state.columns)) return knownValues;
  state.columns.forEach((column, index) => {
    if (!column || index >= row.length) return;
    const rawValue = row[index];
    if (rawValue === null || rawValue === undefined || rawValue === "") return;
    const rawType = typeof rawValue;
    const serializedRaw = rawType === "string" || rawType === "number" || rawType === "boolean" ? rawValue : String(rawValue);
    const display = String(formatCellValue(row, column) || serializedRaw).trim();
    knownValues[column] = { raw: serializedRaw, display };
  });
  return knownValues;
}

function playerFirstPaintSearchEntry(playerId) {
  const key = String(playerId || "").trim();
  return [...state.searchIndex, ...state.evaluationSearchIndex]
    .find((entry) => String(entry?.playerId || "").trim() === key) || null;
}

function playerFirstPaintNavigationContext(playerId) {
  const key = String(playerId || "").trim();
  const searchEntry = playerFirstPaintSearchEntry(key);
  const directRow = rowByPlayerId(key);
  const indexedRow = !directRow && Array.isArray(searchEntry?.row) && searchEntry.row.length === state.columns.length
    ? searchEntry.row
    : null;
  const row = directRow || indexedRow;
  const knownValues = playerFirstPaintKnownValues(row);
  const rememberKnown = (column, raw, display) => {
    if (knownValues[column] || raw === null || raw === undefined || raw === "") return;
    const text = String(display ?? raw).trim();
    if (!text) return;
    knownValues[column] = { raw, display: text };
  };
  const searchPositionsText = String(searchEntry?.positionsDisplay || "").trim();
  const searchPositions = searchPositionsText
    ? searchPositionsText.split(",").map((position) => position.trim()).filter(Boolean)
    : [];
  const searchOverall = Number(searchEntry?.overall || 0);
  if (searchEntry) {
    rememberKnown("name", searchEntry.nameDisplay || "", searchEntry.nameDisplay || "");
    rememberKnown("positions", searchPositionsText, searchPositionsText);
    rememberKnown("nationality", searchEntry.nationalityRaw ?? searchEntry.nationalityDisplay ?? "", searchEntry.nationalityDisplay || "");
    if (searchOverall > 0) rememberKnown("overall", searchOverall, formatPlainValue(searchOverall, "overall"));
  }

  const knownAgentName = String(knownValues.wallet_name?.display || "").trim();
  if (knownAgentName && !knownValues.wallet_address) {
    const normalizedName = normalizeSearchText(knownAgentName);
    const matches = state.agentSearchIndex.filter((entry) => normalizeSearchText(entry?.name || "") === normalizedName);
    if (matches.length === 1) rememberKnown("wallet_address", matches[0].walletAddress || "", matches[0].walletAddress || "");
  }

  const knownClubName = String(knownValues.active_contract_club_name?.display || "").trim();
  if (knownClubName && !knownValues.active_contract_club_id) {
    const normalizedName = normalizeSearchText(knownClubName);
    const matches = state.clubSearchIndex.filter((entry) => normalizeSearchText(entry?.name || "") === normalizedName);
    if (matches.length === 1) rememberKnown("active_contract_club_id", matches[0].clubId || "", matches[0].clubId || "");
  }
  return {
    playerId: key,
    name: row ? formatCellValue(row, "name") : String(searchEntry?.nameDisplay || "").trim(),
    positions: row ? playerPositions(row) : searchPositions,
    overall: row ? statDisplayValue(row, "overall") : (searchOverall > 0 ? formatPlainValue(searchOverall, "overall") : ""),
    externalUrl: row ? formatCellValue(row, linkColumn) : "",
    knownValues,
  };
}

window.__mflBuildPlayerFirstPaintContext = playerFirstPaintNavigationContext;

function openPlayerPage(playerId) {
  const pendingContext = playerFirstPaintNavigationContext(playerId);
  const key = pendingContext.playerId;
  window.__mflPlayerFirstPaintPendingContext = pendingContext;
  setPage("player", true, { playerId: key, __mflPlayerFirstPaintContext: pendingContext });
}`,
    "Player pending first-paint handoff",
  );

  const contractLinkHelpers = contractLink.chunks
    .join("\n\n")
    .replaceAll("RELEASE_VERSION", "PLAYER_RELEASE_VERSION");
  playerParts.push(`const PLAYER_RELEASE_VERSION = String(window.__mflReleaseVersion || "");\n\n${contractLinkHelpers}`);
  playerParts.push(`${playerRenderer}\n\nfunction renderPlayerPageWithStableContractLinkOwner(playerId) {
  const result = renderPlayerPageOwner.apply(this, arguments);
  bindContractTeamLink(playerId);
  return result;
}\n\nwindow.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;`);

  const sharedPlayerFacade = [
    "function renderPlayerPage(playerId) {",
    "  const owner = window.__mflRenderPlayerPageOwner;",
    '  if (typeof owner !== "function") {',
    '    throw new Error("Player route core is not loaded.");',
    "  }",
    "  return owner(playerId);",
    "}",
    "",
  ].join("\n");
  const modalMarker = "function showModal(modal) {";
  if (!core.includes(modalMarker)) {
    throw new Error("Could not install the shared Player renderer facade.");
  }
  core = core.replace(modalMarker, `${sharedPlayerFacade}${modalMarker}`);

  return finalizeSplitArtifacts(
    core,
    routeChunks,
    "player",
    playerParts.join("\n\n"),
    "Player",
  );
}
