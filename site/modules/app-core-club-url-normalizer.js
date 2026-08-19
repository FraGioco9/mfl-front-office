// @ts-check

function replaceRequired(source, before, after, label) {
  const text = String(source || "");
  if (!text.includes(before)) {
    throw new Error(`Could not normalize Club URL ownership: ${label}.`);
  }
  return text.replace(before, after);
}

export function normalizeClubUrlStability(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) throw new Error("Cannot normalize Club URL ownership in an empty application core.");

  core = replaceRequired(
    core,
    "function pagePath(pageName, options = {}) {\n",
    `function pagePath(pageName, options = {}) {
  if (pageName === "club") {
    const routeConfig = window.__mflAppConfig?.routes;
    const currentClubRoute = routeConfig?.clubRoute?.(window.location.pathname);
    const clubId = String(options.clubId || currentClubRoute?.clubId || "").trim();
    const clubView = String(options.view || currentClubRoute?.view || state.view || "attributes").trim().toLowerCase();
    const clubPath = clubId ? routeConfig?.clubPath?.(clubId, clubView) : "";
    return clubPath || window.location.pathname;
  }
`,
    "canonical pagePath Club branch",
  );

  core = replaceRequired(
    core,
    `function updatePageUrl(pageName, options = {}) {
  if (!options.updateUrl) {`,
    `function updatePageUrl(pageName, options = {}) {
  if (state.currentPage === "club" && pageName !== "club") {
    return;
  }
  if (!options.updateUrl) {`,
    "post-hydration non-Club URL guard",
  );

  if (!core.includes('if (pageName === "club") {\n    const routeConfig = window.__mflAppConfig?.routes;')) {
    throw new Error("Generated core must route pagePath(\"club\") through canonical Club configuration.");
  }
  if (!core.includes('if (state.currentPage === "club" && pageName !== "club") {')) {
    throw new Error("Generated core must reject late non-Club URL writes while a Club page is active.");
  }

  return Object.freeze({
    ...input,
    core: core.replace(/\s*$/, ""),
    routeChunks: Object.freeze({ ...routeChunks }),
  });
}
