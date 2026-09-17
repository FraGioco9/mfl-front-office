(() => {
  "use strict";

  const INTERMEDIATE_TABLE_HEADER_MEDIA = window.matchMedia("(min-width: 901px) and (max-width: 1444px)");
  const HEADER_LABEL_OVERFLOW_EPSILON = 1;
  const root = document.documentElement;
  const head = document.getElementById("tableHead");

  if (!INTERMEDIATE_TABLE_HEADER_MEDIA.matches || !(head instanceof HTMLTableSectionElement)) return;

  let mode = "";
  let applying = false;

  const tableHeaderLabels = () => Array.from(head.querySelectorAll(
    "[data-mfl-full-table-label][data-mfl-compact-table-label]",
  )).filter((label) => label instanceof HTMLElement);

  const applyMode = (labels = tableHeaderLabels()) => {
    if (!mode || applying || !labels.length) return;
    applying = true;
    try {
      labels.forEach((label) => {
        const full = String(label.dataset.mflFullTableLabel || "").trim();
        const compact = String(label.dataset.mflCompactTableLabel || "").trim();
        if (!full) return;
        const desired = mode === "compact" && compact ? compact : full;
        if (label.textContent !== desired) label.textContent = desired;
      });
    } finally {
      applying = false;
    }
  };

  const decideMode = () => {
    const labels = tableHeaderLabels();
    if (!labels.length) return false;

    applying = true;
    try {
      labels.forEach((label) => {
        const full = String(label.dataset.mflFullTableLabel || "").trim();
        if (full && label.textContent !== full) label.textContent = full;
      });

      const useCompact = labels.some((label) => {
        const full = String(label.dataset.mflFullTableLabel || "").trim();
        const compact = String(label.dataset.mflCompactTableLabel || "").trim();
        if (!full || !compact || compact === full || label.getClientRects().length === 0 || label.clientWidth <= 0) return false;
        return label.scrollWidth - label.clientWidth > HEADER_LABEL_OVERFLOW_EPSILON;
      });

      mode = useCompact ? "compact" : "full";
      root.dataset.mflFirstPaintTableHeaderMode = mode;
      labels.forEach((label) => {
        const full = String(label.dataset.mflFullTableLabel || "").trim();
        const compact = String(label.dataset.mflCompactTableLabel || "").trim();
        if (!full) return;
        const desired = mode === "compact" && compact ? compact : full;
        if (label.textContent !== desired) label.textContent = desired;
      });
      return true;
    } finally {
      applying = false;
    }
  };

  decideMode();

  const headerObserver = new MutationObserver(() => {
    if (applying) return;
    if (!mode) {
      decideMode();
      return;
    }
    applyMode();
  });
  headerObserver.observe(head, { childList: true, subtree: true });

  const handoffObserver = new MutationObserver(() => {
    if (root.dataset.mflRouteReady !== "true") return;
    requestAnimationFrame(() => {
      headerObserver.disconnect();
      handoffObserver.disconnect();
    });
  });
  handoffObserver.observe(root, { attributes: true, attributeFilter: ["data-mfl-route-ready"] });
})();
