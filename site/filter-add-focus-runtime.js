(() => {
  "use strict";

  const previous = window.__mflFilterAddFocusRuntime;
  previous?.destroy?.();

  const NEUTRAL_ATTRIBUTE = "data-mfl-initial-filter-neutral";
  const STYLE_ID = "mflFilterAddFocusRuntimeStyles";
  const POINTER_ESCAPE_CONTROL_SELECTOR = [
    "button",
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    '[role="button"]',
  ].join(", ");
  let destroyed = false;
  let pointerFocusedControl = null;
  let recentEvaluationResultNodes = [];
  let recentEvaluationObserver = null;
  const evaluationResultBusyCleanups = new Map();

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"],
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"]:hover,
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"]:focus,
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"]:focus-visible {
        outline: none;
        border-color: var(--border-strong);
        background: var(--surface);
        color: var(--text);
        box-shadow: none;
      }

      /* While the shared busy controller is active, the transparent busy
         overlay is the only pointer target. This prevents controls underneath
         it from acquiring pointer interaction while their loading state changes. */
      html.mflInteractionBusy body *,
      html.mflInteractionBusy body *::before,
      html.mflInteractionBusy body *::after {
        pointer-events: none !important;
      }

      /* The Evaluation clear control also carries popupCloseButton. Neutralize
         the generic popup hover background while busy so the X cannot flash when
         the results list disappears underneath a stationary pointer. */
      html.mflInteractionBusy body .evaluationSearchClearButton,
      html.mflInteractionBusy body .evaluationSearchClearButton:hover:not(:disabled),
      html.mflInteractionBusy body .evaluationSearchClearButton:focus:not(:disabled),
      html.mflInteractionBusy body .evaluationSearchClearButton:focus-visible:not(:disabled) {
        border-color: transparent;
        background: transparent;
        box-shadow: none;
        transition: none;
        animation: none;
      }

      /* One canonical close control for every popup header. Keep the button
         geometry and the drawn X independent from surrounding popup styles. */
      .filtersHeader > .popupCloseButton {
        position: relative;
        display: inline-grid;
        place-items: center;
        flex: 0 0 36px;
        width: 36px;
        min-width: 36px;
        max-width: 36px;
        height: 36px;
        min-height: 36px;
        max-height: 36px;
        margin: 0;
        padding: 0;
        font-size: 0;
        line-height: 0;
        text-indent: 0;
      }

      .filtersHeader > .popupCloseButton::before,
      .filtersHeader > .popupCloseButton::after,
      .evaluationSearchClearButton::before,
      .evaluationSearchClearButton::after {
        content: "";
        position: absolute;
        display: block;
        top: 50%;
        left: 50%;
        right: auto;
        bottom: auto;
        width: 12px;
        height: 2px;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: currentColor;
        transform-origin: 50% 50%;
        pointer-events: none;
      }

      .filtersHeader > .popupCloseButton::before,
      .evaluationSearchClearButton::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }

      .filtersHeader > .popupCloseButton::after,
      .evaluationSearchClearButton::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }
    `;
    document.head.appendChild(style);
  }

  function clearInitialNeutral(control) {
    if (control instanceof HTMLElement) control.removeAttribute(NEUTRAL_ATTRIBUTE);
  }

  function markInitialNeutral(control) {
    if (!(control instanceof HTMLElement)) return;
    control.setAttribute(NEUTRAL_ATTRIBUTE, "true");
    if (document.activeElement === control) control.blur();

    requestAnimationFrame(() => {
      if (destroyed || !control.isConnected) return;
      if (!control.matches(":hover") && document.activeElement !== control) {
        clearInitialNeutral(control);
      }
    });
  }

  function markNewestRuleControls() {
    const rules = document.querySelectorAll("#filterRules .filterRule");
    const rule = rules.item(rules.length - 1);
    if (!(rule instanceof HTMLElement)) return;
    rule.querySelectorAll("input, select").forEach(markInitialNeutral);
  }

  function addFilterSelect() {
    const select = document.getElementById("addFilterSelect");
    return select instanceof HTMLSelectElement ? select : null;
  }

  function showAddFilterButton() {
    const button = document.getElementById("showAddFilterButton");
    return button instanceof HTMLButtonElement ? button : null;
  }

  function evaluationSearchInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function evaluationSearchResults() {
    const results = document.getElementById("evaluationSearchResults");
    return results instanceof HTMLElement ? results : null;
  }

  function evaluationResultId(button) {
    if (!(button instanceof HTMLButtonElement)) return "";
    const match = String(button.textContent || "").match(/#(\d+)/);
    return match?.[1] || "";
  }

  function rememberVisibleEvaluationRecents(force = false) {
    const input = evaluationSearchInput();
    const results = evaluationSearchResults();
    if (!input || !results || (!force && input.value.trim())) return false;

    const buttons = Array.from(results.querySelectorAll(":scope > .evaluationSearchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
    if (!buttons.length) return false;

    recentEvaluationResultNodes = buttons;
    return true;
  }

  function rememberClickedEvaluationResult(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const playerId = evaluationResultId(button);
    const remaining = recentEvaluationResultNodes.filter((candidate) => {
      if (!(candidate instanceof HTMLButtonElement)) return false;
      return !playerId || evaluationResultId(candidate) !== playerId;
    });
    recentEvaluationResultNodes = [button, ...remaining].slice(0, 5);
  }

  function restoreRecentEvaluationResultsImmediately() {
    const input = evaluationSearchInput();
    const results = evaluationSearchResults();
    if (!input || input.value.trim() || !results || !recentEvaluationResultNodes.length) return false;

    const nodes = recentEvaluationResultNodes
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
    if (!nodes.length) return false;

    results.replaceChildren(...nodes);
    results.hidden = false;
    return true;
  }

  function resetEvaluationSelection() {
    try {
      if (typeof window.resetEvaluationSelection === "function") {
        window.resetEvaluationSelection();
      } else {
        window.eval("if (typeof resetEvaluationSelection === 'function') resetEvaluationSelection();");
      }
    } catch (error) {
      console.warn("Could not reset Evaluation selection.", error);
    }
  }

  function enterEmptyEvaluationSearch(event = null) {
    const input = evaluationSearchInput();
    if (!input || input.value.trim()) return false;

    // This runtime loads before the authoritative search runtime. Own the empty
    // input event so deleting the final character does not first render from the
    // typed-query index or wait for another database request.
    event?.stopImmediatePropagation?.();
    delete document.documentElement.dataset.evaluationSearchQueryPending;

    const clearButton = document.getElementById("evaluationSearchClearButton");
    if (clearButton instanceof HTMLElement) clearButton.hidden = true;

    resetEvaluationSelection();
    restoreRecentEvaluationResultsImmediately();
    return true;
  }

  function releaseEvaluationResultBusyToken(token) {
    if (!token) return;
    const cleanup = evaluationResultBusyCleanups.get(token);
    if (cleanup) cleanup();
    evaluationResultBusyCleanups.delete(token);
    window.__mflInteractionBusy?.end?.(token);
  }

  function primeEvaluationResultBusy(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const controller = window.__mflInteractionBusy;
    if (!controller?.begin || !controller?.end) return;

    const token = controller.begin("evaluation-result-selection");
    if (!token) return;

    const panel = document.getElementById("evaluationPanel");
    let panelChanged = false;
    let sawRouteLoading = Boolean(document.body?.classList.contains("evaluationRouteLoading"));
    let releaseFrame = 0;
    let releaseSettleFrame = 0;

    const cleanup = () => {
      panelObserver?.disconnect();
      bodyObserver?.disconnect();
      window.clearTimeout(fallbackTimer);
      if (releaseFrame) cancelAnimationFrame(releaseFrame);
      if (releaseSettleFrame) cancelAnimationFrame(releaseSettleFrame);
      releaseFrame = 0;
      releaseSettleFrame = 0;
    };

    const releaseAfterSettledFrames = () => {
      if (!evaluationResultBusyCleanups.has(token) || releaseFrame) return;
      releaseFrame = requestAnimationFrame(() => {
        releaseFrame = 0;
        releaseSettleFrame = requestAnimationFrame(() => {
          releaseSettleFrame = 0;
          releaseEvaluationResultBusyToken(token);
        });
      });
    };

    const maybeRelease = () => {
      if (!evaluationResultBusyCleanups.has(token)) return;
      const routeLoading = Boolean(document.body?.classList.contains("evaluationRouteLoading"));
      if (routeLoading) sawRouteLoading = true;
      if (routeLoading) return;

      // A real panel mutation means the selected player's Evaluation has
      // rendered. If the route used the stability loading class, wait for that
      // class to end as well. Two additional frames keep the newly exposed X
      // under the shared busy styling until final layout has settled.
      if (panelChanged || sawRouteLoading) releaseAfterSettledFrames();
    };

    const panelObserver = panel instanceof HTMLElement
      ? new MutationObserver(() => {
        panelChanged = true;
        maybeRelease();
      })
      : null;
    panelObserver?.observe(panel, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    const bodyObserver = new MutationObserver(maybeRelease);
    if (document.body) bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // Safety valve only. Normal network requests are bounded by the site's API timeout.
    const fallbackTimer = window.setTimeout(() => releaseEvaluationResultBusyToken(token), 65_000);
    evaluationResultBusyCleanups.set(token, cleanup);
  }

  function clearEvaluationSearchFromButton(event, target) {
    const button = target?.closest?.("#evaluationSearchClearButton");
    if (!(button instanceof HTMLButtonElement)) return false;

    const input = evaluationSearchInput();
    if (!input) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    input.value = "";
    button.hidden = true;
    resetEvaluationSelection();
    input.focus({ preventScroll: true });
    restoreRecentEvaluationResultsImmediately();
    return true;
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (clearEvaluationSearchFromButton(event, target)) return;

    const evaluationResult = target?.closest?.("#evaluationSearchResults .evaluationSearchResult");
    if (evaluationResult instanceof HTMLButtonElement && !evaluationResult.disabled) {
      rememberClickedEvaluationResult(evaluationResult);
      primeEvaluationResultBusy(evaluationResult);
      return;
    }

    if (!target?.closest("#showAddFilterButton")) return;

    const select = addFilterSelect();
    if (!select) return;

    event.preventDefault();
    event.stopPropagation();
    select.hidden = !select.hidden;

    if (select.hidden) clearInitialNeutral(select);
    else markInitialNeutral(select);

    const button = showAddFilterButton();
    if (button && document.activeElement === button) button.blur();
  }

  function onInput(event) {
    const input = evaluationSearchInput();
    if (!input || event.target !== input) return;

    if (!input.value.trim()) {
      enterEmptyEvaluationSearch(event);
      return;
    }

    // On the first typed character the DOM still contains the empty-state recent
    // results. Capture them before the authoritative runtime replaces the list
    // with Searching/results, so final-character deletion can restore them in
    // this exact input event with no network wait.
    if (!recentEvaluationResultNodes.length) rememberVisibleEvaluationRecents(true);
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== "addFilterSelect" || !target.value) return;

    const addFilterRule = window.addFilterRule;
    if (typeof addFilterRule !== "function") return;

    event.stopPropagation();
    const column = target.value;
    addFilterRule(column, { focus: false });
    target.value = "";
    target.hidden = true;
    clearInitialNeutral(target);
    markNewestRuleControls();
  }

  function neutralControlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(`[${NEUTRAL_ATTRIBUTE}="true"]`);
    return control instanceof HTMLElement ? control : null;
  }

  function pointerControlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const direct = target.closest(POINTER_ESCAPE_CONTROL_SELECTOR);
    if (direct instanceof HTMLElement) return direct;

    const label = target.closest("label");
    const control = label instanceof HTMLLabelElement ? label.control : null;
    return control instanceof HTMLElement && control.matches(POINTER_ESCAPE_CONTROL_SELECTOR)
      ? control
      : null;
  }

  function onPointerDown(event) {
    clearInitialNeutral(neutralControlFromTarget(event.target));
    pointerFocusedControl = pointerControlFromTarget(event.target);
  }

  function onPointerOut(event) {
    const control = neutralControlFromTarget(event.target);
    if (!control) return;
    const next = event.relatedTarget;
    if (next instanceof Node && control.contains(next)) return;
    clearInitialNeutral(control);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      const active = document.activeElement;
      if (pointerFocusedControl && active === pointerFocusedControl) {
        pointerFocusedControl.blur();
        pointerFocusedControl = null;
      }
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      // Once the user deliberately returns to keyboard navigation, leave native
      // focus-visible behavior intact for accessibility.
      pointerFocusedControl = null;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#filtersModal")) return;
    document.querySelectorAll(`#filtersModal [${NEUTRAL_ATTRIBUTE}="true"]`).forEach(clearInitialNeutral);
  }

  function onFocusIn(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (pointerFocusedControl && target !== pointerFocusedControl) pointerFocusedControl = null;

    const control = neutralControlFromTarget(event.target);
    if (control && document.activeElement === control) control.blur();
  }

  function observeEvaluationRecentResults() {
    const results = evaluationSearchResults();
    if (!results) return;
    recentEvaluationObserver?.disconnect();
    recentEvaluationObserver = new MutationObserver(() => rememberVisibleEvaluationRecents(false));
    recentEvaluationObserver.observe(results, { childList: true });
    rememberVisibleEvaluationRecents(false);
  }

  installStyles();
  document.addEventListener("click", onClick, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);
  observeEvaluationRecentResults();

  function destroy() {
    destroyed = true;
    pointerFocusedControl = null;
    recentEvaluationObserver?.disconnect();
    recentEvaluationObserver = null;
    recentEvaluationResultNodes = [];
    Array.from(evaluationResultBusyCleanups.keys()).forEach(releaseEvaluationResultBusyToken);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.querySelectorAll(`[${NEUTRAL_ATTRIBUTE}="true"]`).forEach(clearInitialNeutral);
    document.getElementById(STYLE_ID)?.remove();
  }

  window.__mflFilterAddFocusRuntime = Object.freeze({ destroy });
})();
