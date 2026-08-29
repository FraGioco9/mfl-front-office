// Generated Player core chunk from modules/app-core.js. Do not edit directly.
(() => {
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
  const PLAYER_PENDING_OVERALL_BACKGROUND = "var(--surface)";
  const PLAYER_LOADED_OVERALL_BACKGROUND = "linear-gradient(180deg, color-mix(in srgb, var(--rarity-color) 67%, transparent) 0%, var(--color-bg-default-secondary) 100%), linear-gradient(0deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2))";
  const PLAYER_CONTEXT_CACHE_PREFIX = "mfl-player-first-paint-v1:";
  const PLAYER_NOTE_MAX_LENGTH = 100;
  const PLAYER_DETAIL_REQUIRED_COLUMNS = ["height", "preferred_foot", "goalkeeping", "retirement_years"];
  const PLAYER_READY_TRANSITION = "color 180ms ease, opacity 180ms ease, background-color 180ms ease, border-color 180ms ease";
  const portraitSources = new Map();
  let activeHeroActionMenu = null;
  let pendingDetailPlayerId = "";
  let readyDetailPlayerId = "";
  let readyTransitionPlayerId = "";
  let rarityPaintPlayerId = "";

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

  function hasLoadedOverall(overall) {
    const text = String(overall ?? "").trim();
    if (!text) return false;
    const value = Number(text);
    return Number.isFinite(value) && value > 0;
  }

function applyLoadedOverallBackground(box, complete = false) {
  if (!(box instanceof HTMLElement)) return false;
  box.style.background = PLAYER_LOADED_OVERALL_BACKGROUND;
  box.style.backgroundColor = "var(--surface)";
  box.style.backgroundPosition = "center bottom, center";
  box.style.backgroundRepeat = "no-repeat";
  box.style.backgroundSize = complete ? "100% 100%, 100% 100%" : "100% 0%, 100% 0%";
  return true;
}

function overallRarityPaintComplete(box) {
  if (!(box instanceof HTMLElement)) return false;
  const detail = box.closest("#playerDetail");
  return detail instanceof HTMLElement && detail.classList.contains("playerOverallRarityPaintComplete");
}

function applyOverallBoxAppearance(box, overall) {
  if (!(box instanceof HTMLElement)) return false;
  const loaded = hasLoadedOverall(overall);
  box.classList.toggle("isPending", !loaded);
  if (!loaded) {
    box.style.removeProperty("--rarity-color");
    box.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;
    return false;
  }
  box.style.setProperty("--rarity-color", rarityColor(overall));
  if (overallRarityPaintComplete(box)) {
    applyLoadedOverallBackground(box, true);
  } else {
    box.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;
  }
  return true;
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
    rarityPaintPlayerId = "";
    const detail = document.getElementById("playerDetail");
    if (detail instanceof HTMLElement) {
      detail.classList.remove("playerOverallRarityPaintComplete");
      detail.removeAttribute("data-player-overall-rarity-painted");
    }
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
    const matchingRow = payload.rows.find((row) => Array.isArray(row) && normalizePlayerId(row[playerIdIndex]) === routePlayerId);
    if (!matchingRow || matchingRow.length !== payload.columns.length) return false;
    readyDetailPlayerId = routePlayerId;
    return true;
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
    overall.style.background = PLAYER_PENDING_OVERALL_BACKGROUND;
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
      const overallLoaded = applyOverallBoxAppearance(overall, context.overall);
      overallValue.style.color = overallLoaded ? "var(--text)" : "var(--text-soft)";
      overallValue.textContent = overallLoaded ? context.overall : loadingBlank();
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
      primary.style.color = unavailable ? "var(--text-soft)" : "#ffffff";
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

function animateReadyOverallBoxes(container = document) {
  const playerId = playerIdFromLocation();
  const detail = container instanceof HTMLElement && container.id === "playerDetail"
    ? container
    : document.getElementById("playerDetail");
  if (!playerId || !(detail instanceof HTMLElement)) return false;
  if (rarityPaintPlayerId === playerId || detail.dataset.playerOverallRarityPainted === playerId) return false;
  const boxes = Array.from(detail.querySelectorAll(".playerHeroOverall:not(.isPending), .playerAttributeCard.featured:not(.isPending)"))
    .filter((box) => box instanceof HTMLElement);
  if (!boxes.length) return false;
  rarityPaintPlayerId = playerId;
  detail.dataset.playerOverallRarityPainted = playerId;
  const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  boxes.forEach((box) => {
    applyLoadedOverallBackground(box, reduceMotion);
    if (reduceMotion) return;
    box.classList.add("rarityPaintOnce");
  });
  detail.classList.add("playerOverallRarityPaintComplete");
  return true;
}

function animateReadyControls(container = document) {
  const playerId = playerIdFromLocation();
  if (!playerId || readyTransitionPlayerId !== playerId) return false;
  const controls = Array.from(container?.querySelectorAll?.(".playerHeroActionMenuButton, .playerAttributeViewButton") || [])
    .filter((control) => control instanceof HTMLElement);
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
  if (playerAttributeLoadingActive(playerId)) {
    scheduleReadyControlsAfterLoading(playerId);
    return false;
  }
  readyTransitionPlayerId = "";
  const rarityPainted = animateReadyOverallBoxes(container);
  if (!controls.length) return rarityPainted;
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
    } else if (identity instanceof HTMLElement && media.nextElementSibling !== identity) {
      hero.insertBefore(media, identity);
    }
    updateHeroMedia(media, context);
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
  const raw = knownRawValue(context, column);
  if (raw !== "") {
    try {
      return String(formatPlainValue(raw, column) ?? "").trim();
    } catch {
      return String(raw).trim();
    }
  }
  if (column !== "overall") return "";
  return String(context.overall || "").replace(/\s*\([+-]?\d+(?:\.\d+)?\)\s*$/, "").trim();
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
      if (column === "overall") applyOverallBoxAppearance(card, context.overall);
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

let readyControlsAfterLoadingFrame = 0;
let readyControlsAfterLoadingPlayerId = "";

function playerAttributeLoadingActive(playerIdValue = playerIdFromLocation()) {
  const playerId = normalizePlayerId(playerIdValue);
  if (!playerId) return false;
  const root = document.documentElement;
  return pendingDetailPlayerId === playerId
    || root.classList.contains("mflDataLoading")
    || root.classList.contains("mflSingleRenderPending")
    || root.classList.contains("mflNavigationPending");
}

function attributeViewForRender(selectedView, playerIdValue = playerIdFromLocation()) {
  return playerAttributeLoadingActive(playerIdValue) ? "attributes" : selectedView;
}

function scheduleReadyControlsAfterLoading(playerIdValue) {
  const playerId = normalizePlayerId(playerIdValue);
  if (!playerId) return false;
  if (readyControlsAfterLoadingFrame && readyControlsAfterLoadingPlayerId === playerId) return true;
  if (readyControlsAfterLoadingFrame) window.cancelAnimationFrame(readyControlsAfterLoadingFrame);
  readyControlsAfterLoadingPlayerId = playerId;
  const run = () => {
    readyControlsAfterLoadingFrame = 0;
    if (playerIdFromLocation() !== playerId || readyTransitionPlayerId !== playerId) {
      readyControlsAfterLoadingPlayerId = "";
      return;
    }
    if (playerAttributeLoadingActive(playerId)) {
      readyControlsAfterLoadingFrame = window.requestAnimationFrame(run);
      return;
    }
    readyControlsAfterLoadingPlayerId = "";
    const owner = window.__mflRenderPlayerPageOwner;
    if (typeof owner === "function") owner(playerId);
    const detail = document.getElementById("playerDetail");
    if (detail instanceof HTMLElement) animateReadyControls(detail);
  };
  readyControlsAfterLoadingFrame = window.requestAnimationFrame(run);
  return true;
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
    const routeContext = { playerId: routePlayerId };
    beginDetailNavigation(routeContext);
    renderPending(routeContext);
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
    attributeViewForRender,
    beginDetailNavigation,
    markDetailPayloadReady,
    detailDataReady,
  });
})();

