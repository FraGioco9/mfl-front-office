// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const APP_CONFIG_EXPORTS = `  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialPath = cleanPath(location.pathname);`;

const APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE = `  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialRoute = routes.initialRequest(location.pathname);
  if (typeof document !== "undefined" && document.body) document.body.dataset.page = initialRoute.pageName;

  const initialPath = cleanPath(location.pathname);`;

/**
 * Commit the real initial route to body[data-page] in the parser-blocking
 * pre-bootstrap runtime. This lets the existing Home-only header visibility
 * rule behave correctly on deep-link first paint without a CSS override.
 * @param {string} source
 */
export function normalizePreBootstrapRouteState(source) {
  return replaceRequired(
    String(source || ""),
    APP_CONFIG_EXPORTS,
    APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE,
    "pre-bootstrap runtime commits the initial body route before bootstrap hydration",
  );
}
