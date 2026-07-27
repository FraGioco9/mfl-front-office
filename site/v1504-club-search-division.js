(() => {
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];

  const divisionColors = {
    diamond: "#58d7ff",
    platinum: "#c7d7e8",
    gold: "#f2c94c",
    silver: "#b8c2cc",
    bronze: "#cd7f32",
    copper: "#c77b48",
    iron: "#99a2ad",
    stone: "#9a948c",
    wood: "#b98352",
    flint: "#7d8792",
  };

  function clubIdColumn() {
    if (!Array.isArray(state?.columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => state.columns.includes(column)) || "";
  }

  function divisionByClubId() {
    const idColumn = clubIdColumn();
    const divisions = new Map();
    if (!idColumn || !Array.isArray(state?.rows)) return divisions;

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const division = String(getValue(row, "active_contract_club_division") || "").trim();
      if (clubId && division && !divisions.has(clubId)) divisions.set(clubId, division);
    });

    return divisions;
  }

  function searchResultClubId(button) {
    const info = String(button.querySelector("span")?.textContent || "");
    const match = info.match(/#([^·]+?)(?:\s|$)/);
    return match ? match[1].trim() : "";
  }

  function decorateClubSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;
    const divisions = divisionByClubId();

    playerSearchResults.querySelectorAll(".clubSearchResult").forEach((button) => {
      const clubId = searchResultClubId(button);
      const division = divisions.get(clubId);
      const info = button.querySelector("span");
      if (!division || !info) return;

      info.querySelector(".clubSearchDivision")?.remove();
      info.append(document.createTextNode(" · "));

      const divisionLabel = document.createElement("span");
      divisionLabel.className = "clubSearchDivision";
      divisionLabel.textContent = division;
      divisionLabel.style.color = divisionColors[division.toLowerCase()] || "inherit";
      info.appendChild(divisionLabel);
    });
  }

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowWithClubDivisions() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      requestAnimationFrame(decorateClubSearchResults);
      return result;
    };
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorateClubSearchResults));
  if (typeof playerSearchResults !== "undefined" && playerSearchResults) {
    observer.observe(playerSearchResults, { childList: true, subtree: true });
  }

  const style = document.createElement("style");
  style.textContent = `
    .clubSearchDivision {
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
})();
