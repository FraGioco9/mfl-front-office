function playerFirstPaintKnownValues(row) {
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
}
