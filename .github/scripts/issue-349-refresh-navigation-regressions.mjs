import { readFile, writeFile } from "node:fs/promises";

async function update(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change produced for ${path}`);
  await writeFile(path, after);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

await update("site/index.html", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '          const routeSelector = `html:not(.mflInitialRouteResolved)[data-initial-table-page="${tablePage}"]`;',
    '          const routeSelector = `html:not(.mflInitialRouteResolved):not(.mflNavigationPending)[data-initial-table-page="${tablePage}"]`;',
    "initial table-view route selector",
  );
  source = replaceOnce(
    source,
    '            `${routeSelector} #progressionPage .views > .viewButton { display: none; border-color: var(--border-strong); background: var(--surface); color: var(--text); }`,',
    '            `${routeSelector} #progressionPage .views > .viewButton { display: none; }`,\n            `${routeSelector} #progressionPage .views > .viewButton:not(:hover) { border-color: var(--border-strong); background: var(--surface); color: var(--text); }`,',
    "initial table-view neutral styling",
  );
  source = replaceOnce(
    source,
    '      html:not(.mflInitialRouteResolved):is(\n        [data-initial-table-page="database"],\n        [data-initial-table-page="mfl"],\n        [data-initial-table-page="progression"],\n        [data-initial-table-page="watchlist"],\n        [data-initial-table-page="myplayers"]\n      ) #sidebar .navButton[data-page] {',
    '      html:not(.mflInitialRouteResolved):not(.mflNavigationPending):is(\n        [data-initial-table-page="database"],\n        [data-initial-table-page="mfl"],\n        [data-initial-table-page="progression"],\n        [data-initial-table-page="watchlist"],\n        [data-initial-table-page="myplayers"]\n      ) #sidebar .navButton[data-page]:not(:hover) {',
    "initial sidebar neutral styling",
  );

  for (const selector of [
    '[data-initial-table-page="database"] #sidebar .navButton[data-page="database"]',
    '[data-initial-table-page="mfl"] #sidebar .navButton[data-page="mfl"]',
    '[data-initial-table-page="progression"] #sidebar .navButton[data-page="progression"]',
    '[data-initial-table-page="watchlist"] #sidebar .navButton[data-page="watchlist"]',
    '[data-initial-table-page="myplayers"] #sidebar .navButton[data-page="myplayers"]',
    '[data-initial-page="evaluation"] #sidebar .navButton[data-page="evaluation"]',
    '[data-initial-page="settings"] #sidebar .navButton[data-page="settings"]',
  ]) {
    const before = `html:not(.mflInitialRouteResolved)${selector}`;
    const after = `html:not(.mflInitialRouteResolved):not(.mflNavigationPending)${selector}`;
    source = replaceOnce(source, before, after, `initial active sidebar selector ${selector}`);
  }
  return source;
});

await update("site/loading.css", (source) => replaceOnce(
  source,
  'html.mflInitialChromePreparing body:has(> #appShell),\nhtml.mflInitialChromePreparing body:has(> #appShell) *,\nhtml.mflInitialChromePreparing body:has(> #appShell) *::before,\nhtml.mflInitialChromePreparing body:has(> #appShell) *::after {\n  transition: none;\n  animation-play-state: paused;\n}\n\n',
  '',
  "global initial-chrome animation suppression",
));

await update("site/modules/app-core.js", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    'function takeStagedViewTransition(pageName, viewName) {\n  const transition = pendingViewTransition;\n  if (\n    !transition\n    || transition.pageName !== String(pageName || "")\n    || transition.viewName !== String(viewName || "")\n  ) return null;\n  pendingViewTransition = null;\n  return transition;\n}',
    'function takeStagedViewTransition(pageName, viewName) {\n  const transition = pendingViewTransition;\n  if (\n    !transition\n    || transition.pageName !== String(pageName || "")\n    || transition.viewName !== String(viewName || "")\n  ) return null;\n  return stagedViewTransitionIsCurrent(transition) ? transition : null;\n}',
    "staged view transition ownership",
  );
  source = replaceOnce(
    source,
    '  setView = async function setIncrementalView(viewName) {\n    if (!state.incrementalMode || state.currentPage === "club") {\n      return originalSetView.apply(this, arguments);\n    }\n\n    const pageName = state.currentPage;',
    '  setView = async function setIncrementalView(viewName) {\n    const pageName = state.currentPage;\n    if (!tablePages.has(pageName)) {\n      return originalSetView.apply(this, arguments);\n    }',
    "incremental table-view capability gate",
  );
  return source;
});

