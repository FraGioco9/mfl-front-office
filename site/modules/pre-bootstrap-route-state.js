// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const APP_CONFIG_EXPORTS = `  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";`;

const APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE = `  window.__mflAppConfig = appConfig;
  window.__mflRelease = data.release;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialRoute = routes.initialRequest(location.pathname);
  if (typeof document !== "undefined" && document.body) document.body.dataset.page = initialRoute.pageName;
  if (typeof document !== "undefined" && document.body) {
    const releaseFooter = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (releaseFooter) releaseFooter.textContent = \`MFL Front Office v\${data.release.version}\`;
  }

  const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";`;

/**
 * Commit the real initial route and release metadata in the parser-blocking
 * pre-bootstrap runtime. This keeps first paint authoritative without a CSS
 * override or independently owned version literal.
 * @param {string} source
 */
export function normalizePreBootstrapRouteState(source) {
  return replaceRequired(
    String(source || ""),
    APP_CONFIG_EXPORTS,
    APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE,
    "pre-bootstrap runtime commits the initial route and release before bootstrap hydration",
  );
}
