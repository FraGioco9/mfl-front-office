// @ts-check

/**
 * Keep the canonical route state emitted by modules/app-config.js unchanged.
 * Route classification, canonical URL repair, and not-found handling are source-owned
 * by app-config before bootstrap or route runtimes execute.
 * @param {string} source
 */
export function normalizePreBootstrapRouteState(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n");
  if (!normalized.trim()) throw new Error("Cannot normalize an empty pre-bootstrap route runtime.");
  if (!normalized.includes("const initialRoute = routes.initialRequest(location.pathname);")) {
    throw new Error("Canonical app config must commit its initial route before bootstrap hydration.");
  }
  if (!normalized.includes('return { pageName: "notfound", options: {} };')) {
    throw new Error("Canonical app config must classify unknown routes as not-found.");
  }
  if (normalized.includes('location.replace("/")')) {
    throw new Error("Canonical app config must not redirect malformed routes to Home.");
  }
  return normalized;
}
