import { includes, invariant } from "./assertions.mjs";

export function validateResponsivePlayer(context) {
  const { sharedTableUi, responsive, appCore } = context;
  includes(sharedTableUi, 'if (views.matches("#playerDetail .playerAttributeViews")) return "attribute views";', "Shared arrows must expose a contextual accessible label for Player Attribute views.");
  includes(sharedTableUi, 'target.matches("#progressionPage .views, #progressionPage .quickFilters, #playerDetail .playerAttributeViews")', "Resize observation must cover table views, Quick Filters, and dynamic Player Attribute views.");

  includes(appCore, "function compactPlayerPageName(value) {", "Player pages must own a compact mobile name formatter.");
  includes(appCore, 'return `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(" ")}`;', "Mobile Player names must use N. Surname formatting.");
  includes(appCore, "function syncPlayerTitleName(target, fullNameValue) {", "Pending and hydrated Player titles must share one responsive name owner.");
  includes(appCore, 'target.setAttribute("aria-label", fullName);', "Compact Player titles must retain the full accessible name.");

  includes(appCore, "function syncPlayerIdTooltip(target) {", "Player ID tooltip visibility must have one responsive owner.");
  includes(appCore, 'if (playerUsesMobileLayout()) target.removeAttribute("data-tooltip");', "Mobile Player ID copy must not expose the instructional tooltip.");
  includes(appCore, 'else target.dataset.tooltip = "Click to copy";', "Desktop Player ID copy tooltip behavior must remain unchanged.");
  includes(appCore, "copyPlayerId(id);", "Suppressing the mobile ID tooltip must not remove ID copying.");

  includes(appCore, "function syncPlayerListingTooltip(target) {", "Player listing-price tooltip behavior must be source-owned.");
  includes(appCore, 'target.classList.add("playerListingBadge");', "Player listing badges must expose a mobile-specific presentation hook without changing the shared table badge.");
  includes(appCore, "target.dataset.tooltip = price;", "Mobile listed Players must expose their exact listing price through the tooltip runtime.");
  includes(appCore, 'const listingBadge = playerDetail.querySelector(".playerTitle .listingCellContent");', "Hydrated Player titles must activate the listing badge tooltip contract.");
  includes(responsive, ".playerTitle .playerListingBadge .listingCellPrice {\n  display: none;\n}", "Mobile Player titles must show the listing icon without persistent price text.");

  includes(responsive, ".playerHero h2 .playerNoteIcon {\n  font-size: clamp(14px, 3.6vw, 17px);\n}", "The Player Note icon must scale proportionally on small screens.");
  includes(responsive, ".detailGrid strong {\n  flex-wrap: nowrap;\n  overflow: hidden;\n  font-size: var(--mfl-player-value-font-size);\n  line-height: 1.2;", "Mobile Profile values must reserve descender-safe line height.");

  const notesCountStart = responsive.indexOf(".playerNotesCount {");
  const notesCountEnd = notesCountStart >= 0 ? responsive.indexOf("}", notesCountStart) : -1;
  invariant(notesCountStart >= 0 && notesCountEnd > notesCountStart, "Mobile Player Notes count block is missing.");
  const notesCountBlock = responsive.slice(notesCountStart, notesCountEnd + 1);
  includes(notesCountBlock, "font-size: clamp(9px, 2.2vw, 10px);", "Mobile Notes count may scale typography while retaining desktop positioning.");
  invariant(!notesCountBlock.includes("right:") && !notesCountBlock.includes("bottom:"), "Mobile Notes count must inherit the desktop right/bottom position exactly.");
}
