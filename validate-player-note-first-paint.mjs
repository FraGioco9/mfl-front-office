import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const playerSource = read("./html-sources/player.html");
const noteSource = read("./html-sources/player-note-first-paint.html");
const generatedIndex = read("./index.html");
const responsive = read("./responsive.css");
const mobilePlacement = read("./responsive-sources/player-note-tablet.css.inc");
const desktopPlacement = read("./responsive-sources/player-note-desktop.css.inc");

assert.ok(
  playerSource.includes('if (notesPanel instanceof HTMLElement) notesPanel.hidden = root.dataset.storedWalletOptIn !== "true";'),
  "The canonical Player shell must keep its proven stored-opt-in Notes visibility owner.",
);
assert.ok(
  playerSource.includes('style="visibility:hidden" aria-hidden="true" disabled')
    && playerSource.includes('class="playerNotesCount" style="visibility:hidden"'),
  "The base Player shell must remain passive until the dedicated Notes first-paint fragment synchronizes it.",
);

const iconSyncIndex = noteSource.indexOf("const syncPlayerNoteIcons = () => {");
const initialRouteGuardIndex = noteSource.indexOf('if (root.dataset.initialEntityRoute !== "player") return;');
assert.ok(
  iconSyncIndex >= 0 && initialRouteGuardIndex > iconSyncIndex,
  "The Note icon normalizer must initialize globally before the direct-refresh-only first-paint data branch.",
);

for (const source of [noteSource, generatedIndex]) {
  assert.ok(
    source.includes('localStorage.getItem("mfl-wallet-player-notes-v1:" + wallet)'),
    "Direct Player first paint must read the current linked wallet note cache before hydration.",
  );
  assert.ok(
    source.includes('if (input.style.visibility) input.style.removeProperty("visibility");')
      && source.includes('if (count.style.visibility) count.style.removeProperty("visibility");'),
    "Opted-in direct refreshes must reveal the existing Notes field/count during parser-owned first paint.",
  );
  assert.ok(
    source.includes('if (input.value !== cachedPlayerNote) input.value = cachedPlayerNote;')
      && source.includes('const nextCount = cachedPlayerNote.length + "/100";')
      && source.includes('if (count.textContent !== nextCount) count.textContent = nextCount;'),
    "First-paint Notes synchronization must be idempotent so its pending observer cannot self-trigger indefinitely.",
  );
  assert.ok(
    source.includes('const syncPlayerNoteIcons = () => {')
      && source.includes('const svg = document.createElementNS(namespace, "svg");')
      && source.includes('svg.classList.add("playerNoteIconSvg");')
      && source.includes('svg.setAttribute("viewBox", "0 0 24 24");')
      && source.includes('page.setAttribute("d", "M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z");')
      && source.includes('fold.setAttribute("d", "M13 2v5h5");')
      && source.includes('lineOne.setAttribute("d", "M8 11h6");')
      && source.includes('lineTwo.setAttribute("d", "M8 15h6");'),
    "Player Note presentation must use the recreated inline document/note SVG rather than an emoji or cached external asset.",
  );
  assert.ok(
    source.includes('note.querySelector(":scope > .playerNoteIconSvg")')
      && source.includes('note.replaceChildren(createPlayerNoteSvg());')
      && source.includes('iconObserver.observe(playerDetail, { childList: true, subtree: true });'),
    "Pending and hydrated Note renderers must be normalized idempotently to the recreated SVG.",
  );
  assert.ok(
    source.includes('note.className = "playerNoteIcon";')
      && source.includes('note.dataset.tooltip = cachedPlayerNote;')
      && source.includes('note.setAttribute("aria-label", "Player note");')
      && source.includes('note.appendChild(createPlayerNoteSvg());')
      && !source.includes('note.textContent = "📝";'),
    "A cached Player note must render the recreated SVG synchronously during first paint.",
  );
}

for (const token of [
  '.playerHeroIdentity .playerTitle > :is(.playerTitleNoteIcon:not(:empty), .playerListingBadge) {\n    position: absolute;\n    top: var(--mfl-player-panel-padding);\n    display: grid;\n    place-items: center;\n    box-sizing: border-box;',
  'width: 14px;\n    min-width: 14px;\n    max-width: 14px;\n    height: 14px;',
  '.playerHeroIdentity .playerTitle > .playerListingBadge {\n    right: var(--mfl-player-panel-padding);',
  '.playerHeroIdentity .playerTitle > .playerTitleNoteIcon:not(:empty) {\n    right: calc(var(--mfl-player-panel-padding) + 22px);',
  '.playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon > .playerNoteIconSvg,\n  .playerHeroIdentity .playerTitle > .playerListingBadge .listingCellIcon {',
  'display: block;\n    place-self: center;\n    width: 14px;',
  '.playerHeroIdentity .playerTitle > .playerListingBadge .listingCellIcon {\n    object-fit: contain;\n    object-position: center;',
  'stroke-width: 1.8;',
]) {
  assert.ok(mobilePlacement.includes(token), `Canonical mobile Player Note/Listing alignment is missing: ${token}`);
  assert.ok(responsive.includes(token), `Generated responsive mobile Player Note/Listing alignment is missing: ${token}`);
}

