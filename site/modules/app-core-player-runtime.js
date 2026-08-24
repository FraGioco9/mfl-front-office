// Generated Player core chunk from modules/app-core.js. Do not edit directly.
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

function rarityColorForOverall(overall) {
  const value = Number(overall || 0);

  if (value >= 95) return "#00ffe9";
  if (value >= 85) return "#fa53ff";
  if (value >= 75) return "#0077ff";
  if (value >= 65) return "#71ff30";
  if (value >= 55) return "#ecd17f";
  return "#bebebe";
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

function toggleWatchlistPlayer(playerId, rerender = false) {
  const key = String(playerId);
  const playerName = rowByPlayerId(key) ? formatCellValue(rowByPlayerId(key), "name") : `Player ${key}`;
  const inAnyWatchlist = playerIsInAnyWatchlist(key);

  if (inAnyWatchlist) {
    const removedFrom = removePlayerIdFromAllWatchlists(key);
    state.watchlistPlayerIdsAdded.delete(key);
    state.watchlistPlayerIdsRemoved.add(key);
    saveTableState();
    if (removedFrom.length === 1) {
      showWatchlistToast(`${playerName} removed from`, removedFrom[0].id, removedFrom[0].name);
    } else if (removedFrom.length > 1) {
      showGenericToast(`${playerName} removed from ${removedFrom.length} watchlists.`);
    }
  } else {
    const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
    state.watchlists = watchlists;
    if (hasWalletOptIn() && watchlists.length > 1) {
      openWatchlistChoiceModal("add", [key]);
      return;
    }
    const target = activeWatchlist() || ensureDefaultWatchlist();
    const result = addPlayerIdsToWatchlist(target?.id || "", [key]);
    if (result.addedCount) {
      state.watchlistPlayerIdsAdded.add(key);
      state.watchlistPlayerIdsRemoved.delete(key);
      saveTableState();
      showWatchlistToast(`${playerName} added to`, target.id, target.name);
    }
    if (result.skippedCount) {
      showWatchlistFullToast();
      return;
    }
  }

  syncActiveWatchlistFromSet();

  if (state.currentPage === "watchlist") {
    applyFilters();
  } else if (rerender && tablePageKey()) {
    renderTable();
  }

  if (state.currentPage === "player") {
    renderPlayerPage(key);
  }
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
          ? `<span class="pitchPositionCircle ${familiarity}" title="${position} ${rating}"><strong>${rating}</strong><small>${position}</small></span>`
          : `<span class="pitchPositionBlank" aria-hidden="true"></span>`;
        return `<div class="pitchPositionSlot">${content}</div>`;
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

  if (!row) {
    playerDetailRenderReuse.invalidate();
    window.__mflStaticUiRuntime?.showNotFound?.("Player");
    return;
  }
  const normalizedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);
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
    ? ` <span class="retirementMarker playerAgeMarker retirementMarker--${escapeHtml(ageMarker.status || "default")}" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}"><img src="/retirement-${escapeHtml(ageMarker.icon)}.svg" width="16" height="16" alt="" aria-hidden="true"></span>`
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
  if (revenueShare) {
    infoCardsData.push(["Rev Share", escapeHtml(revenueShare)]);
  }
  const infoCards = infoCardsData.map(([label, value]) => `<div${label === "Contract" ? " class=\"contractDetailCard\"" : ""}><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("");
  state.playerAttributeView = normalizedAttributeView;
  const displayRow = state.playerAttributeView === "training" ? trainingRow(row) : row;
  const viewButtons = allowedPlayerAttributeViews(row)
    .map(([view, label]) => `<button class="playerAttributeViewButton ${state.playerAttributeView === view ? "active" : ""}" type="button" data-player-attribute-view="${view}">${label}</button>`)
    .join("");

  playerDetail.innerHTML = `
    <section class="playerHero">
      <div>
        <button id="copyPlayerIdButton" class="playerEyebrow playerIdText" type="button" data-tooltip="Click to copy" aria-label="Click to copy player ID">ID #${escapeHtml(id)}</button>
        <h2 class="playerTitle"><span class="playerTitleName">${escapeHtml(playerName)}</span><span class="playerTitleNoteIcon" data-player-note-title-icon>${playerNoteIconHtml(id)}</span></h2>
        <p>${escapeHtml(positions.join(", ") || "No positions")}</p>
      </div>
      <div class="playerHeroActions">
        <button id="playerEvaluateButton" class="playerEvaluateButton" type="button">Evaluate</button>
        ${hasWalletOptIn() ? '<button id="playerWatchlistButton" class="playerWatchlistButton" type="button"></button>' : ""}
        <a id="openPlayerExternalButton" class="playerExternalButton" href="${escapeHtml(formatCellValue(row, linkColumn))}" target="_blank" rel="noopener noreferrer">Open link</a>
      </div>
    </section>
    <section class="playerGrid">
      <div class="playerStack">
        <div class="playerPanel playerInfoPanel"><h3>Profile</h3><div class="detailGrid">${infoCards}</div></div>
        <div class="playerPanel attributesPanel"><div class="playerPanelHeader"><h3>Attributes</h3><div class="playerAttributeViews">${viewButtons}</div></div><div class="attributeGrid">${renderPlayerAttributePanel(displayRow)}</div></div>
        ${hasWalletOptIn() ? `<div class="playerPanel playerNotesPanel"><h3>Notes</h3><div class="playerNotesInputWrap"><textarea id="playerNotesInput" class="playerNotesInput" placeholder="Write private notes for this player..." maxlength="${PLAYER_NOTE_MAX_LENGTH}">${escapeHtml(playerNote(id))}</textarea><span id="playerNotesCount" class="playerNotesCount">${playerNote(id).length}/${PLAYER_NOTE_MAX_LENGTH}</span></div></div>` : ""}
      </div>
      <div class="playerPanel pitchPanel"><h3>Positions</h3><div class="pitch">${renderPitch(displayRow)}</div></div>
    </section>`;

  const watchButton = playerDetail.querySelector("#playerWatchlistButton");
  if (watchButton) {
    const inAnyWatchlist = playerIsInAnyWatchlist(id);
    watchButton.className = `playerWatchlistButton ${inAnyWatchlist ? "active" : ""}`;
    watchButton.innerHTML = `<span class="watchlistButtonStar" aria-hidden="true">${inAnyWatchlist ? "\u2605" : "\u2606"}</span><span>${inAnyWatchlist ? "In watchlist" : "Add to watchlist"}</span>`;
    watchButton.addEventListener("click", () => {
      toggleWatchlistPlayer(id, true);
    });
  }
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
