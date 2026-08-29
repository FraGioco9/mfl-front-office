from pathlib import Path

core = Path("site/modules/app-core.js")
text = core.read_text(encoding="utf-8")

old_start = '''function optOutWallet() {
  const previousWalletAddress = state.linkedWalletAddress;
  clearWalletNotesState();'''
new_start = '''function optOutWallet() {
  const previousWalletAddress = state.linkedWalletAddress;
  const routeAtOptOut = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  const protectedRouteAtOptOut = ["myplayers", "watchlist", "settings"].includes(routeAtOptOut.pageName)
    ? routeAtOptOut
    : null;
  clearWalletNotesState();'''
if old_start not in text:
    raise SystemExit("optOutWallet start marker not found")
text = text.replace(old_start, new_start, 1)

old_transition = '''  updateAccountState();
  updateMenuVisibility();
  normalizeCurrentViewsAfterProgressionAccessLoss();'''
new_transition = '''  updateAccountState();
  updateMenuVisibility();

  if (protectedRouteAtOptOut) {
    const lockedPage = protectedRouteAtOptOut.pageName;
    const lockedOptions = protectedRouteAtOptOut.options && typeof protectedRouteAtOptOut.options === "object"
      ? protectedRouteAtOptOut.options
      : {};
    setPage(lockedPage, false, { ...lockedOptions, preserveScroll: true });
    saveTableState();
    showToast("Dapper opt-in removed.");
    return;
  }

  normalizeCurrentViewsAfterProgressionAccessLoss();'''
if old_transition not in text:
    raise SystemExit("optOutWallet transition marker not found")
text = text.replace(old_transition, new_transition, 1)

old_tail = '''  if (state.currentPage === "watchlist") {
    const targetPath = pagePath("watchlist", { view: defaultViewForPage("watchlist") });
    if (`${window.location.pathname}${window.location.search}` !== targetPath) {
      window.history.replaceState({}, "", targetPath);
    }
    setPage("watchlist", false, { plain: true, view: defaultViewForPage("watchlist") });
    return;
  }

  if (state.currentPage === "myplayers" || state.currentPage === "settings") {
    setPage(state.currentPage, false);
    return;
  }'''
new_tail = '''  if (state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") {
    setPage(state.currentPage, false, { preserveScroll: true });
    return;
  }'''
if old_tail not in text:
    raise SystemExit("legacy protected opt-out tail marker not found")
text = text.replace(old_tail, new_tail, 1)
core.write_text(text, encoding="utf-8")

validator = Path("site/validate-static-route-ui.mjs")
vtext = validator.read_text(encoding="utf-8")
anchor = '''invariant(lockedRouteDecision > setPageStart && lockedRouteGuard > lockedRouteDecision && guardedReplace > lockedRouteDecision && guardedUpdate > lockedRouteDecision, "Opted-out protected routes must preserve the requested refresh URL and reuse one scoped setPage lock decision.");
'''
addition = '''const optOutStart = coreSource.indexOf("function optOutWallet() {");
const optOutEnd = optOutStart >= 0 ? coreSource.indexOf("function walletAddressCandidatesFromValue", optOutStart) : -1;
invariant(optOutStart >= 0 && optOutEnd > optOutStart, "Wallet opt-out transition owner must remain in canonical app core.");
const optOutSource = coreSource.slice(optOutStart, optOutEnd);
includes(optOutSource, 'const routeAtOptOut = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);', "Wallet opt-out must capture the live URL route before clearing wallet identity.");
includes(optOutSource, 'const protectedRouteAtOptOut = ["myplayers", "watchlist", "settings"].includes(routeAtOptOut.pageName)', "Protected-page opt-out must derive locked-page identity from the live route rather than stale page state.");
includes(optOutSource, 'setPage(lockedPage, false, { ...lockedOptions, preserveScroll: true });', "Protected-page opt-out must immediately render the locked shell for the routed page.");
excludes(optOutSource, 'pagePath("watchlist"', "Watchlist opt-out must not canonicalize to a default Watchlist view.");
excludes(optOutSource, 'window.history.replaceState({}, "", targetPath);', "Wallet opt-out must not rewrite the current protected URL.");
'''
if addition not in vtext:
    if anchor not in vtext:
        raise SystemExit("static route validator anchor not found")
    vtext = vtext.replace(anchor, anchor + addition, 1)
validator.write_text(vtext, encoding="utf-8")
