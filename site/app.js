const state = {
  columns: [],
  rows: [],
  filteredRows: [],
  page: 1,
  pageSize: 50,
  sortColumn: "overall",
  sortDirection: "desc",
  loaded: false,
};

const columnLabels = {
  player_id: "ID",
  wallet_address: "Wallet",
  wallet_name: "Wallet Name",
  name: "Name",
  positions: "Positions",
  age: "Age",
  nationality: "Nationality",
  preferred_foot: "Foot",
  height: "Height",
  retirement_years: "Retirement",
  player_seasons: "Player Seasons",
  overall_prog_all: "Overall All",
  pace_prog_all: "Pace All",
  shooting_prog_all: "Shooting All",
  passing_prog_all: "Passing All",
  dribbling_prog_all: "Dribbling All",
  defense_prog_all: "Defense All",
  physical_prog_all: "Physical All",
  goalkeeping_prog_all: "Goalkeeping All",
  overall_prog_current_season: "Overall Current",
  pace_prog_current_season: "Pace Current",
  shooting_prog_current_season: "Shooting Current",
  passing_prog_current_season: "Passing Current",
  dribbling_prog_current_season: "Dribbling Current",
  defense_prog_current_season: "Defense Current",
  physical_prog_current_season: "Physical Current",
  goalkeeping_prog_current_season: "Goalkeeping Current",
};

const numberColumns = new Set([
  "player_id",
  "age",
  "height",
  "retirement_years",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
  "player_seasons",
  "overall_prog_all",
  "pace_prog_all",
  "shooting_prog_all",
  "passing_prog_all",
  "dribbling_prog_all",
  "defense_prog_all",
  "physical_prog_all",
  "goalkeeping_prog_all",
  "overall_prog_current_season",
  "pace_prog_current_season",
  "shooting_prog_current_season",
  "passing_prog_current_season",
  "dribbling_prog_current_season",
  "defense_prog_current_season",
  "physical_prog_current_season",
  "goalkeeping_prog_current_season",
]);

const searchColumns = ["name", "wallet_name", "wallet_address", "nationality", "positions"];

const statusText = document.querySelector("#statusText");
const totalPlayers = document.querySelector("#totalPlayers");
const visiblePlayers = document.querySelector("#visiblePlayers");
const searchInput = document.querySelector("#searchInput");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const clearButton = document.querySelector("#clearButton");
const downloadButton = document.querySelector("#downloadButton");
const tableHead = document.querySelector("#tableHead");
const tableBody = document.querySelector("#tableBody");
const emptyState = document.querySelector("#emptyState");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const pageText = document.querySelector("#pageText");

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat().format(value);
  }

  return String(value);
}

function rowToObject(row) {
  const object = {};
  state.columns.forEach((column, index) => {
    object[column] = row[index];
  });
  return object;
}

function getValue(row, column) {
  return row[state.columns.indexOf(column)];
}

function buildHeader() {
  const headerRow = document.createElement("tr");

  state.columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.textContent = columnLabels[column] || column.replaceAll("_", " ");
    cell.addEventListener("click", () => {
      if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortColumn = column;
        state.sortDirection = numberColumns.has(column) ? "desc" : "asc";
      }

      state.page = 1;
      applyFilters();
    });
    headerRow.appendChild(cell);
  });

  tableHead.replaceChildren(headerRow);
}

function compareRows(a, b) {
  const column = state.sortColumn;
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const aValue = getValue(a, column);
  const bValue = getValue(b, column);

  if (numberColumns.has(column)) {
    return (((aValue ?? -Infinity) - (bValue ?? -Infinity)) || 0) * direction;
  }

  return String(aValue ?? "").localeCompare(String(bValue ?? "")) * direction;
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const searchIndexes = searchColumns.map((column) => state.columns.indexOf(column));

  if (!query) {
    state.filteredRows = [...state.rows];
  } else {
    state.filteredRows = state.rows.filter((row) => {
      return searchIndexes.some((index) => String(row[index] ?? "").toLowerCase().includes(query));
    });
  }

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

    row.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = formatNumber(value);
      tableRow.appendChild(cell);
    });

    fragment.appendChild(tableRow);
  });

  tableBody.replaceChildren(fragment);
  emptyState.hidden = pageRows.length > 0;
  totalPlayers.textContent = formatNumber(state.rows.length);
  visiblePlayers.textContent = formatNumber(state.filteredRows.length);
  pageText.textContent = `Page ${state.page} of ${totalPages}`;
  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  const csvRows = [
    state.columns.map(csvEscape).join(","),
    ...state.filteredRows.map((row) => row.map(csvEscape).join(",")),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "mfl_players.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadData() {
  try {
    const manifestResponse = await fetch("data/manifest.json", { cache: "no-store" });

    if (!manifestResponse.ok) {
      throw new Error("No exported data found yet.");
    }

    const manifest = await manifestResponse.json();
    state.columns = manifest.columns;
    totalPlayers.textContent = formatNumber(manifest.row_count);

    for (let index = 0; index < manifest.chunks.length; index += 1) {
      const chunkInfo = manifest.chunks[index];
      statusText.textContent = `Loading ${index + 1}/${manifest.chunks.length} data files...`;
      const response = await fetch(`data/${chunkInfo.file}`);
      const chunk = await response.json();
      state.rows.push(...chunk.rows);
    }

    state.loaded = true;
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

searchInput.addEventListener("input", () => {
  state.page = 1;
  applyFilters();
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  renderTable();
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
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

loadData();
