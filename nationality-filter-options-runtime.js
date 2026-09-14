(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "");
  window.__mflNationalityFilterOptionsRuntime?.destroy?.();

  let destroyed = false;
  let nationalityOptions = [];
  let loadingPromise = null;
  let coreObserver = null;
  let bridgeInstalled = false;

  function dataClientFetch(input, init = {}, options = {}) {
    const dataClient = Reflect.get(window, "__mflDataClient");
    if (!dataClient || typeof dataClient.fetch !== "function") {
      return Promise.reject(new Error("Canonical data client is unavailable."));
    }
    return dataClient.fetch(input, init, options);
  }

  function clubRouteActive() {
    const root = document.documentElement;
    const bodyPage = String(document.body?.dataset.page || "").toLowerCase();
    if (bodyPage === "club") return true;
    return root.dataset.mflReady !== "true"
      && String(root.dataset.initialTablePage || "").toLowerCase() === "club";
  }

  function nationalityLabel(value) {
    return String(value || "")
      .toLowerCase()
      .replaceAll("_", " ")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function publishOptions() {
    window.__mflNationalityFilterOptions = Object.freeze([...nationalityOptions]);
  }

  function installCoreBridge() {
    if (destroyed || bridgeInstalled || clubRouteActive()) return bridgeInstalled;
    try {
      bridgeInstalled = Boolean(window.eval(`(() => {
        if (typeof uniqueNationalityValues !== "function") return false;
        if (uniqueNationalityValues.__mflAuthoritativeFilterOptions) return true;
        const originalUniqueNationalityValues = uniqueNationalityValues;
        const authoritativeNationalityValues = function() {
          const values = window.__mflNationalityFilterOptions;
          if (!Array.isArray(values) || !values.length) {
            return originalUniqueNationalityValues.apply(this, arguments);
          }
          return values.map((value) => ({
            value,
            label: typeof formatNationality === "function" ? formatNationality(value) : String(value),
          }));
        };
        Object.defineProperty(authoritativeNationalityValues, "__mflAuthoritativeFilterOptions", { value: true });
        uniqueNationalityValues = authoritativeNationalityValues;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install nationality filter options.", error);
      bridgeInstalled = false;
    }
    return bridgeInstalled;
  }

  function refreshCanonicalControls() {
    if (clubRouteActive() || !nationalityOptions.length || !installCoreBridge()) return false;
    try {
      return Boolean(window.eval(`(() => {
        if (typeof readFilterDraftRules !== "function" || typeof restoreFilterDraftRules !== "function") return false;
        const rules = readFilterDraftRules();
        if (!Array.isArray(rules) || !rules.some((rule) => rule?.column === "nationality")) return true;
        restoreFilterDraftRules(rules);
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not refresh nationality filter controls.", error);
      return false;
    }
  }

  async function load() {
    if (destroyed || clubRouteActive()) return [];
    if (nationalityOptions.length) return nationalityOptions;
    if (loadingPromise) return loadingPromise;

    loadingPromise = dataClientFetch("/api/data?mode=filter-options", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }, {
      dedupe: true,
      key: "nationality-filter-options",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load nationality filter options.");
        if (destroyed || clubRouteActive()) return [];
        nationalityOptions = Array.from(new Set(
          (Array.isArray(payload.nationalities) ? payload.nationalities : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        )).sort((a, b) => nationalityLabel(a).localeCompare(nationalityLabel(b)));
        publishOptions();
        installCoreBridge();
        refreshCanonicalControls();
        return nationalityOptions;
      })
      .catch((error) => {
        if (!destroyed) console.error(error?.message || "Could not load nationality filter options.");
        return [];
      })
      .finally(() => {
        loadingPromise = null;
      });
    return loadingPromise;
  }

  function installCoreBridgeWhenAvailable() {
    if (clubRouteActive() || installCoreBridge()) return;
    coreObserver = new MutationObserver((records, observer) => {
      if (clubRouteActive()) return;
      const coreInserted = records.some((record) => Array.from(record.addedNodes).some((node) => (
        node instanceof HTMLScriptElement && node.dataset.mflRuntime === "/modules/app-core.js"
      )));
      if (!coreInserted) return;
      observer.disconnect();
      coreObserver = null;
      installCoreBridge();
      refreshCanonicalControls();
    });
    coreObserver.observe(document.head, { childList: true });
  }

  function onClick(event) {
    if (clubRouteActive()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#openFiltersButton")) return;
    void load().then(() => refreshCanonicalControls());
  }

  function onReady() {
    if (clubRouteActive()) return;
    installCoreBridge();
    refreshCanonicalControls();
  }

  document.addEventListener("click", onClick);
  window.addEventListener("mfl:ready", onReady);
  if (!clubRouteActive()) {
    installCoreBridgeWhenAvailable();
    void load();
  }

  function destroy() {
    destroyed = true;
    coreObserver?.disconnect();
    coreObserver = null;
    document.removeEventListener("click", onClick);
    window.removeEventListener("mfl:ready", onReady);
  }

  window.__mflNationalityFilterOptionsRuntime = Object.freeze({
    version: VERSION,
    load,
    refresh: refreshCanonicalControls,
    destroy,
  });
})();
