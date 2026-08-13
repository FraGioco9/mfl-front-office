(() => {
  "use strict";

  // This runtime no longer replaces or filters the browser MutationObserver.
  // Keep the legacy restore hook harmless because app-entry still calls it.
  window.__mflRestoreNativeMutationObserver = () => {};

  if (document.querySelector('script[data-mfl-desktop-width-owner="true"]')) return;
  const script = document.createElement("script");
  script.src = "/desktop-table-width-runtime.js";
  script.async = false;
  script.dataset.mflDesktopWidthOwner = "true";
  document.head.appendChild(script);
})();
