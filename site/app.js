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
  wallet_name: "Wallet Name",
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

const numberColumns = new Set(["player_id", "age", "height", "retirement_years", "player_seasons", "goalkeeping", ...statColumns]);
const sortableColumns = new Set(["player_id", "name", "age", "player_seasons", ...statColumns]);
const baseFilterColumns = ["player_id", "wallet_name", "name", "positions", "age", "player_seasons", "nationality", ...statColumns];
const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
const POSITION_ORDER = ["GK", "RB", "LB", "CB", "RWB", "LWB", "CDM", "RM", "LM", "CM", "CAM", "RW", "LW", "CF", "ST"];

const loadingScreen = document.querySelector("#loadingScreen");
const loadingText = document.querySelector("#loadingText");
const loadingBarFill = document.querySelector("#loadingBarFill");
const statusText = document.querySelector("#statusText");
const totalPlayers = document.querySelector("#totalPlayers");
const visiblePlayers = document.querySelector("#visiblePlayers");
const themeButton = document.querySelector("#themeButton");
const openFiltersButton = document.querySelector("#openFiltersButton");
const quickClearFiltersButton = document.querySelector("#quickClearFiltersButton");
const filterSummary = document.querySelector("#filterSummary");
const filtersModal = document.querySelector("#filtersModal");
const closeFiltersButton = document.querySelector("#closeFiltersButton");
const applyFiltersButton = document.querySelector("#applyFiltersButton");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const showAddFilterButton = document.querySelector("#showAddFilterButton");
const addFilterSelect = document.querySelector("#addFilterSelect");
const filterRules = document.querySelector("#filterRules");
const hideRetiredInput = document.querySelector("#hideRetiredInput");
const hideRetiringInput = document.querySelector("#hideRetiringInput");
const newMintsInput = document.querySelector("#newMintsInput");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
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

function updateLoadingProgress(loadedFiles, totalFiles) {
  const percent = totalFiles > 0 ? Math.round((loadedFiles / totalFiles) * 100) : 0;
  loadingBarFill.style.width = `${percent}%`;
  loadingText.textContent = totalFiles > 0
    ? `Loading data files ${loadedFiles}/${totalFiles}`
    : "Preparing data...";
}

function paintLoadingProgress() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

function showLoadingError(message) {
  loadingBarFill.style.width = "100%";
  loadingScreen.classList.add("failed");
  loadingText.textContent = message;
}

function finishLoading() {
  document.body.classList.remove("loading");
  loadingScreen.hidden = true;
}

function saveTableState() {
  const rules = Array.from(filterRules.querySelectorAll(".filterRule")).map((rule, index) => {
    const values = readRuleValues(rule);

    return {
      column: rule.dataset.filterColumn,
      connector: index === 0 ? "and" : rule.querySelector("[data-filter-connector]").value,
      operator: rule.querySelector("[data-filter-operator]").value,
      value: values.value,
      valueTo: values.valueTo,
    };
  });

  const savedState = {
    hideRetired: hideRetiredInput.checked,
    hideRetiring: hideRetiringInput.checked,
    newMints: newMintsInput.checked,
    pageSize: state.pageSize,
    view: state.view,
    sortKey: state.sortKey,
    sortDirection: state.sortDirection,
    rules,
  };

  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(savedState));
  } catch {
    // Filtering still works for this page even if the browser blocks storage.
  }
}

function loadSavedTableState() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function formatCount(value) {
  return new Intl.NumberFormat().format(value);
}

function filterLabel(column) {
  if (column.endsWith("_prog_current_season")) {
    return `${filterLabel(column.replace("_prog_current_season", ""))} Progression`;
  }

  if (column.endsWith("_prog_all")) {
    return `${filterLabel(column.replace("_prog_all", ""))} Progression`;
  }

  return columnLabels[column] || column.replaceAll("_", " ");
}

function isNumericColumn(column) {
  return numberColumns.has(column) || column.endsWith("_all") || column.endsWith("_current_season");
}

function uniqueColumnValues(column) {
  const values = new Set();
  const columnIndex = state.columns.indexOf(column);

  if (columnIndex < 0) {
    return [];
  }

  state.rows.forEach((row) => {
    const value = row[columnIndex];

    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value));
    }
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function uniquePositions() {
  return POSITION_ORDER;
}

