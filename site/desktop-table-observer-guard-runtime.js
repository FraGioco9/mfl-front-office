(() => {
  "use strict";

  // Keep the legacy restore hook harmless. This runtime no longer replaces
  // or filters MutationObserver, so loading and layout observers stay native.
  window.__mflRestoreNativeMutationObserver = () => {};

  if (document.querySelector('link[data-mfl-desktop-table-widths="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/desktop-table-width.css";
  link.dataset.mflDesktopTableWidths = "true";
  document.head.appendChild(link);
})();
