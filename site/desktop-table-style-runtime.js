(() => {
  "use strict";

  const STYLESHEET_PATH = "/desktop-table-layout.css";
  if (document.querySelector(`link[data-mfl-stylesheet="${STYLESHEET_PATH}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_PATH;
  link.dataset.mflStylesheet = STYLESHEET_PATH;
  document.head.appendChild(link);
})();
