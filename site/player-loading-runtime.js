(() => {
  "use strict";

  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-player-label-v1:";
  const PLAYER_POSITION_STORAGE_PREFIX = "mfl-player-position-v1:";
  const PLAYER_SNAPSHOT_STORAGE_PREFIX = "mfl-player-snapshot-v1:";
  const EVALUATION_PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
  const PROFILE_LABELS = ["Nationality", "Age", "Height", "Foot", "Seasons", "Agent", "Contract"];
  const ATTRIBUTE_LABELS = ["Overall", "Pace", "Dribbling", "Shooting", "Defense", "Passing", "Physical"];
  const ATTRIBUTE_VIEWS = [
    ["attributes", "Attributes"],
    ["training", "Training"],
    ["next", "Next Overall"],
    ["current", "Current Season"],
    ["all", "All Time"],
  ];
  const PITCH_ROWS = [["ST"], ["LW", "CF", "RW"], ["CAM"], ["LM", "CM", "RM"], ["LWB", "CDM", "RWB"], ["LB", "CB", "RB"], ["GK"]];
  const sessionPlayerSnapshots = new Map();
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

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function cleanTextMap(value) {
    const normalized = {};
    Object.entries(safeObject(value)).forEach(([key, entry]) => {
      const label = String(key || "").trim();
      if (!label) return;
      normalized[label] = entry === null || entry === undefined ? "" : String(entry).trim();
    });
    return normalized;
  }

  function cleanPitchRatings(value) {
    const normalized = {};
    Object.entries(safeObject(value)).forEach(([position, entry]) => {
      const key = String(position || "").trim().toUpperCase();
      const data = safeObject(entry);
      const familiarity = String(data.familiarity || "").trim();
      const rating = String(data.rating ?? "").trim();
      if (!key || !["primary", "secondary", "fair", "some"].includes(familiarity) || !rating) return;
      normalized[key] = { familiarity, rating };
    });
    return normalized;
  }

  function cleanCssColor(value) {
    const color = String(value || "").trim();
    if (!color) return "";
    try {
      return CSS.supports("color", color) ? color : "";
    } catch {
      return "";
    }
  }

  function cleanProfileMeta(value) {
    const source = safeObject(value);
    const normalized = {};

    const nationality = safeObject(source.nationality);
    const flagCodepoints = String(nationality.flagCodepoints || "").trim().toLowerCase();
    if (/^[0-9a-f]+(?:-[0-9a-f]+)*$/.test(flagCodepoints)) {
      normalized.nationality = { flagCodepoints };
    }

    const contract = safeObject(source.contract);
    const teamName = String(contract.teamName || "").trim();
    const clubId = String(contract.clubId || "").trim();
    const divisionName = String(contract.divisionName || "").trim();
    const divisionColor = cleanCssColor(contract.divisionColor);
    if (teamName || clubId || divisionName || divisionColor) {
      normalized.contract = { teamName, clubId, divisionName, divisionColor };
    }

    return normalized;
  }

  function normalizedSnapshot(snapshot) {
    const source = safeObject(snapshot);
    const normalized = {
      profile: cleanTextMap(source.profile),
      profileMeta: cleanProfileMeta(source.profileMeta),
      attributes: cleanTextMap(source.attributes),
      pitchRatings: cleanPitchRatings(source.pitchRatings),
    };
    ["name", "positions", "externalHref", "notes"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        normalized[key] = source[key] === null || source[key] === undefined ? "" : String(source[key]).trim();
      }
    });
    if (typeof source.inWatchlist === "boolean") normalized.inWatchlist = source.inWatchlist;
    if (typeof source.pitchHtml === "string" && source.pitchHtml.trim()) normalized.pitchHtml = source.pitchHtml;
    return normalized;
  }

  function mergeSnapshots(base, next) {
    const first = normalizedSnapshot(base);
    const second = normalizedSnapshot(next);
    const merged = {
      ...first,
      profile: { ...first.profile, ...second.profile },
      profileMeta: { ...first.profileMeta, ...second.profileMeta },
      attributes: { ...first.attributes, ...second.attributes },
      pitchRatings: { ...first.pitchRatings, ...second.pitchRatings },
    };
    ["name", "positions", "externalHref", "notes", "inWatchlist", "pitchHtml"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(second, key)) merged[key] = second[key];
    });
    return merged;
  }

  function persistentPlayerSnapshot(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return {};
    try {
      return normalizedSnapshot(JSON.parse(localStorage.getItem(`${PLAYER_SNAPSHOT_STORAGE_PREFIX}${id}`) || "null"));
    } catch {
      return {};
    }
  }

  function storedPlayerSnapshot(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return {};
    let snapshot = persistentPlayerSnapshot(id);
    const sessionSnapshot = sessionPlayerSnapshots.get(id);
    if (sessionSnapshot) snapshot = mergeSnapshots(snapshot, sessionSnapshot);
    const legacyName = storedPlayerName(id);
    const legacyPosition = storedPlayerPosition(id);
    if (!snapshot.name && legacyName) snapshot.name = legacyName;
    if (!snapshot.positions && legacyPosition) snapshot.positions = legacyPosition;
    return snapshot;
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

  function storePlayerPosition(playerId, playerPosition) {
    const id = String(playerId || "").trim();
    const position = String(playerPosition || "").trim();
    if (!id || !position) return;
    try {
      localStorage.setItem(`${PLAYER_POSITION_STORAGE_PREFIX}${id}`, position);
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

  function storedPlayerPosition(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return "";
    try {
      return String(localStorage.getItem(`${PLAYER_POSITION_STORAGE_PREFIX}${id}`) || "").trim();
    } catch {
      return "";
    }
  }

  function storePlayerSnapshot(playerId, snapshot) {
    const id = String(playerId || "").trim();
    if (!id) return {};
    const merged = mergeSnapshots(storedPlayerSnapshot(id), snapshot);
    sessionPlayerSnapshots.set(id, merged);
    if (merged.name) storePlayerName(id, merged.name);
    if (merged.positions) storePlayerPosition(id, merged.positions);
    try {
      const persistent = { ...merged };
      delete persistent.pitchHtml;
      localStorage.setItem(`${PLAYER_SNAPSHOT_STORAGE_PREFIX}${id}`, JSON.stringify(persistent));
    } catch {
      // The current session snapshot remains available if browser storage is blocked.
    }
    return merged;
  }

  function profileSnapshotFromRenderedPage(detail) {
    const profile = {};
    detail?.querySelectorAll?.(".playerInfoPanel .detailGrid > div").forEach((card) => {
      const label = String(card.querySelector(":scope > span")?.textContent || "").trim();
      if (!label) return;
      if (label === "Contract") {
        const team = String(card.querySelector(".playerContractTeam")?.textContent || "").trim();
        const division = String(card.querySelector(".playerContractDivision")?.textContent || "").trim();
        profile[label] = [team, division].filter(Boolean).join(" · ") || String(card.querySelector(":scope > strong")?.textContent || "").trim();
        return;
      }
      profile[label] = String(card.querySelector(":scope > strong")?.textContent || "").trim();
    });
    return profile;
  }

  function profileMetaFromRenderedPage(detail) {
    const meta = {};
    const cards = Array.from(detail?.querySelectorAll?.(".playerInfoPanel .detailGrid > div") || []);
    const nationalityCard = cards.find((card) => String(card.querySelector(":scope > span")?.textContent || "").trim() === "Nationality");
    const flagSrc = String(nationalityCard?.querySelector("img.flagImage")?.getAttribute("src") || "");
    const flagMatch = flagSrc.match(/\/([0-9a-f]+(?:-[0-9a-f]+)*)\.svg(?:$|[?#])/i);
    if (flagMatch) meta.nationality = { flagCodepoints: flagMatch[1].toLowerCase() };

    const contractCard = cards.find((card) => String(card.querySelector(":scope > span")?.textContent || "").trim() === "Contract");
    const team = contractCard?.querySelector(".playerContractTeam");
    const division = contractCard?.querySelector(".playerContractDivision");
    const teamName = String(team?.textContent || "").trim();
    const clubId = String(team?.getAttribute?.("data-club-id") || "").trim();
    const divisionName = String(division?.textContent || "").trim();
    const divisionColor = String(division?.style?.color || "").trim();
    if (teamName || clubId || divisionName || divisionColor) {
      meta.contract = { teamName, clubId, divisionName, divisionColor };
    }
    return meta;
  }

  function attributeSnapshotFromRenderedPage(detail) {
    const attributes = {};
    detail?.querySelectorAll?.(".attributeGrid .playerAttributeCard").forEach((card) => {
      const label = String(card.querySelector(":scope > span")?.textContent || "").trim();
      if (!label) return;
      const value = card.querySelector(".attributeValueText")?.textContent
        ?? card.querySelector(":scope > strong")?.textContent
        ?? "";
      attributes[label] = String(value).trim();
    });
    return attributes;
  }

  function pitchRatingsFromRenderedPage(detail) {
    const ratings = {};
    detail?.querySelectorAll?.(".pitchPositionCircle").forEach((circle) => {
      const position = String(circle.querySelector("small")?.textContent || "").trim().toUpperCase();
      const rating = String(circle.querySelector("strong")?.textContent || "").trim();
      const familiarity = ["primary", "secondary", "fair", "some"].find((name) => circle.classList.contains(name)) || "";
      if (position && rating && familiarity) ratings[position] = { rating, familiarity };
    });
    return ratings;
  }

  function rememberRenderedPlayerSnapshot(playerId, detail) {
    const id = String(playerId || "").trim();
    if (!id || !(detail instanceof HTMLElement)) return;
    const watchButton = detail.querySelector("#playerWatchlistButton");
    const notesInput = detail.querySelector("#playerNotesInput");
    const pitch = detail.querySelector(".pitch");
    const snapshot = {
      name: detail.querySelector(".playerTitleName")?.textContent?.trim() || "",
      positions: detail.querySelector(".playerHero p")?.textContent?.trim() || "",
      profile: profileSnapshotFromRenderedPage(detail),
      profileMeta: profileMetaFromRenderedPage(detail),
      attributes: attributeSnapshotFromRenderedPage(detail),
      pitchRatings: pitchRatingsFromRenderedPage(detail),
      externalHref: detail.querySelector("#openPlayerExternalButton")?.getAttribute("href") || "",
      pitchHtml: pitch?.innerHTML || "",
    };
    if (watchButton instanceof HTMLElement) snapshot.inWatchlist = watchButton.classList.contains("active");
    if (notesInput instanceof HTMLTextAreaElement) snapshot.notes = notesInput.value;
    storePlayerSnapshot(id, snapshot);
  }

  function liveCorePlayerSnapshot(playerId) {
    const id = String(playerId || "").trim();
    if (!id) return null;
    window.__mflPlayerLoadingSnapshotId = id;
    try {
      return window.eval(`(() => {
        try {
          const id = String(window.__mflPlayerLoadingSnapshotId || "").trim();
          if (!id || typeof rowByPlayerId !== "function") return null;
          const row = rowByPlayerId(id);
          if (!row) return null;
          const loaded = (column) => typeof hasColumn === "function"
            ? hasColumn(column)
            : Array.isArray(state?.columns) && state.columns.includes(column);
          const plain = (column) => {
            if (!loaded(column)) return "";
            if (typeof formatCellValue === "function") return String(formatCellValue(row, column) ?? "").trim();
            const value = typeof getValue === "function" ? getValue(row, column) : "";
            return value === null || value === undefined ? "" : String(value).trim();
          };
          const raw = (column) => loaded(column) && typeof getValue === "function" ? getValue(row, column) : null;
          const positions = loaded("positions") && typeof playerPositions === "function"
            ? playerPositions(row).join(", ")
            : plain("positions");
          const primaryPosition = positions.split(",")[0]?.trim().toUpperCase() || "";
          const profile = {};
          const profileMeta = {};
          if (loaded("nationality")) {
            profile.Nationality = plain("nationality");
            const nationalityCode = typeof countryCodeForNationality === "function"
              ? String(countryCodeForNationality(raw("nationality")) || "").trim()
              : "";
            const flagCodepoints = nationalityCode
              ? (nationalityCode.includes("-")
                ? nationalityCode.toLowerCase()
                : nationalityCode.toUpperCase().split("").map((character) => (127397 + character.charCodeAt(0)).toString(16)).join("-"))
              : "";
            if (flagCodepoints) profileMeta.nationality = { flagCodepoints };
          }
          if (loaded("age")) profile.Age = plain("age");
          if (loaded("height")) {
            const height = plain("height");
            profile.Height = height && height !== "NULL" ? height + " cm" : height;
          }
          if (loaded("preferred_foot")) {
            profile.Foot = typeof formatFootedness === "function"
              ? String(formatFootedness(raw("preferred_foot")) ?? "").trim()
              : plain("preferred_foot");
          }
          if (loaded("player_seasons")) profile.Seasons = plain("player_seasons");
          if (loaded("wallet_name") || loaded("wallet_address")) {
            profile.Agent = typeof formatCellValue === "function"
              ? String(formatCellValue(row, "wallet_name") ?? "").trim()
              : String(raw("wallet_name") || raw("wallet_address") || "").trim();
          }
          if (loaded("active_contract_club_name")) {
            const active = typeof rowHasActiveContract === "function" ? rowHasActiveContract(row) : Boolean(raw("active_contract_club_name"));
            const team = typeof formatContractClubName === "function"
              ? String(formatContractClubName(row) ?? "").trim()
              : plain("active_contract_club_name");
            let division = "";
            let divisionColor = "";
            if (active && loaded("active_contract_club_division")) {
              const divisionInfo = typeof contractDivisionInfo === "function"
                ? contractDivisionInfo(raw("active_contract_club_division"))
                : null;
              division = divisionInfo?.name
                ? String(divisionInfo.name).trim()
                : (typeof formatContractDivision === "function"
                  ? String(formatContractDivision(raw("active_contract_club_division")) ?? "").trim()
                  : plain("active_contract_club_division"));
              divisionColor = String(divisionInfo?.color || "").trim();
            }
            const clubId = active && loaded("active_contract_club_id") ? String(raw("active_contract_club_id") || "").trim() : "";
            profile.Contract = [team, division].filter(Boolean).join(" · ");
            profileMeta.contract = { teamName: team, clubId, divisionName: division, divisionColor };
            if (active && loaded("active_contract_revenue_share") && typeof formatContractRevenueShare === "function") {
              const share = String(formatContractRevenueShare(raw("active_contract_revenue_share")) ?? "").trim();
              if (share) profile["Rev Share"] = share;
            }
          }

          const attributes = {};
          const attributeColumns = primaryPosition === "GK"
            ? [["overall", "Overall"], ["goalkeeping", "Goalkeeping"]]
            : [["overall", "Overall"], ["pace", "Pace"], ["dribbling", "Dribbling"], ["shooting", "Shooting"], ["defense", "Defense"], ["passing", "Passing"], ["physical", "Physical"]];
          attributeColumns.forEach(([column, label]) => {
            if (!loaded(column) && !(column === "overall" && primaryPosition === "GK" && loaded("goalkeeping"))) return;
            let value;
            if (column === "overall" && typeof statDisplayValue === "function") value = statDisplayValue(row, column);
            else value = raw(column);
            attributes[label] = typeof formatPlainValue === "function"
              ? String(formatPlainValue(value, column) ?? "").trim()
              : (value === null || value === undefined ? "" : String(value).trim());
          });

          const pitchRatings = {};
          const ratingColumns = primaryPosition === "GK"
            ? ["goalkeeping"]
            : ["pace", "shooting", "passing", "dribbling", "defense", "physical"];
          const canRatePitch = Boolean(primaryPosition)
            && ratingColumns.every(loaded)
            && typeof familiarityForPosition === "function"
            && typeof positionRating === "function";
          if (canRatePitch) {
            [["ST"], ["LW", "CF", "RW"], ["CAM"], ["LM", "CM", "RM"], ["LWB", "CDM", "RWB"], ["LB", "CB", "RB"], ["GK"]].flat().forEach((position) => {
              const familiarity = familiarityForPosition(row, position);
              if (!familiarity) return;
              const rating = positionRating(row, position, familiarity);
              if (rating === null || rating === undefined) return;
              pitchRatings[position] = { familiarity, rating: String(rating) };
            });
          }

          const snapshot = {
            profile,
            profileMeta,
            attributes,
            pitchRatings,
            externalHref: "https://app.playmfl.com/players/" + encodeURIComponent(id),
          };
          if (loaded("name")) snapshot.name = plain("name");
          if (loaded("positions")) snapshot.positions = positions;
          if (typeof state === "object" && state?.walletPreferencesLoaded) {
            if (typeof playerIsInAnyWatchlist === "function") snapshot.inWatchlist = Boolean(playerIsInAnyWatchlist(id));
            if (typeof playerNote === "function") snapshot.notes = String(playerNote(id) || "");
          }
          if (canRatePitch && typeof renderPitch === "function") snapshot.pitchHtml = renderPitch(row);
          return snapshot;
        } catch {
          return null;
        }
      })()`);
    } catch {
      return null;
    } finally {
      delete window.__mflPlayerLoadingSnapshotId;
    }
  }

  function flagCodepointsFromImage(image) {
    const src = String(image?.getAttribute?.("src") || "");
    const match = src.match(/\/([0-9a-f]+(?:-[0-9a-f]+)*)\.svg(?:$|[?#])/i);
    return match ? match[1].toLowerCase() : "";
  }

  function tableRowSnapshot(row) {
    if (!(row instanceof HTMLTableRowElement)) return {};
    const table = row.closest("table");
    const headerCells = Array.from(table?.querySelectorAll("thead tr:last-child th") || []);
    const cells = Array.from(row.cells || []);
    const values = {};
    headerCells.forEach((header, index) => {
      const label = String(header.textContent || "").replace(/[▲▼]/g, "").trim();
      if (!label || !cells[index]) return;
      values[label] = String(cells[index].textContent || "").trim();
    });
    const profile = {};
    const profileMeta = {};
    const attributes = {};
    if (values.Nationality) {
      profile.Nationality = values.Nationality;
      const flagCodepoints = flagCodepointsFromImage(row.querySelector("img.flagImage"));
      if (flagCodepoints) profileMeta.nationality = { flagCodepoints };
    }
    if (values.Age) profile.Age = values.Age;
    if (values.Seasons) profile.Seasons = values.Seasons;
    if (values.Agent) profile.Agent = values.Agent;
    const clubName = values["Club Name"] || "";
    const division = values.Division || "";
    if (clubName || division) {
      profile.Contract = [clubName, division].filter(Boolean).join(" · ");
      const divisionElement = row.querySelector(".contractDivisionLabel");
      profileMeta.contract = {
        teamName: clubName,
        clubId: "",
        divisionName: division,
        divisionColor: String(divisionElement?.style?.color || "").trim(),
      };
    }
    if (values["Rev. Share"]) profile["Rev Share"] = values["Rev. Share"];
    ATTRIBUTE_LABELS.forEach((label) => {
      if (values[label]) attributes[label] = values[label].split(" (")[0].trim();
    });
    const snapshot = { profile, profileMeta, attributes };
    const name = values.Name || row.querySelector(".playerNameLink")?.textContent?.trim() || "";
    const positions = values.Positions || row.querySelector(".col-positions")?.textContent?.trim() || "";
    if (name) snapshot.name = name;
    if (positions) snapshot.positions = positions;
    return snapshot;
  }

  function searchResultSnapshot(searchResult) {
    if (!(searchResult instanceof HTMLElement)) return {};
    const summary = String(searchResult.querySelector(":scope > span")?.textContent || "");
    const parts = summary.split("·").map((part) => part.trim()).filter(Boolean);
    const overallPart = parts.find((part) => /^OVR\s+/i.test(part)) || "";
    const overall = overallPart.replace(/^OVR\s+/i, "").trim();
    const nationality = parts.length >= 3 ? parts.at(-2) : "";
    const positions = parts.length >= 4 ? parts.at(-1) : "";
    const flagCodepoints = flagCodepointsFromImage(searchResult.querySelector("img.flagImage"));
    const snapshot = {
      profile: nationality ? { Nationality: nationality } : {},
      profileMeta: flagCodepoints ? { nationality: { flagCodepoints } } : {},
      attributes: overall ? { Overall: overall } : {},
    };
    const name = searchResult.querySelector("strong")?.textContent?.trim() || "";
    if (name) snapshot.name = name;
    if (positions) snapshot.positions = positions;
    return snapshot;
  }

  function evaluationPlayerId() {
    const fromUrl = String(new URLSearchParams(window.location.search).get("player") || "").trim();
    if (fromUrl) return fromUrl;
    try {
      return String(window.eval("typeof state === 'object' ? (state.evaluationPlayerId || '') : ''") || "").trim();
    } catch {
      return "";
    }
  }

  function rememberNavigationPlayerSnapshot(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const playerLink = target.closest("a.playerNameLink[href]");
    if (playerLink instanceof HTMLAnchorElement) {
      const playerId = playerIdFromHref(playerLink.href);
      if (!playerId) return;
      const liveSnapshot = liveCorePlayerSnapshot(playerId) || {};
      const domSnapshot = tableRowSnapshot(playerLink.closest("tr"));
      storePlayerSnapshot(playerId, mergeSnapshots(domSnapshot, liveSnapshot));
      return;
    }

    const searchResult = target.closest('.searchResult[data-search-key^="player:"]');
    if (searchResult instanceof HTMLElement) {
      const key = String(searchResult.dataset.searchKey || "");
      const playerId = key.startsWith("player:") ? key.slice("player:".length).trim() : "";
      if (!playerId) return;
      const liveSnapshot = liveCorePlayerSnapshot(playerId) || {};
      storePlayerSnapshot(playerId, mergeSnapshots(searchResultSnapshot(searchResult), liveSnapshot));
      return;
    }

    if (target.closest("#evaluationPlayerPageButton")) {
      const playerId = evaluationPlayerId();
      if (!playerId) return;
      const liveSnapshot = liveCorePlayerSnapshot(playerId);
      if (liveSnapshot) storePlayerSnapshot(playerId, liveSnapshot);
    }
  }

  function storedWalletOptIn() {
    return document.documentElement.dataset.storedWalletOptIn === "true";
  }

  function nationalityMarkup(value, snapshot) {
    if (!value) return "";
    const nationality = safeObject(safeObject(snapshot?.profileMeta).nationality);
    const flagCodepoints = String(nationality.flagCodepoints || "").trim().toLowerCase();
    const flag = /^[0-9a-f]+(?:-[0-9a-f]+)*$/.test(flagCodepoints)
      ? `<img class="flagImage" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${flagCodepoints}.svg" alt="">`
      : '<span class="flagText" aria-hidden="true">-</span>';
    return `${flag} ${escapeHtml(value)}`;
  }

  function contractMarkup(value, snapshot) {
    if (!value) return "";
    const contract = safeObject(safeObject(snapshot?.profileMeta).contract);
    const fallbackParts = String(value).split(" · ").map((part) => part.trim()).filter(Boolean);
    const teamName = String(contract.teamName || fallbackParts[0] || "").trim();
    const clubId = String(contract.clubId || "").trim();
    const divisionName = String(contract.divisionName || fallbackParts.slice(1).join(" · ") || "").trim();
    const divisionColor = cleanCssColor(contract.divisionColor);
    const teamHtml = clubId
      ? `<a class="playerContractTeam playerContractTeamLink clubPageLink" href="/clubs/${encodeURIComponent(clubId)}/attributes" data-club-id="${escapeHtml(clubId)}">${escapeHtml(teamName)}</a>`
      : `<span class="playerContractTeam">${escapeHtml(teamName)}</span>`;
    const divisionStyle = divisionColor ? ` style="color: ${escapeHtml(divisionColor)}"` : "";
    const divisionHtml = divisionName ? `<span class="playerContractDivision"${divisionStyle}>${escapeHtml(divisionName)}</span>` : "";
    return `<span class="playerContractLine">${teamHtml}${divisionHtml}</span>`;
  }

  function profileCardsMarkup(snapshot) {
    const profile = safeObject(snapshot?.profile);
    const labels = [...PROFILE_LABELS];
    if (Object.prototype.hasOwnProperty.call(profile, "Rev Share") && profile["Rev Share"]) labels.push("Rev Share");
    return labels.map((label) => {
      const value = String(profile[label] ?? "").trim();
      const emptyClass = value ? "" : ' class="mflPlayerLoadingEmptyValue" aria-hidden="true"';
      let valueMarkup = value ? escapeHtml(value) : "&nbsp;";
      if (value && label === "Nationality") valueMarkup = nationalityMarkup(value, snapshot);
      if (value && label === "Contract") valueMarkup = contractMarkup(value, snapshot);
      return `
        <div${label === "Contract" ? ' class="contractDetailCard"' : ""}>
          <span>${label}</span>
          <strong${emptyClass}>${valueMarkup}</strong>
        </div>
      `;
    }).join("");
  }

  function rarityColorForOverall(overall) {
    const value = Number.parseFloat(String(overall || "").replace(/[^0-9.-]/g, ""));
    if (value >= 95) return "#00ffe9";
    if (value >= 85) return "#fa53ff";
    if (value >= 75) return "#0077ff";
    if (value >= 65) return "#71ff30";
    if (value >= 55) return "#ecd17f";
    return "#bebebe";
  }

  function primaryPosition(snapshot) {
    return String(snapshot?.positions || "").split(",")[0]?.trim().toUpperCase() || "";
  }

  function attributeCardsMarkup(snapshot) {
    const attributes = safeObject(snapshot?.attributes);
    const goalkeeper = primaryPosition(snapshot) === "GK";
    const labels = goalkeeper ? ["Overall", "Goalkeeping"] : ATTRIBUTE_LABELS;
    const rarity = rarityColorForOverall(attributes.Overall);
    return labels.map((label) => {
      const value = String(attributes[label] ?? "").trim();
      const featured = label === "Overall" && value ? " featured" : "";
      const fullWidth = label === "Overall" || (goalkeeper && label === "Goalkeeping") ? " fullWidth" : "";
      const style = label === "Overall" && value ? ` style="--rarity-color: ${rarity}"` : "";
      const valueClass = value ? "attributeValueText" : "attributeValueText mflPlayerLoadingEmptyValue";
      return `
        <div class="playerAttributeCard mflPlayerLoadingAttributeCard${featured}${fullWidth}"${style}>
          <span>${label}</span>
          <strong><span class="${valueClass}"${value ? "" : ' aria-hidden="true"'}>${value ? escapeHtml(value) : "&nbsp;"}</span></strong>
        </div>
      `;
    }).join("");
  }

  function attributeViewsMarkup() {
    return ATTRIBUTE_VIEWS.map(([view, label], index) => `
      <button
        class="playerAttributeViewButton mflPlayerLoadingControl${index === 0 ? " active" : ""}"
        type="button"
        data-player-attribute-view="${view}"
        aria-pressed="${index === 0 ? "true" : "false"}"
        aria-disabled="true"
        tabindex="-1"
      >${label}</button>
    `).join("");
  }

  function actionControlsMarkup(snapshot) {
    const inWatchlist = snapshot?.inWatchlist === true;
    const watchlistButton = storedWalletOptIn()
      ? `<button class="playerWatchlistButton mflPlayerLoadingControl${inWatchlist ? " active" : ""}" type="button" aria-disabled="true" tabindex="-1"><span class="watchlistButtonStar" aria-hidden="true">${inWatchlist ? "★" : "☆"}</span><span>${inWatchlist ? "In watchlist" : "Add to watchlist"}</span></button>`
      : "";
    return `
      <button class="playerEvaluateButton mflPlayerLoadingControl" type="button" aria-disabled="true" tabindex="-1">Evaluate</button>
      ${watchlistButton}
      <a class="playerExternalButton mflPlayerLoadingControl" aria-disabled="true" tabindex="-1">Open link</a>
    `;
  }

  function pitchMarkup(snapshot) {
    if (snapshot?.pitchHtml) return snapshot.pitchHtml;
    const ratings = safeObject(snapshot?.pitchRatings);
    const pitchLines = '<span class="pitchLine pitchBoxTop"></span><span class="pitchLine pitchGoalTop"></span><span class="pitchLine pitchArcTop"></span><span class="pitchLine pitchBoxBottom"></span><span class="pitchLine pitchGoalBottom"></span><span class="pitchLine pitchArcBottom"></span>';
    const rows = PITCH_ROWS.map((pitchRow) => `
      <div class="pitchRow pitchRow${pitchRow.length}" style="--pitch-columns: ${pitchRow.length}">
        ${pitchRow.map((position) => {
          const entry = safeObject(ratings[position]);
          const familiarity = String(entry.familiarity || "");
          const rating = String(entry.rating || "");
          const content = familiarity && rating
            ? `<span class="pitchPositionCircle ${escapeHtml(familiarity)}" title="${escapeHtml(`${position} ${rating}`)}"><strong>${escapeHtml(rating)}</strong><small>${position}</small></span>`
            : '<span class="pitchPositionBlank" aria-hidden="true"></span>';
          return `<div class="pitchPositionSlot">${content}</div>`;
        }).join("")}
      </div>
    `).join("");
    return pitchLines + rows;
  }

  function playerLoadingMarkup(playerId) {
    const id = escapeHtml(playerId);
    const snapshot = storedPlayerSnapshot(playerId);
    const playerName = String(snapshot.name || "").trim();
    const playerPosition = String(snapshot.positions || "").trim();
    const nameMarkup = playerName
      ? `<span class="playerTitleName">${escapeHtml(playerName)}</span>`
      : '<span class="playerTitleName mflPlayerLoadingEmptyName" aria-hidden="true">&nbsp;</span>';
    const positionMarkup = playerPosition
      ? `<span>${escapeHtml(playerPosition)}</span>`
      : '<span class="mflPlayerLoadingEmptyPosition" aria-hidden="true">&nbsp;</span>';
    const notes = Object.prototype.hasOwnProperty.call(snapshot, "notes") ? String(snapshot.notes || "") : "";
    const notesMarkup = storedWalletOptIn()
      ? `
        <div class="playerPanel playerNotesPanel">
          <h3>Notes</h3>
          <div class="playerNotesInputWrap">
            <textarea class="playerNotesInput mflPlayerLoadingNotes" aria-hidden="true" disabled>${escapeHtml(notes)}</textarea>
            <span class="playerNotesCount">${notes.length}/100</span>
          </div>
        </div>
      `
      : "";

    return `
      <section class="playerHero" data-mfl-player-loading-shell="true" aria-busy="true">
        <div>
          <span class="playerEyebrow playerIdText">ID #${id}</span>
          <h2 class="playerTitle">${nameMarkup}</h2>
          <p>${positionMarkup}</p>
        </div>
        <div class="playerHeroActions">${actionControlsMarkup(snapshot)}</div>
      </section>
      <section class="playerGrid" data-mfl-player-loading-grid="true">
        <div class="playerStack">
          <div class="playerPanel playerInfoPanel">
            <h3>Profile</h3>
            <div class="detailGrid">${profileCardsMarkup(snapshot)}</div>
          </div>
          <div class="playerPanel attributesPanel">
            <div class="playerPanelHeader">
              <h3>Attributes</h3>
              <div class="playerAttributeViews">${attributeViewsMarkup()}</div>
            </div>
            <div class="attributeGrid">${attributeCardsMarkup(snapshot)}</div>
          </div>
          ${notesMarkup}
        </div>
        <div class="playerPanel pitchPanel">
          <h3>Positions</h3>
          <div class="pitch mflPlayerLoadingPitch" aria-hidden="true">${pitchMarkup(snapshot)}</div>
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

      #playerDetail .mflPlayerLoadingControl {
        pointer-events: none;
      }

      #playerDetail .mflPlayerLoadingAttributeCard {
        cursor: default;
      }

      #playerDetail .mflPlayerLoadingNotes {
        pointer-events: none;
        resize: none;
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
      rememberRenderedPlayerSnapshot(playerId, detail);
      return false;
    }

    if (detail.querySelector('[data-mfl-player-loading-shell="true"]')) return true;
    const loadingText = String(detail.textContent || "").trim();
    const loadingPlaceholder = !detail.children.length || loadingText === "Loading player...";
    if (!force && !loadingPlaceholder) return false;

    const liveSnapshot = liveCorePlayerSnapshot(playerId);
    if (liveSnapshot) storePlayerSnapshot(playerId, liveSnapshot);

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
      rememberRenderedPlayerSnapshot(playerId, detail);
      delete detail.dataset.mflPlayerLoading;
      return;
    }

    if (detail.querySelector('[data-mfl-player-loading-shell="true"]')) return;
    const text = String(detail.textContent || "").trim();
    if (!detail.children.length || text === "Loading player...") renderSkeleton();
  }

  document.addEventListener("pointerdown", rememberNavigationPlayerSnapshot, true);
  document.addEventListener("click", rememberNavigationPlayerSnapshot, true);
  installStyles();
  renderSkeleton({ force: true });

  const playerDetail = document.getElementById("playerDetail");
  if (playerDetail instanceof HTMLElement) {
    const observer = new MutationObserver(() => queueMicrotask(syncPlayerLoadingState));
    observer.observe(playerDetail, { childList: true });
  }

  window.addEventListener("popstate", () => queueMicrotask(() => renderSkeleton({ force: true })));
})();