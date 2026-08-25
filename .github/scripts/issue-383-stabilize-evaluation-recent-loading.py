from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"{label} anchor mismatch: expected 1, found {text.count(old)}")
    path.write_text(text.replace(old, new, 1))


runtime_path = Path("site/evaluation-search-state-runtime.js")
replace_once(
    runtime_path,
    '''  function renderRecentLoadingMessage(field = input()) {
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return false;
    if (recentLoadingActive && recentLoadingMessageVisible()) return true;
    const results = document.getElementById("evaluationSearchResults");
    if (!(results instanceof HTMLElement)) return false;
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = "Loading…";
    results.replaceChildren(hint);
    results.hidden = false;
    recentLoadingActive = true;
    return true;
  }

''',
    '''  function renderRecentLoadingMessage(field = input()) {
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return false;
    if (recentLoadingActive && recentLoadingMessageVisible()) return true;
    const results = document.getElementById("evaluationSearchResults");
    if (!(results instanceof HTMLElement)) return false;
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = "Loading…";
    results.replaceChildren(hint);
    results.hidden = false;
    recentLoadingActive = true;
    return true;
  }

  function ownsEmptyRecentResults() {
    const field = input();
    return recentLoadingActive
      && active()
      && field instanceof HTMLInputElement
      && !field.value.trim();
  }

''',
    "recent-loading ownership probe",
)
replace_once(
    runtime_path,
    '''  function renderEmptySearchFromCore() {
    if (!active()) {
      recentLoadingActive = false;
      return false;
    }
    const field = input();
    if (!(field instanceof HTMLInputElement) || field.value.trim()) {
      recentLoadingActive = false;
      return false;
    }
    try {
      coreContracts()?.renderCurrentEvaluationSearchResults?.();
    } catch (error) {
      console.warn("Could not render recent Evaluation searches.", error);
      recentLoadingActive = false;
      return false;
    }
    recentLoadingActive = false;
    syncClearButton(field);
    return true;
  }
''',
    '''  function renderEmptySearchFromCore() {
    if (!active()) {
      recentLoadingActive = false;
      return false;
    }
    const field = input();
    if (!(field instanceof HTMLInputElement) || field.value.trim()) {
      recentLoadingActive = false;
      return false;
    }
    recentLoadingActive = false;
    try {
      coreContracts()?.renderCurrentEvaluationSearchResults?.();
    } catch (error) {
      console.warn("Could not render recent Evaluation searches.", error);
      return false;
    }
    syncClearButton(field);
    return true;
  }
''',
    "recent-loading completion handoff",
)
replace_once(
    runtime_path,
    '''  window.__mflEvaluationSearchStateRuntime = Object.freeze({
    sync,
    restoreEmptyRecentResults,
    commitRecentPlayer,
    selectEmptySearch,
    destroy,
  });
''',
    '''  window.__mflEvaluationSearchStateRuntime = Object.freeze({
    sync,
    restoreEmptyRecentResults,
    commitRecentPlayer,
    selectEmptySearch,
    ownsEmptyRecentResults,
    destroy,
  });
''',
    "recent-loading ownership export",
)

core_path = Path("site/modules/app-core.js")
replace_once(
    core_path,
    '''function renderEvaluationSearchResults() {
  syncEvaluationSearchClearButton();
  const query = normalizeSearchText(evaluationSearchInput.value.trim());

  if (!query && !shouldShowEvaluationRecentResults()) {
''',
    '''function renderEvaluationSearchResults() {
  syncEvaluationSearchClearButton();
  const query = normalizeSearchText(evaluationSearchInput.value.trim());

  if (!query && window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()) {
    return;
  }

  if (!query && !shouldShowEvaluationRecentResults()) {
''',
    "canonical Evaluation empty-results ownership guard",
)

validator_path = Path("site/validate-evaluation-search-lifecycle.mjs")
validator = validator_path.read_text()
anchor = '''invariant(
  renderSource.includes('button.addEventListener("click", async () => {')
    && renderSource.includes("state.evaluationPlayerId = playerId;")
    && renderSource.includes("syncEvaluationPlayerUrl(playerId);")
    && renderSource.includes('incrementalRouteTarget("evaluation", { playerId })')
    && renderSource.includes("requestIncrementalRoute(route, 1)")
    && renderSource.includes("renderEvaluationTable(row);")
    && renderSource.includes("withInteractionBusy(loadAndRender)"),
  "Clicking an Evaluation search result must select that player, sync the Evaluation URL, load the player route, and render the Evaluation.",
);
'''
addition = anchor + '''invariant(
  renderSource.includes("if (!query && window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()) {")
    && renderSource.indexOf("window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()")
      < renderSource.indexOf("evaluationSearchResults.replaceChildren();"),
  "Canonical Evaluation rendering must preserve the recent-search Loading… surface while the local recent-search runtime owns empty results.",
);
'''
if validator.count(anchor) != 1:
    raise SystemExit("Evaluation render ownership validator anchor mismatch")
validator = validator.replace(anchor, addition, 1)
anchor = '''const primeStart = searchRuntime.indexOf("function primeRecentSearchData");
'''
addition = '''const recentCompletionStart = searchRuntime.indexOf("function renderEmptySearchFromCore()");
const recentCompletionEnd = searchRuntime.indexOf("async function fetchRecentEvaluationPayload", recentCompletionStart);
const recentCompletionSource = recentCompletionStart >= 0 && recentCompletionEnd > recentCompletionStart
  ? searchRuntime.slice(recentCompletionStart, recentCompletionEnd)
  : "";
invariant(
  searchRuntime.includes("function ownsEmptyRecentResults() {")
    && searchRuntime.includes("recentLoadingActive")
    && searchRuntime.includes("ownsEmptyRecentResults,")
    && recentCompletionSource.includes("recentLoadingActive = false;")
    && recentCompletionSource.includes("coreContracts()?.renderCurrentEvaluationSearchResults?.();")
    && recentCompletionSource.indexOf("recentLoadingActive = false;")
      < recentCompletionSource.indexOf("coreContracts()?.renderCurrentEvaluationSearchResults?.();"),
  "Evaluation recent-search loading ownership must remain active through intermediate core renders, then transfer to the core exactly once when authoritative recent results complete.",
);

''' + anchor
if validator.count(anchor) != 1:
    raise SystemExit("Evaluation loading completion validator anchor mismatch")
validator_path.write_text(validator.replace(anchor, addition, 1))
