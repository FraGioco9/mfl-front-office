(() => {
  "use strict";

  const INTERMEDIATE_TABLE_HEADER_MEDIA = window.matchMedia("(min-width: 901px) and (max-width: 1444px)");
  const HEADER_LABEL_OVERFLOW_EPSILON = 1;

  if (!INTERMEDIATE_TABLE_HEADER_MEDIA.matches) return;

  const labels = Array.from(document.querySelectorAll(
    "#progressionPage #tableHead [data-mfl-full-table-label][data-mfl-compact-table-label]",
  )).filter((label) => label instanceof HTMLElement);
  if (!labels.length) return;

  labels.forEach((label) => {
    const full = String(label.dataset.mflFullTableLabel || "").trim();
    if (full) label.textContent = full;
  });

  const useCompact = labels.some((label) => {
    const full = String(label.dataset.mflFullTableLabel || "").trim();
    const compact = String(label.dataset.mflCompactTableLabel || "").trim();
    if (!full || !compact || compact === full || label.getClientRects().length === 0 || label.clientWidth <= 0) return false;
    return label.scrollWidth - label.clientWidth > HEADER_LABEL_OVERFLOW_EPSILON;
  });

  if (useCompact) {
    labels.forEach((label) => {
      const compact = String(label.dataset.mflCompactTableLabel || "").trim();
      if (compact) label.textContent = compact;
    });
  }

  document.documentElement.dataset.mflFirstPaintTableHeaderMode = useCompact ? "compact" : "full";
})();
