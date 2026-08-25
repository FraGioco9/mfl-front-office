from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label} anchor mismatch: expected 1, found {count}")
    path.write_text(text.replace(old, new, 1))


core_path = Path("site/modules/app-core.js")
replace_once(
    core_path,
    '''let evaluationRecentSearchPrimed = false;
let evaluationRecentSearchPrimePromise = null;
let evaluationEmptySearchFocusScheduled = false;
''',
    '''let evaluationEmptySearchFocusScheduled = false;
''',
    "legacy Evaluation recent-prime state",
)
replace_once(
    core_path,
    '''function primeEmptyEvaluationSearch() {
  focusEmptyEvaluationSearchWhenReady();
  if (evaluationRecentSearchPrimed || evaluationRecentSearchPrimePromise) return evaluationRecentSearchPrimePromise;

  databaseSearchResponseCache.delete("players:");
  evaluationRecentSearchPrimePromise = requestDatabaseSearch("", "players")
    .then((loaded) => {
      if (loaded) {
        evaluationRecentSearchPrimed = true;
        if (isPlainEvaluationUrl() && !state.evaluationPlayerId) renderEvaluationSearchResults();
      }
      return loaded;
    })
    .catch((error) => {
      console.error(error?.message || "Could not load recent Evaluation searches.");
      return false;
    })
    .finally(() => {
      evaluationRecentSearchPrimePromise = null;
    });
  return evaluationRecentSearchPrimePromise;
}
''',
    '''function primeEmptyEvaluationSearch() {
  focusEmptyEvaluationSearchWhenReady();
  const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
  return typeof prime === "function" ? prime(false, true) : Promise.resolve(false);
}
''',
    "canonical Evaluation recent prime",
)
replace_once(
    core_path,
    '''    if (typeof primeEmptyEvaluationSearch === "function" && !primeEmptyEvaluationSearch.__mflDataOnly) {
      const dataOnlyPrimeEmptyEvaluationSearch = function() {
        const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
        if (typeof prime === "function") return prime(true);
        return Promise.resolve(true);
      };
      Object.defineProperty(dataOnlyPrimeEmptyEvaluationSearch, "__mflDataOnly", { value: true });
      primeEmptyEvaluationSearch = dataOnlyPrimeEmptyEvaluationSearch;
    }

    if (typeof finishEvaluationReadiness === "function" && !finishEvaluationReadiness.__mflAwaitsRecentEvaluation) {
      const originalFinishEvaluationReadiness = finishEvaluationReadiness;
      const finishEvaluationReadinessWithRecents = async function() {
        if (isPlainEvaluationUrl() && !state.evaluationPlayerId && !evaluationSearchInput.value.trim()) {
          const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
          if (typeof prime === "function") await prime(false);
        }
        return originalFinishEvaluationReadiness.apply(this, arguments);
      };
      Object.defineProperty(finishEvaluationReadinessWithRecents, "__mflAwaitsRecentEvaluation", { value: true });
      finishEvaluationReadiness = finishEvaluationReadinessWithRecents;
    }
''',
    '''''',
    "duplicate Evaluation readiness prime wrappers",
)
replace_once(
    core_path,
    '''      if (/^\\/evaluation\\/?$/i.test(window.location.pathname)) {
        void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(true);
      }
''',
    '''      if (/^\\/evaluation\\/?$/i.test(window.location.pathname)) {
        void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false, true);
      }
''',
    "authoritative Evaluation recent-state hydration refresh",
)

runtime_path = Path("site/evaluation-search-state-runtime.js")
replace_once(
    runtime_path,
    '''  function sync() {
    if (destroyed || !active()) return;
    installCoreBridges();
    const field = input();
    if (!(field instanceof HTMLInputElement)) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false);
  }
''',
    '''  function sync() {
    if (destroyed || !active()) return;
    installCoreBridges();
    const field = input();
    if (!(field instanceof HTMLInputElement)) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);
  }
''',
    "Evaluation route-sync loading paint",
)
replace_once(
    runtime_path,
    '''  void restoreEmptyRecentResults(true, active());
''',
    '''''',
    "autonomous Evaluation startup force-prime",
)

