// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

export function addMobileTablePresentation(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  let table = String(routeChunks.table || "").replace(/\r\n?/g, "\n");
  if (!table.trim()) {
    throw new Error("Cannot normalize mobile table presentation before the Table route chunk exists.");
  }

  table = replaceRequired(
    table,
    '    label.textContent = column === agentColumn && state.currentPage === "mfl" ? "" : columnLabels[column];',
    `    cell.dataset.tableColumn = column;
    const fullLabel = columnLabels[column] || "";
    label.dataset.mflFullTableLabel = fullLabel;
    const mobileTable = window.matchMedia("(max-width: 900px)").matches;
    const mobileLabel = mobileTable
      ? ({
          positions: "POS",
          overall: "OVR",
          pace: "PAC",
          shooting: "SHO",
          passing: "PAS",
          dribbling: "DRI",
          defense: "DEF",
          physical: "PHY",
          goalkeeping: "GK",
        }[column] || "")
      : "";
    label.textContent = column === agentColumn && state.currentPage === "mfl"
      ? ""
      : mobileTable && column === "listing_price"
        ? ""
        : mobileLabel || fullLabel;`,
    "compact mobile table headers",
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
        const mobileTable = window.matchMedia("(max-width: 900px)").matches;
        if (!mobileTable) {
          const listingBadge = listingPriceBadgeHtml(row);
          if (listingBadge) {
            cell.innerHTML = listingBadge ? \`<span class="listingCellTableHost">\${listingBadge}</span>\` : "";
          } else {
            cell.setAttribute("aria-label", "Not For Sale");
          }
        } else {
          const rawListingPrice = getValue(row, "listing_price");
          const numericListingPrice = rawListingPrice === null || rawListingPrice === undefined || rawListingPrice === ""
            ? NaN
            : Number(rawListingPrice);
          if (Number.isFinite(numericListingPrice)) {
            const priceText = "$" + listingPriceFormatter.format(numericListingPrice);
            const listingHost = document.createElement("span");
            listingHost.className = "listingCellTableHost";
            const listingBadge = document.createElement("span");
            listingBadge.className = "listingCellContent";
            listingBadge.dataset.tooltip = priceText;
            listingBadge.dataset.mflListingPrice = priceText;
            listingBadge.setAttribute("aria-label", priceText);
            listingBadge.tabIndex = 0;
            const listingIcon = document.createElement("img");
            listingIcon.className = "listingCellIcon";
            listingIcon.src = "/listing-shopping-bag.svg";
            listingIcon.width = 12;
            listingIcon.height = 12;
            listingIcon.alt = "";
            listingIcon.setAttribute("aria-hidden", "true");
            listingBadge.appendChild(listingIcon);
            listingHost.appendChild(listingBadge);
            cell.appendChild(listingHost);
          } else {
            cell.setAttribute("aria-label", "Not For Sale");
          }
        }`,
    "mobile-only icon Listing cell with price-only tooltip",
  );

  return Object.freeze({
    ...input,
    routeChunks: Object.freeze({ ...routeChunks, table }),
  });
}