function availableFilterColumns() {
  const columns = [...baseFilterColumns];

  if (state.view === "current") {
    columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
  } else if (state.view === "all") {
    columns.push(...statColumns.map((column) => `${column}_prog_all`));
  }

  return columns.filter((column) => state.columns.includes(column));
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

function appendStatValue(cell, row, statColumn) {
  const value = getValue(row, statColumn);
  const progressionColumn = getProgressionColumn(statColumn);

  if (value === null || value === undefined || value === "") {
    cell.textContent = "NULL";
    return;
  }

  cell.append(String(value));

  if (!progressionColumn) {
    return;
  }

  const progression = Number(getValue(row, progressionColumn) || 0);

  if (progression === 0) {
    return;
  }

  const progressionElement = document.createElement("span");
  progressionElement.className = progression > 0 ? "progressionValue positive" : "progressionValue negative";
  progressionElement.textContent = ` (${progression > 0 ? "+" : ""}${progression})`;
  cell.appendChild(progressionElement);
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
      label: `${retirementYears} year${retirementYears === 1 ? "" : "s"} left`,
    };
  }

  return null;
}

function newMintMarker(row) {
  if (getValue(row, "player_seasons") !== 1) {
    return null;
  }

  return {
    emoji: "\u{1F195}",
    label: "New mint",
  };
}

function appendNameMarker(cell, marker, className) {
  if (!marker) {
    return;
  }

  const markerElement = document.createElement("span");
  markerElement.className = className;
  markerElement.textContent = marker.emoji;
  markerElement.title = marker.label;
  markerElement.setAttribute("aria-label", marker.label);
  cell.appendChild(markerElement);
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

function activeFilterCount() {
  let count = 0;

  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    const operator = rule.querySelector("[data-filter-operator]").value;
    const values = readRuleValues(rule);

    if ((operator === "between" && values.value && values.valueTo) || (operator !== "between" && values.value)) {
      count += 1;
    }
  }

  return count;
}

function updateFilterSummary() {
  const count = activeFilterCount();
  filterSummary.textContent = `${count} active`;
}

function populateAddFilterSelect() {
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select filter...";
  fragment.appendChild(placeholder);

  availableFilterColumns().forEach((column) => {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = filterLabel(column);
    fragment.appendChild(option);
  });

  addFilterSelect.replaceChildren(fragment);
}

function buildOperatorSelect(column) {
  const select = document.createElement("select");
  select.dataset.filterOperator = "true";
  let operators;

  if (column === "positions") {
    operators = [
      ["primary_is", "primary is"],
      ["can_play", "can play"],
    ];
  } else if (column === "nationality") {
    operators = [["=", "is"]];
    select.hidden = true;
  } else if (column === "name" || column === "wallet_name") {
    operators = [["contains", "contains"]];
    select.hidden = true;
  } else if (isNumericColumn(column)) {
    operators = [
      [">=", "at least"],
      ["<=", "at most"],
      ["between", "is between"],
    ];
  } else {
    operators = [["contains", "contains"]];
    select.hidden = true;
  }

  operators.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  return select;
}

function buildNumberInput(value = "", placeholder = "Value") {
  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = placeholder;
  input.dataset.filterValue = "true";
  input.value = value;
  return input;
}

function buildValueControl(column, savedValue = "", savedValueTo = "", operator = "") {
  if (isNumericColumn(column) && operator === "between") {
    const group = document.createElement("div");
    group.className = "betweenValue";
    group.dataset.filterValueGroup = "true";
    group.appendChild(buildNumberInput(savedValue, "From"));
    group.appendChild(buildNumberInput(savedValueTo, "To"));
    return group;
  }

  if (column === "nationality" || column === "positions") {
    const select = document.createElement("select");
    select.dataset.filterValue = "true";
    const values = column === "nationality" ? uniqueColumnValues("nationality") : uniquePositions();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select...";
    select.appendChild(placeholder);

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === savedValue;
      select.appendChild(option);
    });

    return select;
  }

  const input = document.createElement("input");
  input.type = isNumericColumn(column) ? "number" : "search";
  input.placeholder = "Value";
  input.dataset.filterValue = "true";
  input.value = savedValue;
  return input;
}

