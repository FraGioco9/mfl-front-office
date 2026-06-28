const state = {
  columns: [],
  rows: [],
  filteredRows: [],
  page: 1,
  pageSize: 100,
  view: "current",
  sortKey: "overall",
  sortDirection: "desc",
};

const baseColumns = ["player_id", "name", "nationality", "age", "positions", "player_seasons"];
const statColumns = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical"];
const linkColumn = "player_link";

const views = {
  attributes: {
    columns: [...baseColumns, ...statColumns, linkColumn],
    progressionSuffix: null,
  },
  current: {
    columns: [...baseColumns, ...statColumns, linkColumn],
    progressionSuffix: "prog_current_season",
  },
  all: {
    columns: [...baseColumns, ...statColumns, linkColumn],
    progressionSuffix: "prog_all",
  },
};

const columnLabels = {
  player_id: "ID",
  name: "Name",
  nationality: "Nationality",
  age: "Age",
  positions: "Positions",
  player_seasons: "Seasons",
  overall: "Overall",
  pace: "Pace",
  shooting: "Shooting",
  passing: "Passing",
  dribbling: "Dribbling",
  defense: "Defense",
  physical: "Physical",
  player_link: "Link",
};

const numberColumns = new Set(["player_id", "age", "player_seasons", ...statColumns]);
const sortableColumns = new Set(["player_id", "name", "age", "player_seasons", ...statColumns]);

const statusText = document.querySelector("#statusText");
const totalPlayers = document.querySelector("#totalPlayers");
const visiblePlayers = document.querySelector("#visiblePlayers");
const themeButton = document.querySelector("#themeButton");
const nameFilterInput = document.querySelector("#nameFilterInput");
const nationalityFilterInput = document.querySelector("#nationalityFilterInput");
const positionFilterInput = document.querySelector("#positionFilterInput");
const hideRetiredInput = document.querySelector("#hideRetiredInput");
const newMintsInput = document.querySelector("#newMintsInput");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const clearButton = document.querySelector("#clearButton");
const downloadButton = document.querySelector("#downloadButton");
const tableHead = document.querySelector("#tableHead");
const tableBody = document.querySelector("#tableBody");
const emptyState = document.querySelector("#emptyState");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const pageText = document.querySelector("#pageText");
const viewButtons = document.querySelectorAll(".viewButton");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "☀️" : "🌙";
  themeButton.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to night mode");
  themeButton.title = theme === "dark" ? "Light mode" : "Night mode";

  try {
    localStorage.setItem("mfl-theme", theme);
  } catch {
    // Theme still changes for this page even if the browser blocks storage.
  }
}

function loadTheme() {
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem("mfl-theme");
  } catch {
    savedTheme = null;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function formatCount(value) {
  return new Intl.NumberFormat().format(value);
}

function getValue(row, column) {
  return row[state.columns.indexOf(column)];
}

function getProgressionColumn(statColumn) {
  const suffix = views[state.view].progressionSuffix;
  return suffix ? `${statColumn}_${suffix}` : null;
}

function formatPlainValue(value, column) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (column === "player_id") {
    return String(value);
  }

  if (typeof value === "number") {
    return formatCount(value);
  }

  return String(value);
}

function formatStatValue(row, statColumn) {
  const value = getValue(row, statColumn);
  const progressionColumn = getProgressionColumn(statColumn);

  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (!progressionColumn) {
    return String(value);
  }

  const progression = Number(getValue(row, progressionColumn) || 0);

  if (progression === 0) {
    return String(value);
  }

  const sign = progression > 0 ? "+" : "";
  return `${value} (${sign}${progression})`;
}

function formatCellValue(row, column) {
  if (column === linkColumn) {
    return `https://app.playmfl.com/players/${getValue(row, "player_id")}`;
  }

  if (statColumns.includes(column)) {
    return formatStatValue(row, column);
  }

  return formatPlainValue(getValue(row, column), column);
}

function retirementMarker(row) {
  const retirementYears = getValue(row, "retirement_years");

  if (retirementYears === 0) {
    return {
      emoji: "🏁",
      label: "Retired",
    };
  }

  if ([1, 2, 3].includes(retirementYears)) {
    return {
      emoji: "⏳",
      label: `${retirementYears} retirement year${retirementYears === 1 ? "" : "s"} left`,
    };
  }

  return null;
}

function sortableValue(row, column) {
  if (column === "overall" && state.view !== "attributes") {
    return [
      getValue(row, getProgressionColumn("overall")) || 0,
      getValue(row, "overall") || 0,
    ];
  }

  return getValue(row, column);
}

function buildHeader() {
  const headerRow = document.createElement("tr");

  views[state.view].columns.forEach((column) => {
    const cell = document.createElement("th");
    const isSorted = state.sortKey === column;
    const label = document.createElement("span");
    label.textContent = columnLabels[column];
    cell.appendChild(label);

    if (sortableColumns.has(column)) {
      cell.classList.add("sortable");

      if (isSorted) {
        const arrow = document.createElement("span");
        arrow.className = `sortArrow ${state.sortDirection}`;
        arrow.setAttribute("aria-hidden", "true");
        cell.appendChild(arrow);
      }

      cell.addEventListener("click", () => {
        if (state.sortKey !== column) {
          state.sortKey = column;
          state.sortDirection = numberColumns.has(column) ? "desc" : "asc";
        } else if (state.sortDirection === "desc") {
          state.sortDirection = "asc";
        } else if (column === "overall") {
          state.sortDirection = "desc";
        } else {
          state.sortKey = "overall";
          state.sortDirection = "desc";
        }

        state.page = 1;
        buildHeader();
        applyFilters();
      });
    }

    headerRow.appendChild(cell);
  });

  tableHead.replaceChildren(headerRow);
}