for (const token of [
  '@media (min-width: 901px) {',
  '.playerHeroIdentity {\n    flex: 1 1 360px;\n    width: auto;\n    max-width: 600px;',
  '.playerHeroIdentity .playerTitle {\n    align-items: baseline;\n    flex-wrap: nowrap;\n  }',
  '.playerHeroIdentity .playerTitle > .playerTitleName {\n    order: 0;\n    flex: 0 0 auto;\n    white-space: nowrap;\n  }',
  '.playerHeroIdentity .playerTitle > .playerTitleNoteIcon {\n    position: static;\n    order: 1;\n    display: grid;\n    place-items: center;\n    flex: 0 0 22px;\n    align-self: center;',
  '.playerHeroIdentity .playerTitle > .playerListingBadge {\n    position: relative;\n    top: auto;\n    right: auto;\n    order: 2;\n    display: inline-flex;\n    align-items: center;\n    flex: 0 0 auto;\n    align-self: center;\n    width: max-content;\n    min-width: 0;\n    max-width: none;\n    height: 22px;',
  'padding: 0 5px 0 23px;\n    font-size: 16px;\n    line-height: 1;\n    white-space: nowrap;',
  '.playerHeroIdentity .playerTitle > .playerListingBadge .listingCellIcon {\n    position: absolute;\n    top: 4px;\n    left: 5px;\n    display: block;\n    width: 14px;\n    height: 14px;\n    margin: 0;',
  '.playerHeroIdentity .playerTitle > .playerListingBadge .listingCellPrice {\n    display: block;\n    line-height: 1;',
  '.playerNotesInput {\n    min-height: 150px;',
]) {
  assert.ok(desktopPlacement.includes(token), `Canonical desktop Player title alignment is missing: ${token}`);
  assert.ok(responsive.includes(token), `Generated responsive desktop Player title alignment is missing: ${token}`);
}

assert.ok(
  !desktopPlacement.includes('.playerHeroIdentity .playerTitle > .playerTitleName {\n    order: 0;\n    display:')
    && !desktopPlacement.includes('.playerHeroIdentity .playerTitle > .playerTitleName {\n    order: 0;\n    line-height:'),
  "Desktop Note/Listing alignment must not alter the Player name display or line-height geometry.",
);
assert.ok(
  !desktopPlacement.includes('.playerPage {\n    max-width:'),
  "Long-name title space must come from the existing Player hero width rather than changing the page/table width contract.",
);
assert.ok(
  desktopPlacement.includes('flex: 1 1 360px;')
    && desktopPlacement.includes('max-width: 600px;')
    && desktopPlacement.includes('flex: 0 0 auto;\n    white-space: nowrap;'),
  "Desktop Player names must remain single-line while the identity section absorbs available hero width before controls can compress the name.",
);
assert.ok(
  !desktopPlacement.includes('.playerListingBadge::before')
    && desktopPlacement.includes('width: max-content;')
    && desktopPlacement.includes('padding: 0 5px 0 23px;')
    && desktopPlacement.includes('display: inline-flex;\n    align-items: center;')
    && desktopPlacement.includes('align-self: center;'),
  "Desktop Listing must preserve its content-sized background while centering the whole badge on the Player-name line.",
);

for (const source of [mobilePlacement, desktopPlacement]) {
  assert.ok(
    source.includes('.playerHeroIdentity .playerTitle > .playerTitleNoteIcon:empty') && source.includes('display: none;'),
    "An empty note host must not reserve title gap before note data exists.",
  );
  assert.ok(!source.includes("!important"), "Player Note placement must not use !important.");
  assert.ok(!source.includes("transform:"), "Player Note placement must use real layout coordinates rather than transform nudges.");
  assert.ok(!source.includes("/player-note.svg"), "Player Note presentation must not depend on the removed external icon asset.");
}

console.log("Player Note inline SVG rendering, first-paint availability, mobile Note/Listing exact shared-box alignment, desktop single-line Player names with flexible identity width, content-sized Listing centered on the Player-name line, Notes desktop height, and observer idempotency validation passed.");
