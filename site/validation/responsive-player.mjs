import { excludes, includes, invariant } from "./assertions.mjs";

export function validateResponsivePlayer(context) {
  const { sharedTableUi, responsive, controlInteractions, appCore } = context;
  includes(sharedTableUi, 'if (views.matches("#playerDetail .playerAttributeViews")) return "attribute views";', "Shared arrows must expose a contextual accessible label for Player Attribute views.");
  includes(sharedTableUi, 'target.matches("#progressionPage .views, #progressionPage .quickFilters, #playerDetail .playerAttributeViews")', "Resize observation must cover table views, Quick Filters, and dynamic Player Attribute views.");

  includes(controlInteractions, "function compactPlayerPageName(value) {", "Player interactions must own the compact mobile Player name formatter.");
  includes(controlInteractions, 'return fullName.replace(/^(\\S)[^\\s]*\\s+(?:.*\\s)?(\\S+)$/, "$1. $2");', "Mobile Player names must use N. Surname formatting.");
  includes(controlInteractions, "function syncPlayerPageDetails() {", "Player responsive detail presentation must have one interaction-runtime owner.");
  includes(controlInteractions, 'detail.querySelectorAll(".playerTitleName")', "Pending and hydrated Player titles must share the responsive name synchronizer.");
  includes(controlInteractions, "target.dataset.playerFullName = fullName;", "Responsive Player names must retain the full desktop value across breakpoint changes.");
  includes(controlInteractions, 'target.setAttribute("aria-label", fullName);', "Compact Player titles must retain the full accessible name.");

  includes(controlInteractions, 'if (mobile) playerId.removeAttribute("data-tooltip");', "Mobile Player ID copy must not expose the instructional tooltip.");
  includes(controlInteractions, 'else playerId.dataset.tooltip = "Click to copy";', "Desktop Player ID copy tooltip behavior must remain unchanged.");
  includes(appCore, "copyPlayerId(id);", "Suppressing the mobile ID tooltip must not remove ID copying.");

  includes(controlInteractions, 'listing.classList.add("playerListingBadge");', "Player listing badges must expose a mobile-specific presentation hook without changing the shared table badge.");
  includes(controlInteractions, "listing.dataset.tooltip = price;", "Mobile listed Players must expose their exact listing price through the tooltip runtime.");
  includes(controlInteractions, 'listing.setAttribute("role", "button");', "Mobile listing icons must remain keyboard-addressable tooltip controls.");
  includes(controlInteractions, 'listing.setAttribute("aria-label", `Listing price ${price}`);', "Mobile listing icons must expose the exact price accessibly.");
  includes(controlInteractions, 'listing.setAttribute("aria-label", `For Sale at ${price}`);', "Desktop listing accessibility text must be restored when leaving mobile layout.");
  includes(controlInteractions, "syncPlayerPageDetails();", "Player presentation must synchronize both initially and when its DOM changes.");
  includes(controlInteractions, 'playerAttributeViewMutationObserver.observe(detail, { childList: true, subtree: true, characterData: true });', "Player presentation must synchronize pending and hydrated DOM before paint.");
  includes(controlInteractions, 'PLAYER_VIEW_SCROLL_MEDIA.addEventListener("change", onPlayerViewScrollMediaChange);', "Player presentation must resynchronize when crossing the mobile breakpoint.");

  excludes(appCore, "function compactPlayerPageName(value) {", "Responsive Player presentation must not regrow the canonical Player core.");
  excludes(appCore, "function syncPlayerPageDetails() {", "Responsive Player presentation must remain outside the canonical Player core ownership budget.");

  includes(responsive, ".playerTitle .playerListingBadge {\n  flex: 0 0 14px;", "Mobile Player titles must reduce the Listing badge to the Listing icon box immediately after the name.");
  includes(responsive, "margin-left: 4px;", "The mobile Listing icon must sit directly to the right of the compact Player name.");
  includes(responsive, "background: transparent;", "The mobile Listing control must render the Listing icon only without the desktop price badge background.");
  includes(responsive, "-webkit-tap-highlight-color: transparent;", "Tapping the mobile Listing icon must not show browser press feedback before its tooltip.");
  includes(responsive, "transition: none;\n  animation: none;", "The mobile Listing icon must not animate when tapped; only its tooltip may appear.");
  includes(responsive, ".playerTitle .playerListingBadge .listingCellIcon {\n  flex: 0 0 14px;\n  width: 14px;\n  height: 14px;\n}", "Mobile Player titles must preserve the Listing glyph itself at a compact readable size.");
  includes(responsive, ".playerTitle .playerListingBadge .listingCellPrice {\n  display: none;\n}", "Mobile Player titles must show the listing icon without persistent price text.");
  includes(responsive, ".playerHero h2 .playerNoteIcon {\n  font-size: clamp(14px, 3.6vw, 17px);\n}", "The Player Note icon must scale proportionally on small screens until its dedicated redesign is implemented.");
  includes(responsive, ".detailGrid strong {\n    flex-wrap: nowrap;\n    overflow: hidden;\n    font-size: var(--mfl-player-value-font-size);\n    line-height: 1.2;", "Mobile Profile values must reserve descender-safe line height.");
  includes(responsive, ".detailGrid .contractDetailCard strong .playerContractTeam {\n  font-size: var(--mfl-player-value-font-size);\n  line-height: 1.2;\n}", "Mobile Contract club names must reserve enough line height for descenders.");
  includes(responsive, ".detailGrid .contractDetailCard strong .playerContractDivision {\n  font-size: var(--mfl-player-contract-division-font-size);\n  line-height: 1.2;\n}", "Mobile Contract division text must reserve enough line height for descenders.");
  includes(responsive, ".playerContractLine {\n  line-height: 1.2;\n}", "The mobile Contract baseline container must not clip descenders.");
  includes(responsive, ".playerInfoPanel .detailGrid strong .playerDetailAgeLine {\n  gap: var(--mfl-player-age-icon-gap);\n  overflow: visible;\n  line-height: 1;\n}", "Age must keep its original line box so the retirement marker remains vertically aligned while other Profile values use descender-safe line height.");

  const notesCountStart = responsive.indexOf(".playerNotesCount {");
  const notesCountEnd = notesCountStart >= 0 ? responsive.indexOf("}", notesCountStart) : -1;
  invariant(notesCountStart >= 0 && notesCountEnd > notesCountStart, "Mobile Player Notes count block is missing.");
  const notesCountBlock = responsive.slice(notesCountStart, notesCountEnd + 1);
  includes(notesCountBlock, "font-size: clamp(9px, 2.2vw, 10px);", "Mobile Notes count may scale typography while retaining desktop positioning.");
  invariant(!notesCountBlock.includes("right:") && !notesCountBlock.includes("bottom:"), "Mobile Notes count must inherit the desktop right/bottom position exactly.");
}
