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

  function clubMetadata() {
    const idColumn = clubIdColumn();
    const clubs = new Map();
    if (!idColumn || !Array.isArray(state?.rows)) return clubs;

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const name = String(getValue(row, "active_contract_club_name") || "").trim();
      const division = normalizedDivision(getValue(row, "active_contract_club_division"));
      if (clubId && name && !clubs.has(clubId)) clubs.set(clubId, { name, division });
    });

    return clubs;
  }

  function clubIdFromButton(button) {
    const directId = String(button.dataset.clubId || "").trim();
    if (directId) return directId;
    const text = String(button.textContent || "");
    const match = text.match(/#([^·\s]+)/);
    return match ? match[1].trim() : "";
  }

  function rebuildClubSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;
    const clubs = clubMetadata();
    const clubButtons = Array.from(playerSearchResults.querySelectorAll(".clubSearchResult"));

    clubButtons.forEach((button) => {
      const clubId = clubIdFromButton(button);
      const metadata = clubs.get(clubId);
      if (!clubId || !metadata) {
        button.remove();
        return;
      }

      button.dataset.clubId = clubId;
      const title = document.createElement("strong");
      title.textContent = metadata.name;

      const info = document.createElement("span");
      info.append(document.createTextNode(`Club · #${clubId}`));

      if (metadata.division) {
        info.append(document.createTextNode(" · "));
        const division = document.createElement("b");
        division.className = "clubSearchDivision";
        division.textContent = metadata.division;
        division.style.color = divisionColors[metadata.division.toLowerCase()] || "inherit";
        info.appendChild(division);
      }

      button.replaceChildren(title, info);
    });

    const remainingClubButtons = playerSearchResults.querySelectorAll(".clubSearchResult");
    if (remainingClubButtons.length) {
      playerSearchResults.querySelectorAll(".searchHint").forEach((hint) => {
        if (/no players or agents found/i.test(hint.textContent || "")) hint.remove();
      });
      playerSearchResults.classList.add("filledSearchResults");
    }
  }

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowWithCleanClubs() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      rebuildClubSearchResults();
      return result;
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    .clubSearchResult {
      min-height: 66px !important;
      padding: 12px !important;
    }
    .clubSearchResult > strong,
    .clubSearchResult > span {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: auto !important;
      height: auto !important;
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