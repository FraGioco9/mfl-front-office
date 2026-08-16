// @ts-check

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not normalize table event pattern: ${label}.`);
  }
  return source.replace(before, after);
}

function replaceSourceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Could not normalize table event section: ${label}.`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

export function normalizeTableEventDelegation(source) {
  let nextSource = String(source || "").replace(/\r\n?/g, "\n");

  nextSource = replaceSourceSection(
    nextSource,
    "function createCopyPlayerIdButton(playerId, label = String(playerId)) {",
    "\nfunction formatCellValue(row, column) {",
    `function createCopyPlayerIdButton(playerId, label = String(playerId)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copyPlayerIdButton";
  button.textContent = label;
  button.dataset.playerId = String(playerId);
  button.dataset.tooltip = "Click to copy";
  button.setAttribute("aria-label", "Click to copy");
  markTableInteractiveHover(button, "id", playerId);
  return button;
}
`,
    "player ID copy listeners",
  );

  nextSource = replaceRequired(
    nextSource,
    [
      '  markerElement.addEventListener("mouseenter", () => showPlayerNoteTooltip(markerElement));',
      '  markerElement.addEventListener("focus", () => showPlayerNoteTooltip(markerElement));',
      '  markerElement.addEventListener("mouseleave", hidePlayerNoteTooltip);',
      '  markerElement.addEventListener("blur", hidePlayerNoteTooltip);',
    ].join("\n"),
    "",
    "name marker tooltip listeners",
  );

  nextSource = replaceRequired(
    nextSource,
    '    const playerId = getValue(row, "player_id");\n    if (state.hoveredTablePlayerId',
    '    const playerId = getValue(row, "player_id");\n    tableRow.dataset.playerId = String(playerId);\n    if (state.hoveredTablePlayerId',
    "table row player identity",
  );

  nextSource = replaceRequired(
    nextSource,
    '    selectionInput.addEventListener("click", (event) => setPlayerSelected(playerId, selectionInput.checked, event.shiftKey));',
    '    selectionInput.dataset.playerId = String(playerId);',
    "row selection listener",
  );

  nextSource = replaceRequired(
    nextSource,
    [
      '        nameLink.addEventListener("click", (event) => {',
      '          event.preventDefault();',
      '          openPlayerPage(playerId);',
      '        });',
    ].join("\n"),
    '        nameLink.dataset.playerId = String(playerId);',
    "player name listener",
  );

  nextSource = replaceRequired(
    nextSource,
    [
      '          noteIcon.addEventListener("mouseenter", () => showPlayerNoteTooltip(noteIcon));',
      '          noteIcon.addEventListener("focus", () => showPlayerNoteTooltip(noteIcon));',
      '          noteIcon.addEventListener("mouseleave", hidePlayerNoteTooltip);',
      '          noteIcon.addEventListener("blur", hidePlayerNoteTooltip);',
    ].join("\n"),
    "",
    "player note tooltip listeners",
  );

  nextSource = replaceRequired(
    nextSource,
    [
      '          if (tooltip) {',
      '            link.dataset.tooltip = tooltip;',
      '            link.addEventListener("mouseenter", () => showPlayerNoteTooltip(link));',
      '            link.addEventListener("focus", () => showPlayerNoteTooltip(link));',
      '            link.addEventListener("mouseleave", hidePlayerNoteTooltip);',
      '            link.addEventListener("blur", hidePlayerNoteTooltip);',
      '          }',
      '          link.addEventListener("click", (event) => {',
      '            event.preventDefault();',
      '            openAgentPage(walletAddress);',
      '          });',
    ].join("\n"),
    [
      '          link.dataset.walletAddress = String(walletAddress || "");',
      '          if (tooltip) {',
      '            link.dataset.tooltip = tooltip;',
      '          }',
    ].join("\n"),
    "agent table listeners",
  );

  nextSource = replaceRequired(
    nextSource,
    [
      '          clubLink.addEventListener("click", (event) => {',
      '            if (typeof window.mflOpenClubPage !== "function") return;',
      '            event.preventDefault();',
      '            window.mflOpenClubPage(clubId, "attributes");',
      '          });',
    ].join("\n"),
    '          clubLink.dataset.clubId = clubId;',
    "club table listener",
  );

  const delegatedTableEvents = `function tableTooltipTarget(event) {
  const target = event.target instanceof Element
    ? event.target.closest("#tableBody [data-note-tooltip], #tableBody [data-tooltip]")
    : null;
  return target instanceof HTMLElement ? target : null;
}

function copyDelegatedPlayerId(button, event) {
  const playerId = String(button.dataset.playerId || "").trim();
  if (!playerId) return;
  event.preventDefault();
  event.stopPropagation();
  state.tooltipSuppressedUntil = Date.now() + 350;
  hidePlayerNoteTooltip({ immediate: true });
  button.blur();
  copyPlayerId(playerId);
}

tableBody?.addEventListener("pointerdown", (event) => {
  if (event.isPrimary === false || event.button !== 0 || !(event.target instanceof Element)) return;
  const button = event.target.closest(".copyPlayerIdButton[data-player-id]");
  if (!(button instanceof HTMLButtonElement) || !tableBody.contains(button)) return;
  copyDelegatedPlayerId(button, event);
});

tableBody?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const copyButton = event.target.closest(".copyPlayerIdButton[data-player-id]");
  if (copyButton instanceof HTMLButtonElement && tableBody.contains(copyButton)) {
    if (Date.now() < state.tooltipSuppressedUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    copyDelegatedPlayerId(copyButton, event);
    return;
  }

  const selectionInput = event.target.closest('.selectionCell input[type="checkbox"][data-player-id]');
  if (selectionInput instanceof HTMLInputElement && tableBody.contains(selectionInput)) {
    setPlayerSelected(selectionInput.dataset.playerId || "", selectionInput.checked, event.shiftKey);
    return;
  }

  const playerLink = event.target.closest(".playerNameLink[data-player-id]");
  if (playerLink instanceof HTMLAnchorElement && tableBody.contains(playerLink)) {
    event.preventDefault();
    openPlayerPage(playerLink.dataset.playerId || "");
    return;
  }

  const agentLink = event.target.closest(".agentTableLink[data-wallet-address]");
  if (agentLink instanceof HTMLAnchorElement && tableBody.contains(agentLink)) {
    event.preventDefault();
    openAgentPage(agentLink.dataset.walletAddress || "");
    return;
  }

  const clubLink = event.target.closest(".clubPageLink[data-club-id]");
  if (clubLink instanceof HTMLAnchorElement && tableBody.contains(clubLink) && typeof window.mflOpenClubPage === "function") {
    event.preventDefault();
    window.mflOpenClubPage(clubLink.dataset.clubId || "", "attributes");
  }
});

tableBody?.addEventListener("pointerover", (event) => {
  const tooltip = tableTooltipTarget(event);
  if (!tooltip) return;
  if (event.relatedTarget instanceof Node && tooltip.contains(event.relatedTarget)) return;
  showPlayerNoteTooltip(tooltip);
});

tableBody?.addEventListener("pointerout", (event) => {
  const tooltip = tableTooltipTarget(event);
  if (!tooltip) return;
  if (event.relatedTarget instanceof Node && tooltip.contains(event.relatedTarget)) return;
  hidePlayerNoteTooltip();
});

tableBody?.addEventListener("focusin", (event) => {
  const tooltip = tableTooltipTarget(event);
  if (tooltip) showPlayerNoteTooltip(tooltip);
});

tableBody?.addEventListener("focusout", (event) => {
  const tooltip = tableTooltipTarget(event);
  if (!tooltip) return;
  if (event.relatedTarget instanceof Node && tooltip.contains(event.relatedTarget)) return;
  hidePlayerNoteTooltip();
});

tableBody?.addEventListener("pointermove", (event) => {
  const row = event.target?.closest?.("#tableBody tr");
  const nextId = String(row?.dataset?.playerId || "").trim();
  const interactive = event.target?.closest?.("[data-table-interactive-key]");
  const interactiveKey = String(interactive?.dataset?.tableInteractiveKey || "");

  if (row && nextId && state.hoveredTablePlayerId !== nextId) {
    state.hoveredTablePlayerId = nextId;
    tableBody.querySelectorAll("tr.tableRowHovered").forEach((tableRow) => tableRow.classList.remove("tableRowHovered"));
    row.classList.add("tableRowHovered");
  }

  if (state.hoveredTableInteractiveKey !== interactiveKey) {
    state.hoveredTableInteractiveKey = interactiveKey;
    tableBody.querySelectorAll(".tableInteractiveHovered").forEach((element) => element.classList.remove("tableInteractiveHovered"));
    if (interactive) {
      interactive.classList.add("tableInteractiveHovered");
    }
  }
});

tableBody?.addEventListener("pointerleave", () => {
  state.hoveredTablePlayerId = "";
  state.hoveredTableInteractiveKey = "";
  tableBody.querySelectorAll("tr.tableRowHovered").forEach((tableRow) => tableRow.classList.remove("tableRowHovered"));
  tableBody.querySelectorAll(".tableInteractiveHovered").forEach((element) => element.classList.remove("tableInteractiveHovered"));
});
`;

  nextSource = replaceSourceSection(
    nextSource,
    'tableBody?.addEventListener("pointermove", (event) => {',
    'window.addEventListener("scroll", () => hidePlayerNoteTooltip({ immediate: true }), true);',
    delegatedTableEvents,
    "delegated table interaction owner",
  );

  return nextSource;
}
