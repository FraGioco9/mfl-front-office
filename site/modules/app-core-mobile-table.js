// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

export function addMobileTablePresentation(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  let table = String(routeChunks.table || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot add mobile table presentation before the application core exists.");
  }
  if (!table.trim()) {
    throw new Error("Cannot add mobile table presentation before the Table route chunk exists.");
  }

  core = replaceRequired(
    core,
    "async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {",
    `function syncMobileTablePageTransitionChrome(pageName) {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  const normalizePage = (value) => {
    const page = String(value || "").trim().toLowerCase();
    if (page === "mflstats") return "mfl";
    if (page === "my-players") return "myplayers";
    return page;
  };
  const targetPage = normalizePage(pageName);
  const currentPage = normalizePage(document.body.dataset.page || state.currentPage);

  if (targetPage && currentPage && targetPage !== currentPage) {
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    if (scroller instanceof HTMLElement) scroller.scrollLeft = 0;
  }

  const views = document.querySelector("#progressionPage .views");
  const switcher = document.getElementById("watchlistSwitcher");
  if (!(views instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return;

  const showWatchlistSelector = targetPage === "watchlist"
    && document.documentElement.dataset.storedWalletOptIn === "true";
  switcher.hidden = !showWatchlistSelector;

  if (showWatchlistSelector) {
    const shell = views.parentElement instanceof HTMLElement
      && views.parentElement.classList.contains("viewsScrollerShell")
      ? views.parentElement
      : null;
    (shell || views).insertAdjacentElement("afterend", switcher);
    switcher.classList.add("mflMobileWatchlistSwitcher");
    return;
  }

  switcher.classList.remove("mflMobileWatchlistSwitcher");
  if (switcher.parentElement !== views) views.appendChild(switcher);
  const dropdown = document.getElementById("watchlistDropdown");
  if (dropdown instanceof HTMLElement) dropdown.hidden = true;
  const button = document.getElementById("watchlistButton");
  if (button instanceof HTMLButtonElement) button.setAttribute("aria-expanded", "false");
}

async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {`,
    "mobile page-transition chrome ownership",
  );

  core = replaceRequired(
    core,
    `async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  if (!settingsConfirmNavigation(pageName, updateHash)) return null;`,
    `async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  if (!settingsConfirmNavigation(pageName, updateHash)) return null;
  syncMobileTablePageTransitionChrome(pageName);`,
    "mobile page-transition chrome timing",
  );

  table = replaceRequired(
    table,
    `  selectVisibleInput.id = "selectVisiblePlayersInput";
  selectVisibleInput.type = "checkbox";
  selectVisibleInput.setAttribute("aria-label", "Select visible players");`,
    `  selectVisibleInput.id = "selectVisiblePlayersInput";
  selectVisibleInput.type = "checkbox";
  selectVisibleInput.disabled = true;
  selectVisibleInput.setAttribute("aria-label", "Select visible players");`,
    "header selection disabled until visible data exists",
  );

  table = replaceRequired(
    table,
    "  currentViewColumns().forEach((column) => {",
    `  const mobileTable = window.matchMedia("(max-width: 900px)").matches;
  const compactTableHeadings = window.matchMedia("(max-width: 520px)").matches;

  currentViewColumns().forEach((column) => {`,
    "mobile table breakpoint ownership",
  );

  table = replaceRequired(
    table,
    '    label.textContent = column === agentColumn && state.currentPage === "mfl" ? "" : columnLabels[column];',
    `    cell.dataset.tableColumn = column;
    const fullLabel = columnLabels[column] || "";
    const compactLabel = ({
      overall: "OVR",
      pace: "PAC",
      shooting: "SHO",
      passing: "PAS",
      dribbling: "DRI",
      defense: "DEF",
      physical: "PHY",
      goalkeeping: "GK",
      player_seasons: "SZN",
    }[column] || fullLabel);
    label.dataset.mflFullTableLabel = fullLabel;
    label.dataset.mflCompactTableLabel = compactLabel;
    label.textContent = !mobileTable
      ? (column === agentColumn && state.currentPage === "mfl" ? "" : fullLabel)
      : column === "listing_price" || (column === agentColumn && state.currentPage === "mfl")
        ? ""
        : column === "positions"
          ? "POSITIONS"
          : compactTableHeadings
            ? compactLabel
            : fullLabel;`,
    "width-aware mobile table headings",
  );

  table = replaceRequired(
    table,
    "function tableRenderTableOwner() {",
    `function compactMobilePlayerName(value) {
  const fullName = String(value || "").trim();
  const parts = fullName.split(/\\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  const initial = Array.from(parts[0])[0] || "";
  return initial ? \`${"${initial}"}. ${"${parts.at(-1)}"}\` : fullName;
}

function compactMobileJoinedAgency(value) {
  return String(value || "").trim().split(/\\s+/, 1)[0] || "";
}

function tableRenderTableOwner() {`,
    "mobile compact table value helpers",
  );

  table = replaceRequired(
    table,
    "        nameLink.textContent = formatCellValue(row, column);",
    `        const fullPlayerName = formatCellValue(row, column);
        nameLink.textContent = window.matchMedia("(max-width: 900px)").matches
          ? compactMobilePlayerName(fullPlayerName)
          : fullPlayerName;
        if (fullPlayerName) nameLink.setAttribute("aria-label", fullPlayerName);`,
    "mobile N. Surname player names",
  );

  table = replaceRequired(
    table,
    `      } else if (column === "listing_price") {
        const listingBadge = listingPriceBadgeHtml(row);
        if (listingBadge) {
          cell.innerHTML = listingBadge ? \`<span class="listingCellTableHost">\${listingBadge}</span>\` : "";
        } else {
          cell.setAttribute("aria-label", "Not For Sale");
        }`,
    `      } else if (column === "listing_price") {
        const listingBadge = listingPriceBadgeHtml(row);
        if (listingBadge) {
          if (!window.matchMedia("(max-width: 900px)").matches) {
            cell.innerHTML = \`<span class="listingCellTableHost">\${listingBadge}</span>\`;
          } else {
            const template = document.createElement("template");
            template.innerHTML = listingBadge.trim();
            const badge = template.content.firstElementChild;
            const price = badge instanceof HTMLElement ? badge.querySelector(".listingCellPrice") : null;
            const priceText = String(price?.textContent || "").trim();
            if (badge instanceof HTMLElement) {
              price?.remove();
              if (priceText) {
                badge.dataset.tooltip = priceText;
                badge.setAttribute("aria-label", priceText);
                badge.tabIndex = 0;
              }
              const host = document.createElement("span");
              host.className = "listingCellTableHost";
              host.appendChild(badge);
              cell.appendChild(host);
            }
          }
        } else {
          cell.setAttribute("aria-label", "Not For Sale");
        }`,
    "mobile icon-only Listing cell",
  );

  table = replaceRequired(
    table,
    `      } else if (column === joinedAgencyColumn) {
        cell.textContent = formatCellValue(row, column);`,
    `      } else if (column === joinedAgencyColumn) {
        const joinedAgencyValue = formatCellValue(row, column);
        cell.textContent = window.matchMedia("(max-width: 520px)").matches
          ? compactMobileJoinedAgency(joinedAgencyValue)
          : joinedAgencyValue;`,
    "small-screen Joined Agency date-only value",
  );

  return Object.freeze({
    ...input,
    core,
    routeChunks: Object.freeze({ ...routeChunks, table }),
  });
}
