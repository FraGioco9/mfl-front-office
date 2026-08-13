(() => {
  "use strict";

  const STYLE_ID = "mflMobileUiRuntimeStyles";

  window.__mflMobileUiRuntime?.destroy?.();

  let destroyed = false;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html[data-mfl-mobile-layout="true"] #sidebar .navButton,
      html[data-mfl-mobile-layout="true"] .appShell.menuClosed #sidebar .navButton,
      html[data-mfl-mobile-layout="true"] .appShell.sidebarClosed #sidebar .navButton,
      html[data-mfl-mobile-layout="true"] .appShell.sidebarCollapsed #sidebar .navButton,
      html[data-mfl-mobile-layout="true"] .appShell.collapsed #sidebar .navButton {
        grid-template-columns: 16px minmax(0, 1fr) !important;
        flex: 0 0 88px !important;
        width: 88px !important;
        min-width: 88px !important;
        max-width: 88px !important;
        padding: 0 4px !important;
      }

      html[data-mfl-mobile-layout="true"] #sidebar .navButton .navEmoji {
        width: 14px !important;
        min-width: 14px !important;
        max-width: 14px !important;
      }

      html[data-mfl-mobile-layout="true"] #sidebar .navButton .navText {
        min-width: 0 !important;
        font-size: 11px !important;
        white-space: nowrap !important;
      }

      html[data-mfl-mobile-layout="true"] #searchModal > .searchDialog {
        height: min(492px, calc(100dvh - 16px)) !important;
        max-height: min(492px, calc(100dvh - 16px)) !important;
      }

      html[data-mfl-mobile-layout="true"] #searchModal .searchResults {
        height: 366px !important;
        max-height: 366px !important;
        grid-auto-rows: 66px !important;
        align-content: start !important;
      }

      html[data-mfl-mobile-layout="true"] #searchModal .searchResults.filledSearchResults {
        grid-template-rows: repeat(5, minmax(0, 1fr)) !important;
        align-content: stretch !important;
      }
    `;
    document.head.appendChild(style);
  }

  function sync() {
    if (destroyed) return;
    installStyles();
  }

  function destroy() {
    destroyed = true;
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();

  window.__mflMobileUiRuntime = Object.freeze({ sync, destroy });
})();