await update("site/validate-stats-animation-owner.mjs", (source) => replaceOnce(
  source,
  'invariant(!loadingStyles.includes("mflInteractionBusy"), "Stats animation ownership must not depend on a retired global busy blocker.");\nconst chromeAnimationStart = loadingStyles.indexOf("html.mflInitialChromePreparing");\nconst chromeAnimationEnd = loadingStyles.indexOf(\'html:not(.mflInitialRouteResolved)[data-initial-table-page="club"]\', chromeAnimationStart);\nconst chromeAnimationBlock = loadingStyles.slice(chromeAnimationStart, chromeAnimationEnd);\ninvariant(chromeAnimationStart >= 0 && chromeAnimationEnd > chromeAnimationStart, "Initial chrome animation ownership must remain explicit.");\nincludes(chromeAnimationBlock, "animation-play-state: paused;", "Initial chrome preparation must pause animations without recreating them at first route readiness.");\nexcludes(chromeAnimationBlock, "animation: none;", "Initial chrome preparation must not restart Stats animations when readiness settles.");',
  'invariant(!loadingStyles.includes("mflInteractionBusy"), "Stats animation ownership must not depend on a retired global busy blocker.");\nexcludes(loadingStyles, "html.mflInitialChromePreparing", "Refresh/loading state must not blanket-disable transitions or pause animations; normal hover and component animation ownership must remain active.");\nexcludes(loadingStyles, "animation-play-state: paused;", "Refresh/loading must not globally pause animations.");\nexcludes(loadingStyles, "transition: none;", "Refresh/loading must not globally disable hover transitions.");',
  "stats loading-animation validation",
));

await update("site/validate-static-route-ui.mjs", (source) => {
  const marker = '\nconsole.log("Static route validation passed with bootstrap-owned table headers, passive route chrome, minimal centered not-found rendering, canonical loading rows, and explicit core contracts.");';
  const addition = [
    "",
    "invariant(",
    "  indexHtml.includes('html:not(.mflInitialRouteResolved):not(.mflNavigationPending)[data-initial-table-page=')",
    "    && indexHtml.includes('html:not(.mflInitialRouteResolved):not(.mflNavigationPending):is(')",
    "    && indexHtml.includes(') #sidebar .navButton[data-page]:not(:hover) {'),",
    '  "Refresh-only first-paint route chrome must relinquish page/view button ownership as soon as live navigation begins, while leaving normal hover styling available.",',
    ");",
    "invariant(",
    "  indexHtml.includes('#progressionPage .views > .viewButton:not(:hover) { border-color: var(--border-strong); background: var(--surface); color: var(--text); }'),",
    '  "Initial table-view neutral styling must not override normal hover presentation.",',
    ");",
    "",
  ].join("\n");
  if (!source.includes(marker)) throw new Error("Missing static-route validator footer");
  return source.replace(marker, addition + marker);
});

await update("site/validate-loading-ownership.mjs", (source) => {
  const addition = `\nconst stagedViewOwnerStart = appCoreSource.indexOf("function takeStagedViewTransition(pageName, viewName) {");\nconst stagedViewOwnerEnd = appCoreSource.indexOf("function waitForViewTransitionPaint()", stagedViewOwnerStart);\nconst stagedViewOwner = appCoreSource.slice(stagedViewOwnerStart, stagedViewOwnerEnd);\ninvariant(\n  stagedViewOwnerStart >= 0\n    && stagedViewOwnerEnd > stagedViewOwnerStart\n    && stagedViewOwner.includes("return stagedViewTransitionIsCurrent(transition) ? transition : null;")\n    && !stagedViewOwner.includes("pendingViewTransition = null;"),\n  "A staged view transition must remain the current loading owner until the global view-transition runner finishes its async loader.",\n);\nconst incrementalViewStart = appCoreSource.indexOf("setView = async function setIncrementalView(viewName) {");\nconst incrementalViewEnd = appCoreSource.indexOf("setPage = async function setIncrementalPage", incrementalViewStart);\nconst incrementalViewOwner = appCoreSource.slice(incrementalViewStart, incrementalViewEnd);\ninvariant(\n  incrementalViewStart >= 0\n    && incrementalViewEnd > incrementalViewStart\n    && incrementalViewOwner.includes("const pageName = state.currentPage;\\n    if (!tablePages.has(pageName)) {")\n    && !incrementalViewOwner.includes("if (!state.incrementalMode"),\n  "Table view navigation must use route capability rather than completed-data state, so a view click during refresh cancels the old request and starts loading the selected view.",\n);\n`;
  return source + addition;
});

console.log("Issue #349 refresh navigation regressions patched.");