validator_path = Path("site/validate-evaluation-search-lifecycle.mjs")
validator = validator_path.read_text()
old_render_end = 'const renderEnd = appCoreSource.indexOf("let evaluationRecentSearchPrimed", renderStart);'
new_render_end = 'const renderEnd = appCoreSource.indexOf("let evaluationEmptySearchFocusScheduled", renderStart);'
if validator.count(old_render_end) != 1:
    raise SystemExit(f"Evaluation render validator boundary mismatch: expected 1, found {validator.count(old_render_end)}")
validator = validator.replace(old_render_end, new_render_end, 1)
old = '''invariant(
  searchRuntime.includes("void restoreEmptyRecentResults(true, active());"),
  "Direct Evaluation startup must request the local recent-results Loading… state only when Evaluation is the active initial route.",
);
'''
new = '''const canonicalRecentPrimeStart = appCoreSource.indexOf("function primeEmptyEvaluationSearch()");
const canonicalRecentPrimeEnd = appCoreSource.indexOf("function waitForEvaluationDiscountRate()", canonicalRecentPrimeStart);
const canonicalRecentPrimeSource = canonicalRecentPrimeStart >= 0 && canonicalRecentPrimeEnd > canonicalRecentPrimeStart
  ? appCoreSource.slice(canonicalRecentPrimeStart, canonicalRecentPrimeEnd)
  : "";
invariant(
  canonicalRecentPrimeSource.includes("const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;")
    && canonicalRecentPrimeSource.includes('return typeof prime === "function" ? prime(false, true) : Promise.resolve(false);')
    && !canonicalRecentPrimeSource.includes("requestDatabaseSearch")
    && !appCoreSource.includes("evaluationRecentSearchPrimed")
    && !appCoreSource.includes("evaluationRecentSearchPrimePromise"),
  "Canonical Evaluation readiness must start exactly one Supabase recent-results prime and paint Loading… synchronously instead of maintaining a second empty database-search loader.",
);
const recentStateOwnershipStart = appCoreSource.indexOf("function installEvaluationRecentStateOwnership()");
const recentStateOwnershipEnd = appCoreSource.indexOf("async function ensureEvaluationRecentStateHydrated()", recentStateOwnershipStart);
const recentStateOwnershipSource = recentStateOwnershipStart >= 0 && recentStateOwnershipEnd > recentStateOwnershipStart
  ? appCoreSource.slice(recentStateOwnershipStart, recentStateOwnershipEnd)
  : "";
invariant(
  recentStateOwnershipSource.includes("restoreEmptyRecentResults?.(false, true)")
    && !recentStateOwnershipSource.includes("dataOnlyPrimeEmptyEvaluationSearch")
    && !recentStateOwnershipSource.includes("__mflDataOnly")
    && !recentStateOwnershipSource.includes("finishEvaluationReadinessWithRecents")
    && !recentStateOwnershipSource.includes("__mflAwaitsRecentEvaluation")
    && generatedSharedCore.includes('return typeof prime === "function" ? prime(false, true) : Promise.resolve(false);')
    && !generatedSharedCore.includes("finishEvaluationReadinessWithRecents")
    && !generatedSharedCore.includes("__mflAwaitsRecentEvaluation"),
  "Evaluation Supabase hydration must update the same recent-results prime without wrapping readiness or forcing a second request after the first one settles.",
);
invariant(
  searchRuntime.includes("if (!field.value.trim()) void restoreEmptyRecentResults(false, true);")
    && !searchRuntime.includes("void restoreEmptyRecentResults(true, active());")
    && !searchRuntime.includes("void restoreEmptyRecentResults(false, active());"),
  "Evaluation route activation must paint Loading… from the route sync that starts/reuses the real recent-results request, with no autonomous startup force-prime.",
);
'''
if validator.count(old) != 1:
    raise SystemExit(f"startup loading validator anchor mismatch: expected 1, found {validator.count(old)}")
validator = validator.replace(old, new, 1)
validator = validator.replace(
    "cached recent-player reuse, stable local recent-results Loading… presentation across focus/blur capture, cached plain-route re-entry",
    "cached recent-player reuse, one continuous local recent-results Loading… lifecycle, cached plain-route re-entry",
    1,
)
validator_path.write_text(validator)