function showPlayerNoteTooltip(icon) {
  if (Date.now() < state.tooltipSuppressedUntil) {
    return;
  }
  const note = icon?.dataset?.noteTooltip || icon?.dataset?.tooltip || "";
  if (!note) {
    return;
  }
  if (state.playerNoteTooltipHideTimer) {
    window.clearTimeout(state.playerNoteTooltipHideTimer);
    state.playerNoteTooltipHideTimer = null;
  }

  let tooltip = document.querySelector(".playerNoteFloatingTooltip");
  if (!tooltip || state.playerNoteTooltipText !== note) {
    removePlayerNoteTooltip();
    tooltip = document.createElement("div");
    tooltip.className = "playerNoteFloatingTooltip";
    tooltip.textContent = note;
    document.body.appendChild(tooltip);
  }
  state.playerNoteTooltipText = note;

  const iconRect = icon.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  const tableAgentCell = icon.classList.contains("agentTableLink") ? icon.closest("#tableBody td") : null;
  const agentTooltipAnchorWidth = measureTooltipAnchorWidth(icon);
  const tooltipHeight = Number(window.__mflTooltipHeight) || 6;
  let left;
  if (tableAgentCell) {
    const cellRect = tableAgentCell.getBoundingClientRect();
    const cellStyle = getComputedStyle(tableAgentCell);
    const cellPaddingLeft = Number.parseFloat(cellStyle.paddingLeft || "0") || 0;
    const agentAnchorLeft = cellRect.left + cellPaddingLeft;
    const agentAnchorCenter = agentAnchorLeft + agentTooltipAnchorWidth / 2;
    left = agentAnchorCenter - tooltipRect.width / 2;
  } else {
    left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
  }
  left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

  let top = iconRect.top - tooltipRect.height - tooltipHeight;
  if (top < margin) {
    top = iconRect.bottom + tooltipHeight;
  }
  if (top + tooltipRect.height > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - tooltipRect.height - margin);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.remove("tooltipHiding");
  window.requestAnimationFrame(() => tooltip.classList.add("visible"));
}