function compareRows(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const aValue = sortableValue(a, state.sortKey);
  const bValue = sortableValue(b, state.sortKey);

  if (Array.isArray(aValue) && Array.isArray(bValue)) {
    for (let index = 0; index < aValue.length; index += 1) {
      const comparison = ((aValue[index] ?? -Infinity) - (bValue[index] ?? -Infinity)) * direction;

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  }

  if (numberColumns.has(state.sortKey)) {
    return (((aValue ?? -Infinity) - (bValue ?? -Infinity)) || 0) * direction;
  }

  return String(aValue ?? "").localeCompare(String(bValue ?? "")) * direction;
}

function applyFilters() {
  const nameQuery = nameFilterInput.value.trim().toLowerCase();
  const nationalityQuery = nationalityFilterInput.value.trim().toLowerCase();
  const positionQuery = positionFilterInput.value.trim().toLowerCase();
  const nameIndex = state.columns.indexOf("name");
  const nationalityIndex = state.columns.indexOf("nationality");
  const positionsIndex = state.columns.indexOf("positions");
  const retirementIndex = state.columns.indexOf("retirement_years");
  const seasonsIndex = state.columns.indexOf("player_seasons");

  state.filteredRows = state.rows.filter((row) => {
    if (hideRetiredInput.checked && row[retirementIndex] === 0) {
      return false;
    }

    if (newMintsInput.checked && row[seasonsIndex] !== 1) {
      return false;
    }

    if (nameQuery && !String(row[nameIndex] ?? "").toLowerCase().includes(nameQuery)) {
      return false;
    }

    if (nationalityQuery && !String(row[nationalityIndex] ?? "").toLowerCase().includes(nationalityQuery)) {
      return false;
    }

    if (positionQuery && !String(row[positionsIndex] ?? "").toLowerCase().includes(positionQuery)) {
      return false;
    }

    return true;
  });

  state.filteredRows.sort(compareRows);
  renderTable();
}

function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.filteredRows.slice(start, start + state.pageSize);
  const fragment = document.createDocumentFragment();

  pageRows.forEach((row) => {
    const tableRow = document.createElement("tr");

    views[state.view].columns.forEach((column) => {
      const cell = document.createElement("td");

      if (column === "name") {
        const nameText = document.createElement("span");
        nameText.textContent = formatCellValue(row, column);
        cell.appendChild(nameText);

        const marker = retirementMarker(row);
        if (marker) {
          const markerElement = document.createElement("span");
          markerElement.className = "retirementMarker";
          markerElement.textContent = marker.emoji;
          markerElement.title = marker.label;
          markerElement.setAttribute("aria-label", marker.label);
          cell.appendChild(markerElement);
        }
      } else if (column === linkColumn) {
        const link = document.createElement("a");
        link.href = formatCellValue(row, column);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Link";
        cell.appendChild(link);
      } else {
        cell.textContent = formatCellValue(row, column);
      }

      tableRow.appendChild(cell);
    });

    fragment.appendChild(tableRow);
  });

  tableBody.replaceChildren(fragment);
  emptyState.hidden = pageRows.length > 0;
  totalPlayers.textContent = formatCount(state.rows.length);
  visiblePlayers.textContent = formatCount(state.filteredRows.length);
  pageText.textContent = `Page ${state.page} of ${totalPages}`;
  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  const visibleColumns = views[state.view].columns;
  const csvRows = [
    visibleColumns.map((column) => csvEscape(columnLabels[column] || column)).join(","),
    ...state.filteredRows.map((row) => visibleColumns.map((column) => csvEscape(formatCellValue(row, column))).join(",")),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `mfl_players_${state.view}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function setView(viewName) {
  state.view = viewName;
  state.page = 1;

  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  buildHeader();
  applyFilters();
}

async function loadData() {
  try {
    const manifestResponse = await fetch("data/manifest.json", { cache: "no-store" });

    if (!manifestResponse.ok) {
      throw new Error("No exported data found yet.");
    }

    const manifest = await manifestResponse.json();
    state.columns = manifest.columns;
    totalPlayers.textContent = formatCount(manifest.row_count);

    for (let index = 0; index < manifest.chunks.length; index += 1) {
      const chunkInfo = manifest.chunks[index];
      statusText.textContent = `Loading ${index + 1}/${manifest.chunks.length} data files...`;
      const response = await fetch(`data/${chunkInfo.file}`);
      const chunk = await response.json();
      state.rows.push(...chunk.rows);
    }

    statusText.textContent = `Updated ${new Date(manifest.generated_at).toLocaleString()}`;
    buildHeader();
    applyFilters();
  } catch (error) {
    statusText.textContent = "No website data found yet. Run the GitHub workflow to publish the table.";
    tableBody.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = error.message;
  }
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

for (const input of [nameFilterInput, nationalityFilterInput, positionFilterInput]) {
  input.addEventListener("input", () => {
    state.page = 1;
    applyFilters();
  });
}

hideRetiredInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

newMintsInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  renderTable();
});

clearButton.addEventListener("click", () => {
  nameFilterInput.value = "";
  nationalityFilterInput.value = "";
  positionFilterInput.value = "";
  state.page = 1;
  applyFilters();
});

downloadButton.addEventListener("click", downloadCsv);

prevButton.addEventListener("click", () => {
  state.page -= 1;
  renderTable();
});

nextButton.addEventListener("click", () => {
  state.page += 1;
  renderTable();
});

themeButton.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

loadTheme();
loadData();