function buildColumnSelect(selectedColumn) {
  const select = document.createElement("select");
  select.dataset.filterColumnSelect = "true";

  availableFilterColumns().forEach((column) => {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = filterLabel(column);
    option.selected = column === selectedColumn;
    select.appendChild(option);
  });

  return select;
}

function replaceOperatorSelect(rule, column) {
  const oldOperator = rule.querySelector("[data-filter-operator]");
  const newOperator = buildOperatorSelect(column);
  newOperator.addEventListener("change", () => {
    const values = readRuleValues(rule);
    replaceValueControl(rule, column, values.value, values.valueTo);
  });
  oldOperator.replaceWith(newOperator);
}

function valueControlElement(rule) {
  return rule.querySelector("[data-filter-value-group]") || rule.querySelector("[data-filter-value]");
}

function replaceValueControl(rule, column, savedValue = "", savedValueTo = "") {
  const oldValue = valueControlElement(rule);
  const operator = rule.querySelector("[data-filter-operator]").value;
  const newValue = buildValueControl(column, savedValue, savedValueTo, operator);
  oldValue.replaceWith(newValue);
}

function addFilterRule(column, options = {}) {
  const rule = document.createElement("div");
  rule.className = "filterRule";
  rule.dataset.filterColumn = column;

  const connector = document.createElement("select");
  connector.dataset.filterConnector = "true";
  connector.innerHTML = '<option value="and">And</option><option value="or">Or</option>';
  connector.className = "connectorSelect";
  connector.value = options.connector || "and";

  const columnSelect = buildColumnSelect(column);
  columnSelect.addEventListener("change", () => {
    rule.dataset.filterColumn = columnSelect.value;
    replaceOperatorSelect(rule, columnSelect.value);
    replaceValueControl(rule, columnSelect.value);
  });

  const operator = buildOperatorSelect(column);
  if (options.operator) {
    operator.value = options.operator;
  }
  operator.addEventListener("change", () => {
    const values = readRuleValues(rule);
    replaceValueControl(rule, column, values.value, values.valueTo);
  });

  const value = buildValueControl(column, options.value || "", options.valueTo || "", operator.value);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "iconButton";
  remove.textContent = "x";
  remove.setAttribute("aria-label", `Remove ${filterLabel(column)} filter`);
  remove.addEventListener("click", () => {
    rule.remove();
    refreshRuleConnectors();
    updateFilterSummary();
  });

  rule.appendChild(connector);
  rule.appendChild(columnSelect);
  rule.appendChild(operator);
  rule.appendChild(value);
  rule.appendChild(remove);
  filterRules.appendChild(rule);
  refreshRuleConnectors();

  if (options.focus !== false) {
    (value.querySelector("[data-filter-value]") || value).focus();
  }
}

function refreshRuleConnectors() {
  const rules = Array.from(filterRules.querySelectorAll(".filterRule"));

  rules.forEach((rule, index) => {
    const connector = rule.querySelector("[data-filter-connector]");
    connector.disabled = index === 0;
    connector.style.visibility = index === 0 ? "hidden" : "visible";
  });
}

function removeUnavailableFilterRules() {
  const allowedColumns = new Set(availableFilterColumns());

  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    if (!allowedColumns.has(rule.dataset.filterColumn)) {
      rule.remove();
    }
  }

  refreshRuleConnectors();
}

function refreshRuleColumnSelects() {
  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    const oldSelect = rule.querySelector("[data-filter-column-select]");
    const newSelect = buildColumnSelect(rule.dataset.filterColumn);

    newSelect.addEventListener("change", () => {
      rule.dataset.filterColumn = newSelect.value;
      replaceOperatorSelect(rule, newSelect.value);
      replaceValueControl(rule, newSelect.value);
    });

    oldSelect.replaceWith(newSelect);
  }
}

