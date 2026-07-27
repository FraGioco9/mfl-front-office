(() => {
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];

  const divisionNames = {
    "1": "Diamond",
    "2": "Platinum",
    "3": "Gold",
    "4": "Silver",
    "5": "Bronze",
    "6": "Copper",
    "7": "Iron",
    "8": "Stone",
    "9": "Wood",
    "10": "Flint",
  };

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

  function normalizedDivision(value) {
    const raw = String(value || "").trim();
    return divisionNames[raw] || raw;
  }

  function divisionByClubId() {
    const idColumn = clubIdColumn();
    const divisions = new Map();
    if (!idColumn || !Array.isArray(state?.rows)) return divisions;

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const division = normalizedDivision(getValue(row, "active_contract_club_division"));
      if (clubId && division && !divisions.has(clubId)) divisions.set(clubId, division);
    });

    return divisions;
  }

  function searchResultClubId(button) {
    if (button.dataset.clubId) return button.dataset.clubId;
    const info = String(button.querySelector(":scope > span")?.textContent || "");
    const match = info.match(/#([^·\s]+)/);
    const clubId = match ? match[1].trim() : "";
    if (clubId) button.dataset.clubId = clubId;
    return clubId;
  }

  function decorateClubSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;

    const divisions = divisionByClubId();
    const clubButtons = Array.from(playerSearchResults.querySelectorAll(":scope > .clubSearchResult"));

    clubButtons.forEach((button) => {
      const clubId = searchResultClubId(button);
      const division = divisions.get(clubId);
      const info = button.querySelector(":scope > span");
      if (!clubId || !info) return;

      const fragment = document.createDocumentFragment();
      fragment.append(document.createTextNode(`Club · #${clubId}`));

      if (division) {
        fragment.append(document.createTextNode(" · "));
        const divisionLabel = document.createElement("span");
        divisionLabel.className = "clubSearchDivision";
        divisionLabel.textContent = division;
        divisionLabel.style.color = divisionColors[division.toLowerCase()] || "inherit";
        fragment.appendChild(divisionLabel);
      }

      info.replaceChildren(fragment);
    });

    if (clubButtons.length) {
      playerSearchResults.querySelectorAll(":scope > .searchHint").forEach((hint) => {
        if (/no players or agents found/i.test(hint.textContent || "")) hint.remove();
      });
      playerSearchResults.classList.add("filledSearchResults");
    }
  }

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowWithClubDivisions() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      decorateClubSearchResults();
      return result;
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    .clubSearchResult > span {
      display: block !important;
      width: auto !important;
      border: 0 !important;
      background: none !important;
    }
    .clubSearchResult > span::before,
    .clubSearchResult > span::after {
      content: none !important;
      display: none !important;
    }
    .clubSearchDivision {
      display: inline !important;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
})();