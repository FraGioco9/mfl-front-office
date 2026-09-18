(() => {
  "use strict";

  const INTERMEDIATE_TABLE_HEADER_MEDIA = window.matchMedia("(min-width: 901px) and (max-width: 1366px)");
  const root = document.documentElement;
  const head = document.getElementById("tableHead");

  if (!INTERMEDIATE_TABLE_HEADER_MEDIA.matches || !(head instanceof HTMLTableSectionElement)) return;

  let applying = false;

  const tableHeaderLabels = () => Array.from(head.querySelectorAll(
    "[data-mfl-full-table-label][data-mfl-compact-table-label]",
  )).filter((label) => label instanceof HTMLElement);

  const applyCompactLabels = (labels = tableHeaderLabels()) => {
    if (applying || !labels.length) return;
    applying = true;
    try {
      root.dataset.mflFirstPaintTableHeaderMode = "compact";
      labels.forEach((label) => {
        const compact = String(label.dataset.mflCompactTableLabel || "").trim();
        if (compact && label.textContent !== compact) label.textContent = compact;
      });
    } finally {
      applying = false;
    }
  };

  applyCompactLabels();

  const headerObserver = new MutationObserver(() => {
    if (!applying) applyCompactLabels();
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