function restoreSavedTableState() {
  const savedState = loadSavedTableState();

  if (!savedState) {
    return;
  }

  if (savedState.view && views[savedState.view]) {
    state.view = savedState.view;
    viewButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === state.view);
    });
  }

  if (Number(savedState.pageSize)) {
    state.pageSize = Number(savedState.pageSize);
    pageSizeSelect.value = String(state.pageSize);
  }

  if (savedState.sortKey && sortableColumns.has(savedState.sortKey)) {
    state.sortKey = savedState.sortKey;
  }

  if (savedState.sortDirection === "asc" || savedState.sortDirection === "desc") {
    state.sortDirection = savedState.sortDirection;
  }

  hideRetiredInput.checked = savedState.hideRetired !== false;
  hideRetiringInput.checked = Boolean(savedState.hideRetiring);
  newMintsInput.checked = Boolean(savedState.newMints);

  const allowedColumns = new Set(availableFilterColumns());
  filterRules.replaceChildren();

  for (const rule of savedState.rules || []) {
    if (allowedColumns.has(rule.column)) {
      addFilterRule(rule.column, {
        connector: rule.connector,
        operator: rule.operator,
        value: rule.value,
        focus: false,
      });
    }
  }
}

function openFilters() {
  filtersModal.hidden = false;
  const firstInput = filterRules.querySelector("input") || addFilterSelect;

  if (firstInput) {
    firstInput.focus();
  }
}

function closeFilters() {
  filtersModal.hidden = true;
  openFiltersButton.focus();
}

function clearAdvancedFilters() {
  filterRules.replaceChildren();
  state.page = 1;
  applyFilters();
}

function readRuleValues(rule) {
  const inputs = Array.from(rule.querySelectorAll("[data-filter-value]"));

  return {
    value: (inputs[0]?.value || "").trim(),
    valueTo: (inputs[1]?.value || "").trim(),
  };
}

function readFilterRules() {
  return Array.from(filterRules.querySelectorAll(".filterRule"))
    .map((rule, index) => {
      const values = readRuleValues(rule);

      return {
        column: rule.dataset.filterColumn,
        connector: index === 0 ? "and" : rule.querySelector("[data-filter-connector]").value,
        operator: rule.querySelector("[data-filter-operator]").value,
        value: values.value,
        valueTo: values.valueTo,
      };
    })
    .filter((rule) => rule.operator === "between" ? rule.value && rule.valueTo : rule.value);
}

function ruleMatches(row, rule) {
  const rawValue = getValue(row, rule.column);
  const filterValue = rule.value;

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return false;
  }

  if (rule.column === "positions") {
    const positions = String(rawValue || "")
      .split(",")
      .map((position) => position.trim())
      .filter(Boolean);

    if (rule.operator === "primary_is") {
      return positions[0] === filterValue;
    }

    if (rule.operator === "can_play") {
      return positions.includes(filterValue);
    }
  }

  if (rule.column === "nationality") {
    return String(rawValue ?? "") === filterValue;
  }

  if (rule.column === "name" || rule.column === "wallet_name") {
    return String(rawValue ?? "").toLowerCase().includes(filterValue.toLowerCase());
  }

  if (isNumericColumn(rule.column)) {
    const rowNumber = Number(rawValue);
    const filterNumber = Number(filterValue);

    if (!Number.isFinite(rowNumber)) {
      return false;
    }

    if (rule.operator === "between") {
      const filterNumberTo = Number(rule.valueTo);

      if (!Number.isFinite(filterNumber) || !Number.isFinite(filterNumberTo)) {
        return false;
      }

      const min = Math.min(filterNumber, filterNumberTo);
      const max = Math.max(filterNumber, filterNumberTo);
      return rowNumber >= min && rowNumber <= max;
    }

    if (!Number.isFinite(filterNumber)) {
      return false;
    }

    if (rule.operator === "=") {
      return rowNumber === filterNumber;
    }
    if (rule.operator === "!=") {
      return rowNumber !== filterNumber;
    }
    if (rule.operator === "<") {
      return rowNumber < filterNumber;
    }
    if (rule.operator === "<=") {
      return rowNumber <= filterNumber;
    }
    if (rule.operator === ">") {
      return rowNumber > filterNumber;
    }
    if (rule.operator === ">=") {
      return rowNumber >= filterNumber;
    }
  }

  const rowText = String(rawValue ?? "").toLowerCase();
  const filterText = filterValue.toLowerCase();

  if (rule.operator === "contains") {
    return rowText.includes(filterText);
  }
  if (rule.operator === "not_contains") {
    return !rowText.includes(filterText);
  }
  if (rule.operator === "=") {
    return rowText === filterText;
  }
  if (rule.operator === "!=") {
    return rowText !== filterText;
  }

  return false;
}

