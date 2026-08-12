(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "");
  const previous = window.__mflNationalityFilterOptionsRuntime;
  previous?.destroy?.();

  let destroyed = false;
  let nationalityOptions = [];
  let loadingPromise = null;
  let filterRulesObserver = null;
  let suppressAddedFilterAutofocus = false;
  const initializedSelects = new WeakSet();

  function nationalityLabel(value) {
    return String(value || "")
      .toLowerCase()
      .replaceAll("_", " ")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function nationalitySelects() {
    return Array.from(document.querySelectorAll(
      '#filterRules .filterRule[data-filter-column="nationality"] select[data-filter-value]',
    )).filter((select) => select instanceof HTMLSelectElement);
  }

  function expectedValues(selectedValue) {
    return selectedValue && !nationalityOptions.includes(selectedValue)
      ? [selectedValue, ...nationalityOptions]
      : nationalityOptions;
  }

  function releaseInitialFocus(select, selectedValue) {
    if (initializedSelects.has(select)) return;
    initializedSelects.add(select);
    if (!selectedValue && document.activeElement === select) select.blur();
  }

  function syncSelect(select) {
    if (!(select instanceof HTMLSelectElement) || !nationalityOptions.length) return;

    const selectedValue = String(select.value || "");
    const values = expectedValues(selectedValue);
    const currentValues = Array.from(select.options)
      .filter((option) => option.value !== "")
      .map((option) => option.value);
    if (currentValues.length === values.length
      && currentValues.every((value, index) => value === values[index])) {
      releaseInitialFocus(select, selectedValue);
      return;
    }

    const fragment = document.createDocumentFragment();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select...";
    fragment.appendChild(placeholder);

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = nationalityLabel(value);
      fragment.appendChild(option);
    });

    select.replaceChildren(fragment);
    select.value = selectedValue;
    releaseInitialFocus(select, selectedValue);
  }

  function sync() {
    if (destroyed || !nationalityOptions.length) return;
    nationalitySelects().forEach(syncSelect);
  }

  async function load() {
    if (destroyed) return [];
    if (nationalityOptions.length) {
      sync();
      return nationalityOptions;
    }
    if (loadingPromise) return loadingPromise;

    loadingPromise = fetch("/api/data?mode=filter-options", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load nationality filter options.");
        if (destroyed) return [];

        nationalityOptions = Array.from(new Set(
          (Array.isArray(payload.nationalities) ? payload.nationalities : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        )).sort((a, b) => nationalityLabel(a).localeCompare(nationalityLabel(b)));
        sync();
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

  function observeFilterRules() {
    const filterRules = document.getElementById("filterRules");
    if (!(filterRules instanceof HTMLElement)) return false;
    filterRulesObserver?.disconnect();
    filterRulesObserver = new MutationObserver(sync);
    filterRulesObserver.observe(filterRules, { childList: true, subtree: true });
    sync();
    return true;
  }

  function armAddedFilterAutofocusSuppression() {
    suppressAddedFilterAutofocus = true;
    queueMicrotask(() => {
      suppressAddedFilterAutofocus = false;
    });
  }

  function onFocusIn(event) {
    if (!suppressAddedFilterAutofocus) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.matches("#addFilterSelect") && !target?.closest("#filterRules .filterRule")) return;
    suppressAddedFilterAutofocus = false;
    target.blur();
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#openFiltersButton")) void load();
    if (target?.closest("#showAddFilterButton")) armAddedFilterAutofocusSuppression();
  }

  function onChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches("#addFilterSelect")) armAddedFilterAutofocusSuppression();
    if (!target?.closest("#filterRules, #addFilterSelect")) return;
    queueMicrotask(sync);
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("focusin", onFocusIn, true);
  if (!observeFilterRules()) {
    window.addEventListener("DOMContentLoaded", observeFilterRules, { once: true });
  }
  void load();

  function destroy() {
    destroyed = true;
    suppressAddedFilterAutofocus = false;
    filterRulesObserver?.disconnect();
    filterRulesObserver = null;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("focusin", onFocusIn, true);
    window.removeEventListener("DOMContentLoaded", observeFilterRules);
  }

  window.__mflNationalityFilterOptionsRuntime = Object.freeze({
    version: VERSION,
    load,
    sync,
    destroy,
  });
})();
