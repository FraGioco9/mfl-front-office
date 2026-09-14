// @ts-check

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
}

const APP_CONFIG_EXPORTS = `  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";`;

const APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE = `  window.__mflAppConfig = appConfig;
  window.__mflRelease = data.release;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialRoute = routes.initialRequest(location.pathname);
  const initialRouteShell = routes.requestShellId(initialRoute, {
    walletOptedIn: typeof document !== "undefined"
      && document.documentElement?.dataset?.storedWalletOptIn === "true",
  });
  if (typeof document !== "undefined") {
    document.documentElement.dataset.initialRoutePage = initialRoute.pageName;
    if (initialRouteShell) document.documentElement.dataset.initialRouteShell = initialRouteShell;
    else delete document.documentElement.dataset.initialRouteShell;
    if (document.body) document.body.dataset.page = initialRoute.pageName;
  }

  const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";`;

/**
 * Commit the real initial route and release metadata in the parser-blocking
 * pre-bootstrap runtime without adding DOM-repair ownership. Bootstrap
 * consumers reuse the published canonical route request instead of reparsing
 * destination paths independently.
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