function setPlayerNote(playerId, note) {
  const key = String(playerId || "").trim();
  if (!key) {
    return;
  }

  const text = sanitizePlayerNote(note);
  if (text) {
    state.playerNotes[key] = text;
  } else {
    delete state.playerNotes[key];
  }

  state.walletPreferencesLoaded = true;
  saveWalletNotesLocally();
  queueWalletNotesSave();

  if (state.currentPage === "player") {
    const titleIcon = playerDetail.querySelector("[data-player-note-title-icon]");
    if (titleIcon) {
      titleIcon.innerHTML = playerNoteIconHtml(key);
    }
  }

  if (tablePageKey()) {
    applyFilters();
  }
}

function normalizePlayerAttributeView(viewName, row = null) {
  const allowedViews = allowedPlayerAttributeViews(row).map(([view]) => view);
  return allowedViews.includes(viewName) ? viewName : allowedViews[0];
}

function formatFootedness(value) {
  const text = formatPlainValue(value, "preferred_foot");

  if (text === "NULL") {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function shortStatLabel(column) {
  return {
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
  }[column] || String(columnLabels[column] || column).toUpperCase();
}

function playerNoteIconHtml(playerId, includeTooltip = false) {
  if (!playerHasNote(playerId)) {
    return "";
  }

  const note = playerNote(playerId);
  const tooltip = includeTooltip ? ` data-tooltip="${escapeHtml(note)}"` : "";
  return `<span class="playerNoteIcon"${tooltip} aria-label="Player note">\u{1F4DD}</span>`;
}

function measureTooltipAnchorWidth(icon, sample = "0000000000") {
  const style = getComputedStyle(icon);
  const ruler = document.createElement("span");
  ruler.style.position = "fixed";
  ruler.style.left = "-9999px";
  ruler.style.top = "-9999px";
  ruler.style.visibility = "hidden";
  ruler.style.whiteSpace = "nowrap";
  ruler.style.font = style.font;
  ruler.style.letterSpacing = style.letterSpacing;
  ruler.textContent = sample;
  document.body.appendChild(ruler);
  const width = ruler.getBoundingClientRect().width;
  ruler.remove();
  return width;
}

function queueWalletNotesSave() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  window.clearTimeout(state.walletNotesSaveTimer);
  state.walletNotesSaveTimer = window.setTimeout(() => {
    void saveWalletPreferencesNow();
  }, 500);
}

function allowedPlayerAttributeViews(row = null) {
  return !playerCanViewProgression(row)
    ? [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"]]
    : [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"], ["current", "Current Season"], ["all", "All Time"]];
}

function createWatchlistStar(playerId, labelText = "player") {
  const key = String(playerId);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "watchlistStar";
  button.classList.toggle("active", state.watchlistPlayerIds.has(key));
  button.textContent = state.watchlistPlayerIds.has(key) ? "\u2605" : "\u2606";
  button.title = state.watchlistPlayerIds.has(key) ? "Remove from watchlist" : "Add to watchlist";
  button.setAttribute("aria-label", `${button.title}: ${labelText}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleWatchlistPlayer(key, true);
  });
  return button;
}

function renderPitch(row) {
  const pitchLines = `<span class="pitchLine pitchBoxTop"></span><span class="pitchLine pitchGoalTop"></span><span class="pitchLine pitchArcTop"></span><span class="pitchLine pitchBoxBottom"></span><span class="pitchLine pitchGoalBottom"></span><span class="pitchLine pitchArcBottom"></span>`;
  return pitchLines + PITCH_ROWS.map((pitchRow) => `
    <div class="pitchRow pitchRow${pitchRow.length}" style="--pitch-columns: ${pitchRow.length}">
      ${pitchRow.map((position) => {
        const familiarity = familiarityForPosition(row, position);
        const rating = positionRating(row, position, familiarity);
        const content = familiarity
          ? `<span class="pitchPositionCircle ${familiarity}"><strong>${rating}</strong><small>${position}</small></span>`
          : `<span class="pitchPositionBlank" aria-hidden="true"></span>`;
        return `<div class="pitchPositionSlot" style="cursor:default;user-select:none;-webkit-user-select:none">${content}</div>`;
      }).join("")}
    </div>`).join("");
}

function playerTrainingKey(row) {
  return String(getValue(row, "player_id") || "");
}

function trainingStatColumns(row) {
  return playerAttributeColumns(row).filter((column) => column !== "overall");
}

function setRowValue(row, column, value) {
  const index = state.columns.indexOf(column);
  if (index >= 0) {
    row[index] = value;
  }
}

function trainingAdjustmentFor(row, column) {
  const key = playerTrainingKey(row);
  return Number(state.trainingAdjustments[key]?.[column] || 0);
}

function adjustedTrainingValue(row, column) {
  const base = Number(getValue(row, column) || 0);
  return Math.max(0, Math.min(99, base + trainingAdjustmentFor(row, column)));
}

function trainingRow(row) {
  const adjustedRow = [...row];

  trainingStatColumns(row).forEach((column) => {
    setRowValue(adjustedRow, column, adjustedTrainingValue(row, column));
  });

  if (!playerIsGoalkeeper(adjustedRow)) {
    setRowValue(adjustedRow, "overall", displayedPrimaryOverall(adjustedRow));
  }

  return adjustedRow;
}

function adjustTrainingStat(playerId, column, delta) {
  const row = rowByPlayerId(playerId);

  if (!row || !trainingStatColumns(row).includes(column)) {
    return;
  }

  const key = playerTrainingKey(row);
  const currentAdjustment = trainingAdjustmentFor(row, column);
  const baseValue = Number(getValue(row, column) || 0);
  const nextValue = Math.max(0, Math.min(99, baseValue + currentAdjustment + delta));
  const nextAdjustment = nextValue - baseValue;

  state.trainingAdjustments[key] = { ...(state.trainingAdjustments[key] || {}) };

  if (nextAdjustment === 0) {
    delete state.trainingAdjustments[key][column];
  } else {
    state.trainingAdjustments[key][column] = nextAdjustment;
  }

  if (!Object.keys(state.trainingAdjustments[key]).length) {
    delete state.trainingAdjustments[key];
  }

  renderPlayerPage(playerId);
}

function resetTrainingStats(playerId) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    return;
  }

  delete state.trainingAdjustments[playerTrainingKey(row)];
  renderPlayerPage(playerId);
}

function replayTrainingControlHover(control) {
  if (!control) {
    return;
  }

  control.classList.add("trainingHoverReset");
  void control.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => control.classList.remove("trainingHoverReset"));
  });
}

function playerAttributeColumns(row) {
  if (playerIsGoalkeeper(row)) {
    return ["overall", "goalkeeping"].filter((column) => column === "overall" || state.columns.includes(column));
  }

  return ["overall", "pace", "dribbling", "shooting", "defense", "passing", "physical"];
}

function playerAttributeContributionTooltip(row, column) {
  if (column === "overall") {
    return "";
  }

  const primary = playerPositions(row)[0];
  const weight = POSITION_GROUP_WEIGHTS[primary]?.[column];
  const label = column === "goalkeeping" ? "Goalkeeping" : columnLabels[column];

  if (weight === undefined || !primary || !label) {
    return "";
  }

  return ` data-tooltip="${escapeHtml(`${label} contributes to ${weight}% of the overall for the ${primary} position.`)}"`;
}

function nextOverallDetailHtml(row, column) {
  const gap = nextOverallGap(row);
  const primary = playerPositions(row)[0];
  const weight = POSITION_GROUP_WEIGHTS[primary]?.[column] || 0;
  const maxOverall = Number(statDisplayValue(row, "overall") || 0) >= 99;

  if (column === "overall") {
    if (maxOverall) {
      return `<span class="nextOverallValue neutral">MAX</span>`;
    }

    return `<span class="nextOverallValue easy">+1 OVR IF +${formatDecimal(gap)}</span>`;
  }

  if (!weight) {
    return `<span class="nextOverallValue neutral">No OVR impact</span>`;
  }

  if (maxOverall || Number(getValue(row, column) || 0) >= 99) {
    return `<span class="nextOverallValue neutral">MAX</span>`;
  }

  const neededStatGain = gap / (weight / 100);
  const colorClass = nextOverallColorClass(neededStatGain);
  return `<span class="nextOverallValue ${colorClass}">+1 OVR IF +${formatRoundedUpDecimal(neededStatGain, 1)} ${escapeHtml(shortStatLabel(column))}</span>`;
}

function playerAttributeValueHtml(row, column, viewName) {
  if (viewName === "training") {
    if (column === "overall") {
      const value = displayedPrimaryOverall(row);
      return `${escapeHtml(formatPlainValue(value, column))} ${nextOverallDetailHtml(row, column)}`;
    }

    const value = escapeHtml(formatPlainValue(getValue(row, column), column));
    const adjustment = trainingAdjustmentFor(row, column);

    if (adjustment === 0) {
      return value;
    }

    const className = adjustment > 0 ? "positive" : "negative";
    return `${value} <span class="trainingDelta ${className}">${adjustment > 0 ? "+" : ""}${adjustment}</span>`;
  }

  if (viewName === "next") {
    const value = column === "overall" ? primaryPreciseOverall(row) : getValue(row, column);
    const formattedValue = column === "overall" ? formatDecimal(value) : escapeHtml(formatPlainValue(value, column));
    return `${formattedValue} ${nextOverallDetailHtml(row, column)}`;
  }

  const value = column === "overall" ? statDisplayValue(row, column) : getValue(row, column);
  const formattedValue = escapeHtml(formatPlainValue(value, column));

  if (viewName === "attributes") {
    return formattedValue;
  }

  const suffix = viewName === "current" ? "prog_current_season" : "prog_all";
  const progression = progressionValue(row, column, suffix);

  if (progression === 0) {
    return formattedValue;
  }

  const className = progression > 0 ? "positive" : "negative";
  return `${formattedValue} <span class="progressionValue ${className}">(${progression > 0 ? "+" : ""}${progression})</span>`;
}

function renderPlayerAttributePanel(row) {
  const columns = playerAttributeColumns(row);
  const viewName = normalizePlayerAttributeView(state.playerAttributeView, row);
  state.playerAttributeView = viewName;
  const isTraining = viewName === "training";

  return columns.map((column) => {
    const label = column === "goalkeeping" ? "Goalkeeping" : columnLabels[column];
    const featured = column === "overall" ? " featured" : "";
    const fullWidth = column === "overall" || (playerIsGoalkeeper(row) && column === "goalkeeping") ? " fullWidth" : "";
    const rarityStyle = ` style="--rarity-color: ${rarityColorForOverall(statDisplayValue(row, "overall"))}"`;
    const contributionTooltip = playerAttributeContributionTooltip(row, column);
    const valueHtml = playerAttributeValueHtml(row, column, viewName);
    const trainingControls = isTraining
      ? (column === "overall"
        ? `<span class="trainingStatControls"><button class="trainingResetButton" type="button" data-training-reset="1">Reset</button></span>`
        : `<span class="trainingStatControls"><button class="popupMinusButton" type="button" data-training-stat="${escapeHtml(column)}" data-training-delta="-1" aria-label="Reduce ${escapeHtml(label)}"></button><button class="popupAddButton" type="button" data-training-stat="${escapeHtml(column)}" data-training-delta="1" aria-label="Increase ${escapeHtml(label)}"></button></span>`)
      : "";
    return `<div class="playerAttributeCard${featured}${fullWidth}${isTraining ? " trainingCard" : ""}"${rarityStyle}><span>${escapeHtml(label)}</span><strong><span class="attributeValueText"${contributionTooltip}>${valueHtml}</span>${trainingControls}</strong></div>`;
  }).join("");
}

const PLAYER_RELEASE_VERSION = String(window.__mflReleaseVersion || "");

function contractClubId(playerId, teamName) {
    try {
      const row = rowByPlayerId(String(playerId || ""));
      const directId = String(getValue(row, "active_contract_club_id") || "").trim();
      if (directId) return directId;
      const normalizedName = String(teamName || "").trim().toLowerCase();
      const clubs = [
        ...(Array.isArray(state?.clubSearchIndex) ? state.clubSearchIndex : []),
        ...(Array.isArray(state?.bootstrapData?.clubs) ? state.bootstrapData.clubs : []),
      ];
      const club = clubs.find((item) => String(item?.name || "").trim().toLowerCase() === normalizedName);
      return String(club?.clubId || "").trim();
    } catch {
      return "";
    }
  }

function bindContractTeamLink(playerId) {
    const team = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam, #playerDetail .contractDetailCard .playerContractTeamLink");
    if (!team) return;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return;
    const clubId = contractClubId(playerId, teamName);
    if (!clubId) return;
    const href = "/clubs/" + encodeURIComponent(clubId) + "/squad";
    const link = team instanceof HTMLAnchorElement ? team : document.createElement("a");
    if (link !== team) {
      link.className = String(team.className || "playerContractTeam");
      link.textContent = teamName;
      team.replaceWith(link);
    }
    link.classList.add("clubPageLink", "playerContractTeamLink");
    link.href = href;
    link.dataset.clubId = clubId;
    if (link.dataset.mflReleaseContractBound === PLAYER_RELEASE_VERSION) return;
    link.dataset.mflReleaseContractBound = PLAYER_RELEASE_VERSION;
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (typeof window.mflOpenClubPage !== "function") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.mflOpenClubPage(clubId, "attributes");
    }, true);
  }

const playerDetailRenderReuse = createRenderReuseGuard();

function playerDetailRenderSignature(row, playerId, attributeView) {
  const key = String(playerId || "").trim();
  return JSON.stringify([
    key,
    state.columns,
    row,
    attributeView,
    Boolean(hasWalletOptIn()),
    normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),
    Boolean(state.walletPermissionAllowed),
    Boolean(state.watchlistPlayerIds.has(key)),
    playerNote(key),
    state.settingsDateFormat,
    state.settingsTimeFormat,
    state.trainingAdjustments[key] || null,
  ]);
}

function renderPlayerPageOwner(playerId) {
  const row = rowByPlayerId(playerId);

  if (window.__mflPlayerFirstPaintRuntime?.detailDataReady?.(row, playerId) === false) {
    const key = String(playerId || "").trim();
    const pendingContext = window.__mflPlayerFirstPaintPendingContext;
    window.__mflPlayerFirstPaintRuntime?.renderPending?.(
      String(pendingContext?.playerId || "").trim() === key ? pendingContext : { playerId: key },
    );
    return;
  }

  if (!row) {
    playerDetailRenderReuse.invalidate();
    window.__mflStaticUiRuntime?.showNotFound?.("Player");
    return;
  }
  const selectedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);
  const normalizedAttributeView = window.__mflPlayerFirstPaintRuntime?.attributeViewForRender?.(selectedAttributeView, playerId) || selectedAttributeView;
  const renderSignature = playerDetailRenderSignature(row, playerId, normalizedAttributeView);
  if (playerDetailRenderReuse.matches(
    renderSignature,
    playerDetail.firstElementChild?.classList.contains("playerHero"),
  )) {
    document.documentElement.dataset.initialEntityVerified = "player";
    return;
  }
  document.documentElement.dataset.initialEntityVerified = "player";

  const playerName = formatCellValue(row, "name");
  const id = formatCellValue(row, "player_id");
  const nationality = formatCellValue(row, "nationality");
  const rawNationality = getValue(row, "nationality");
  const positions = playerPositions(row);
  const height = formatCellValue(row, "height");
  const heightLabel = height === "NULL" ? height : `${height} cm`;
  const ageMarker = retirementMarker(row);
  const ageMarkerHtml = ageMarker
    ? ` <i class="retirementMarker playerAgeMarker retirementMarker--${escapeHtml(ageMarker.status || "default")}" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}"><img src="/retirement-${escapeHtml(ageMarker.icon)}.svg" width="16" height="16" alt="" aria-hidden="true"></i>`
    : "";
  const agentWalletAddress = getValue(row, "wallet_address");
  const agentTooltip = joinedAgencyTooltip(row);
  const agentTooltipHtml = agentTooltip ? ` data-tooltip="${escapeHtml(agentTooltip)}" aria-label="${escapeHtml(agentTooltip)}"` : "";
  const agentLinkHtml = `<a class="agentTableLink playerAgentLink" href="${escapeHtml(agentRoute(agentWalletAddress))}"${agentTooltipHtml}>${escapeHtml(formatCellValue(row, "wallet_name"))}</a>`;
  const contractDivision = rowHasActiveContract(row) ? contractDivisionInfo(getValue(row, "active_contract_club_division")) : null;
  const contractDivisionHtml = contractDivision ? `<span class="playerContractDivision" style="color: ${escapeHtml(contractDivision.color)}">${escapeHtml(contractDivision.name)}</span>` : "";
  const contractTeamName = formatContractClubName(row);
  const contractClubId = String(getValue(row, "active_contract_club_id") || "").trim();
  const contractTeamHtml = contractClubId
    ? `<a class="playerContractTeam playerContractTeamLink clubPageLink" href="/clubs/${encodeURIComponent(contractClubId)}/squad" data-club-id="${escapeHtml(contractClubId)}">${escapeHtml(contractTeamName)}</a>`
    : `<span class="playerContractTeam">${escapeHtml(contractTeamName)}</span>`;
  const contractLabel = `<span class="playerContractLine">${contractTeamHtml}${contractDivisionHtml}</span>`;
  const revenueShare = rowHasActiveContract(row) ? formatContractRevenueShare(getValue(row, "active_contract_revenue_share")) : "";
  const infoCardsData = [
    ["Nationality", `${countryFlagHtml(rawNationality)} ${escapeHtml(nationality)}`],
    ["Age", `${escapeHtml(formatCellValue(row, "age"))}${ageMarkerHtml}`],
    ["Height", escapeHtml(heightLabel)],
    ["Foot", escapeHtml(formatFootedness(getValue(row, "preferred_foot")))],
    ["Seasons", escapeHtml(formatCellValue(row, "player_seasons"))],
    ["Agent", agentLinkHtml],
    ["Contract", contractLabel],
  ];
  infoCardsData.push(["Rev Share", escapeHtml(revenueShare || "–")]);
  const infoCards = infoCardsData.map(([label, value]) => `<div${label === "Contract" ? " class=\"contractDetailCard\"" : ""}><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("");
  state.playerAttributeView = normalizedAttributeView;
  const displayRow = state.playerAttributeView === "training" ? trainingRow(row) : row;
  const viewButtons = allowedPlayerAttributeViews(row)
    .map(([view, label]) => `<button class="playerAttributeViewButton ${state.playerAttributeView === view ? "active" : ""}" type="button" data-player-attribute-view="${view}">${label}</button>`)
    .join("");

  playerDetail.innerHTML = `
    <section class="playerHero">
      <div class="playerHeroIdentity">
        <button id="copyPlayerIdButton" class="playerEyebrow playerIdText" type="button" data-tooltip="Click to copy" aria-label="Click to copy player ID">ID #${escapeHtml(id)}</button>
        <h2 class="playerTitle"><span class="playerTitleName">${escapeHtml(playerName)}</span>${listingPriceBadgeHtml(row)}<span class="playerTitleNoteIcon" data-player-note-title-icon>${playerNoteIconHtml(id)}</span></h2>
        <p>${escapeHtml(positions.join(", ") || "No positions")}</p>
      </div>
      <div class="playerHeroActions">
        <div class="playerHeroActionMenu">
          <a id="openPlayerExternalButton" class="playerExternalButton playerHeroPrimaryAction" href="${escapeHtml(formatCellValue(row, linkColumn))}" target="_blank" rel="noopener noreferrer">Open link</a>
          <button id="playerHeroActionMenuButton" class="playerHeroActionMenuButton" type="button" aria-label="More player actions" aria-haspopup="menu" aria-expanded="false"><svg class="playerHeroChevronIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg></button>
          <div id="playerHeroActionMenu" class="playerHeroActionMenuDropdown" role="menu" hidden>
            <button id="playerEvaluateButton" class="playerEvaluateButton playerHeroActionMenuItem" type="button" role="menuitem"><svg class="playerHeroMenuIcon playerEvaluateIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M17 7.5c-.8-1.4-2.4-2.2-5-2.2-3 0-5 1.3-5 3.4 0 2.4 2.4 3.1 5 3.4 3 .4 5 1.1 5 3.4 0 2.1-2 3.4-5 3.4-2.7 0-4.4-.9-5.3-2.5"></path></svg><span>Evaluate</span></button>
            ${hasWalletOptIn() ? '<button id="playerWatchlistButton" class="playerWatchlistButton playerHeroActionMenuItem" type="button" role="menuitem"></button>' : ""}
          </div>
        </div>
      </div>
    </section>
    <section class="playerGrid">
      <div class="playerStack">
        <div class="playerPanel playerInfoPanel"><h3>Profile</h3><div class="detailGrid">${infoCards}</div></div>
        <div class="playerPanel attributesPanel"><div class="playerPanelHeader"><h3>Attributes</h3><div class="playerAttributeViews">${viewButtons}</div></div><div class="attributeGrid">${window.__mflPlayerFirstPaintRuntime?.stableAttributePanelHtml?.(displayRow) || renderPlayerAttributePanel(displayRow)}</div></div>
        ${hasWalletOptIn() ? `<div class="playerPanel playerNotesPanel"><h3>Notes</h3><div class="playerNotesInputWrap"><textarea id="playerNotesInput" class="playerNotesInput" placeholder="Write private notes for this player..." maxlength="${PLAYER_NOTE_MAX_LENGTH}">${escapeHtml(playerNote(id))}</textarea><span id="playerNotesCount" class="playerNotesCount">${playerNote(id).length}/${PLAYER_NOTE_MAX_LENGTH}</span></div></div>` : ""}
      </div>
      <div class="playerPanel pitchPanel"><h3>Positions</h3><div class="pitch">${renderPitch(displayRow)}</div></div>
    </section>`;

  state.playerAttributeView = selectedAttributeView;
  window.__mflPlayerFirstPaintRuntime?.hydrateHero?.({
    container: playerDetail,
    playerId: id,
    name: playerName,
    positions,
    overall: statDisplayValue(row, "overall"),
    externalUrl: formatCellValue(row, linkColumn),
    knownValues: window.__mflPlayerFirstPaintRuntime?.snapshotRowKnownValues?.(row) || {},
  });
  const watchButton = playerDetail.querySelector("#playerWatchlistButton");
  if (watchButton) {
    const inAnyWatchlist = playerIsInAnyWatchlist(id);
    watchButton.className = `playerWatchlistButton playerHeroActionMenuItem ${inAnyWatchlist ? "active" : ""}`;
    watchButton.innerHTML = `<span class="watchlistButtonStar" aria-hidden="true">${inAnyWatchlist ? "\u2605" : "\u2606"}</span><span>${inAnyWatchlist ? "In watchlist" : "Add to watchlist"}</span>`;
    watchButton.addEventListener("click", () => {
      toggleWatchlistPlayer(id, true);
    });
  }
  window.__mflPlayerFirstPaintRuntime?.bindHeroActionMenu?.(playerDetail);
  window.__mflPlayerFirstPaintRuntime?.animateReadyControls?.(playerDetail);
  const evaluateButton = playerDetail.querySelector("#playerEvaluateButton");
  const openEvaluationForPlayer = (event) => {
    const targetPath = pagePath("evaluation", { playerId: id });

    rememberEvaluationResult(id);
    try {
      sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${id}`, playerName);
    } catch {
      // Session storage is an optional first-paint cache only.
    }

    if (event.ctrlKey || event.metaKey || event.button === 1) {
      window.open(targetPath, "_blank", "noopener");
      return;
    }

    state.evaluationPlayerId = id;
    evaluationSearchInput.value = playerName;
    clearEvaluationSearchFocus();
    setPage("evaluation", true, { playerId: id });
  };

  evaluateButton.addEventListener("click", openEvaluationForPlayer);
  evaluateButton.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
      openEvaluationForPlayer(event);
    }
  });
  const playerIdButton = playerDetail.querySelector("#copyPlayerIdButton");
  playerIdButton.addEventListener("mouseenter", () => showPlayerNoteTooltip(playerIdButton));
  playerIdButton.addEventListener("focus", () => showPlayerNoteTooltip(playerIdButton));
  playerIdButton.addEventListener("mouseleave", hidePlayerNoteTooltip);
  playerIdButton.addEventListener("blur", hidePlayerNoteTooltip);
  playerIdButton.addEventListener("click", (event) => {
    copyPlayerId(id);
    event.currentTarget.blur();
  });
  const playerAgentLink = playerDetail.querySelector(".playerAgentLink");
  if (playerAgentLink) {
    if (playerAgentLink.dataset.tooltip) {
      playerAgentLink.addEventListener("mouseenter", () => showPlayerNoteTooltip(playerAgentLink));
      playerAgentLink.addEventListener("focus", () => showPlayerNoteTooltip(playerAgentLink));
      playerAgentLink.addEventListener("mouseleave", hidePlayerNoteTooltip);
      playerAgentLink.addEventListener("blur", hidePlayerNoteTooltip);
    }
    playerAgentLink.addEventListener("click", (event) => {
      event.preventDefault();
      openAgentPage(agentWalletAddress, formatCellValue(row, "wallet_name"));
    });
  }
  playerDetail.querySelectorAll("[data-player-attribute-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.playerAttributeView;
      if (!nextView || nextView === state.playerAttributeView) return;
      state.playerAttributeView = nextView;
      saveTableState();
      renderPlayerPage(id);
    });
  });
  playerDetail.querySelectorAll("[data-training-stat]").forEach((button) => {
    button.addEventListener("click", () => {
      const stat = button.dataset.trainingStat;
      const delta = Number(button.dataset.trainingDelta || 0);
      adjustTrainingStat(id, stat, delta);
      const replacement = Array.from(playerDetail.querySelectorAll("[data-training-stat]")).find((candidate) =>
        candidate.dataset.trainingStat === stat && Number(candidate.dataset.trainingDelta || 0) === delta,
      );
      replayTrainingControlHover(replacement);
    });
  });
  playerDetail.querySelectorAll("[data-training-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      resetTrainingStats(id);
      replayTrainingControlHover(playerDetail.querySelector("[data-training-reset]"));
    });
  });
  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
  playerDetailRenderReuse.commit(renderSignature);
}

function renderPlayerPageWithStableContractLinkOwner(playerId) {
  const result = renderPlayerPageOwner.apply(this, arguments);
  bindContractTeamLink(playerId);
  return result;
}

window.__mflRenderPlayerPageOwner = renderPlayerPageWithStableContractLinkOwner;