function rowMatchesRules(row, rules) {
  if (!rules.length) {
    return true;
  }

  let result = ruleMatches(row, rules[0]);

  for (let index = 1; index < rules.length; index += 1) {
    const current = ruleMatches(row, rules[index]);

    if (rules[index].connector === "or") {
      result = result || current;
    } else {
      result = result && current;
    }
  }

  return result;
}

function applyFilters() {
  const rules = readFilterRules();
  const retirementIndex = state.columns.indexOf("retirement_years");
  const seasonsIndex = state.columns.indexOf("player_seasons");

  state.filteredRows = state.rows.filter((row) => {
    if (hideRetiredInput.checked && row[retirementIndex] === 0) {
      return false;
    }

    if (hideRetiringInput.checked && [1, 2, 3].includes(row[retirementIndex])) {
      return false;
    }

    if (newMintsInput.checked && row[seasonsIndex] !== 1) {
      return false;
    }

    if (!rowMatchesRules(row, rules)) {
      return false;
    }

    return true;
  });

  state.filteredRows.sort(compareRows);
  updateFilterSummary();
  saveTableState();
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

        appendNameMarker(cell, retirementMarker(row), "retirementMarker");
        appendNameMarker(cell, newMintMarker(row), "newMintMarker");
      } else if (column === linkColumn) {
        const link = document.createElement("a");
        link.href = formatCellValue(row, column);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Link";
        cell.appendChild(link);
      } else if (statColumns.includes(column)) {
        appendStatValue(cell, row, column);
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
  removeUnavailableFilterRules();
  populateAddFilterSelect();
  refreshRuleColumnSelects();

  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  buildHeader();
  applyFilters();
}

async function loadData() {
  try {
    updateLoadingProgress(0, 0);
    const manifestResponse = await fetch("data/manifest.json", { cache: "no-store" });

    if (!manifestResponse.ok) {
      throw new Error("No exported data found yet.");
    }

    const manifest = await manifestResponse.json();
    state.columns = manifest.columns;
    totalPlayers.textContent = formatCount(manifest.row_count);
    updateLoadingProgress(0, manifest.chunks.length);
    await paintLoadingProgress();

    for (let index = 0; index < manifest.chunks.length; index += 1) {
      const chunkInfo = manifest.chunks[index];
      const response = await fetch(`data/${chunkInfo.file}`);
      const chunk = await response.json();
      state.rows.push(...chunk.rows);
      updateLoadingProgress(index + 1, manifest.chunks.length);
      await paintLoadingProgress();
    }

    statusText.textContent = `Updated ${new Date(manifest.generated_at).toLocaleString()}`;
    populateAddFilterSelect();
    restoreSavedTableState();
    buildHeader();
    applyFilters();
    finishLoading();
  } catch (error) {
    statusText.textContent = "No website data found yet. Run the GitHub workflow to publish the table.";
    tableBody.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = error.message;
    showLoadingError("No website data found yet. Run the GitHub workflow to publish the table.");
  }
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  renderTable();
});

hideRetiredInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

hideRetiringInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

newMintsInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

openFiltersButton.addEventListener("click", openFilters);
quickClearFiltersButton.addEventListener("click", clearAdvancedFilters);
closeFiltersButton.addEventListener("click", closeFilters);

showAddFilterButton.addEventListener("click", () => {
  addFilterSelect.hidden = !addFilterSelect.hidden;

  if (!addFilterSelect.hidden) {
    addFilterSelect.focus();
  }
});

addFilterSelect.addEventListener("change", () => {
  if (!addFilterSelect.value) {
    return;
  }

  addFilterRule(addFilterSelect.value);
  addFilterSelect.value = "";
  addFilterSelect.hidden = true;
  updateFilterSummary();
});

filtersModal.addEventListener("click", (event) => {
  if (event.target === filtersModal) {
    closeFilters();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !filtersModal.hidden) {
    closeFilters();
  }
});

applyFiltersButton.addEventListener("click", () => {
  state.page = 1;
  applyFilters();
  closeFilters();
});

clearFiltersButton.addEventListener("click", () => {
  clearAdvancedFilters();
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
