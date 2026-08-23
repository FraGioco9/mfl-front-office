(() => {
  "use strict";

  let coreObserver = null;
  let numericStepperObserver = null;
  let destroyed = false;

  function clubRouteActive() {
    const root = document.documentElement;
    const bodyPage = String(document.body?.dataset.page || "").toLowerCase();
    if (bodyPage === "club") return true;
    return root.dataset.mflReady !== "true"
      && String(root.dataset.initialTablePage || "").toLowerCase() === "club";
  }

  function syncDropdowns(root = document) {
    try {
      window.__mflDropdowns?.enhanceVisible(root);
    } catch {
      // Dropdown enhancement is presentation-only; never block table startup.
    }
  }

  function numericStepperLabel(input) {
    const placeholder = String(input.placeholder || "value").trim().toLowerCase();
    return placeholder || "value";
  }

  function dispatchNumericStepperChange(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function adjustNumericFilterInput(input, delta) {
    if (!(input instanceof HTMLInputElement) || input.type !== "number" || !delta) return;
    try {
      if (delta > 0) input.stepUp();
      else input.stepDown();
    } catch {
      const currentValue = Number.parseFloat(input.value);
      input.value = String((Number.isFinite(currentValue) ? currentValue : 0) + delta);
    }
    dispatchNumericStepperChange(input);
  }

  function createNumericStepperButton(input, delta) {
    const button = document.createElement("button");
    const direction = delta > 0 ? "Increase" : "Decrease";
    button.type = "button";
    button.textContent = delta > 0 ? "\u25b2" : "\u25bc";
    button.setAttribute("aria-label", `${direction} ${numericStepperLabel(input)}`);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => adjustNumericFilterInput(input, delta));
    return button;
  }

  function enhanceNumericFilterInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== "number" || !input.matches("[data-filter-value]")) return;

    let control = input.parentElement;
    if (!control?.classList.contains("mflNumericStepperControl")) {
      control = document.createElement("span");
      control.className = "mflNumericStepperControl";
      input.before(control);
      control.appendChild(input);
    }

    control.querySelector(":scope > .mflIncrementStepper")?.remove();
    const stepper = document.createElement("span");
    stepper.className = "mflIncrementStepper";
    stepper.setAttribute("aria-label", `Adjust ${numericStepperLabel(input)}`);
    stepper.append(
      createNumericStepperButton(input, 1),
      createNumericStepperButton(input, -1),
    );
    control.appendChild(stepper);
    input.dataset.mflIncrementStepper = "true";
  }

  function cleanupNumericStepperControls(root) {
    root.querySelectorAll(".mflNumericStepperControl").forEach((control) => {
      const input = control.querySelector(":scope > [data-filter-value]");
      if (input instanceof HTMLInputElement && input.type === "number") return;
      if (input) control.replaceWith(input);
      else control.remove();
    });
  }

  function syncNumericSteppers(root = document) {
    if (!(root instanceof Document || root instanceof Element)) return;
    cleanupNumericStepperControls(root);
    root.querySelectorAll('input[type="number"][data-filter-value]').forEach((input) => {
      const alreadyEnhanced = input.dataset.mflIncrementStepper === "true"
        && input.parentElement?.classList.contains("mflNumericStepperControl")
        && input.parentElement.querySelector(":scope > .mflIncrementStepper");
      if (!alreadyEnhanced) enhanceNumericFilterInput(input);
    });
  }

  function installNumericStepperOwner() {
    if (destroyed || numericStepperObserver) return false;
    const filterRules = document.getElementById("filterRules");
    if (!(filterRules instanceof HTMLElement)) return false;
    syncNumericSteppers(filterRules);
    numericStepperObserver = new MutationObserver(() => syncNumericSteppers(filterRules));
    numericStepperObserver.observe(filterRules, { childList: true, subtree: true });
    return true;
  }

  function installSelectedLinksDirectOpen() {
    if (window.__mflSelectedLinksCaptureInstalled === true) return;
    window.__mflSelectedLinksCaptureInstalled = true;
    window.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest("#openSelectedLinksButton")
        : null;
      if (!(target instanceof HTMLButtonElement)) return;

      let playerIds = [];
      try {
        playerIds = Array.from(state?.selectedPlayerIds || [])
          .map((playerId) => String(playerId || "").trim())
          .filter(Boolean);
      } catch {
        return;
      }
      if (!playerIds.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      let openedCount = 0;
      playerIds.forEach((playerId) => {
        const playerWindow = window.open(`https://app.playmfl.com/players/${encodeURIComponent(playerId)}`, "_blank");
        if (!playerWindow) return;
        openedCount += 1;
        try { playerWindow.opener = null; } catch {}
      });

      if (openedCount < playerIds.length) {
        try { showToast("Allow pop-ups for this site, then click Open links again."); } catch {}
      }
      try {
        clearSelection();
      } catch {
        document.getElementById("clearSelectionButton")?.click?.();
      }
    }, true);
  }

  function restorePageSizeSelectInteraction() {
    if (document.documentElement.dataset.mflReady !== "true") return;
    const select = document.getElementById("pageSizeSelect");
    if (!(select instanceof HTMLSelectElement)) return;
    select.disabled = false;
    select.inert = false;
    select.removeAttribute("aria-disabled");
    window.__mflDropdowns?.syncSelect(select);
  }

  function installCoreBridge() {
    if (destroyed || clubRouteActive()) return false;
    try {
      const installed = Boolean(window.eval(`(() => {
        if (typeof buildOperatorSelect !== "function"
          || typeof ruleMatches !== "function"
          || typeof addFilterRule !== "function"
          || typeof contractStatusFilterColumn === "undefined") return false;

        if (!buildOperatorSelect.__mflContractOperators) {
          const originalBuildOperatorSelect = buildOperatorSelect;
          const contractAwareBuildOperatorSelect = function(column) {
            const select = originalBuildOperatorSelect(column);
            if (column === contractStatusFilterColumn) {
              select.hidden = false;
              select.replaceChildren(
                new Option("is", "="),
                new Option("is not", "!="),
              );
            }
            return select;
          };
          Object.defineProperty(contractAwareBuildOperatorSelect, "__mflContractOperators", { value: true });
          buildOperatorSelect = contractAwareBuildOperatorSelect;
        }

        if (!ruleMatches.__mflContractOperators) {
          const originalRuleMatches = ruleMatches;
          const contractAwareRuleMatches = function(row, rule) {
            if (rule?.column === contractStatusFilterColumn && rule.operator === "!=") {
              return !originalRuleMatches(row, { ...rule, operator: "=" });
            }
            return originalRuleMatches(row, rule);
          };
          Object.defineProperty(contractAwareRuleMatches, "__mflContractOperators", { value: true });
          ruleMatches = contractAwareRuleMatches;
        }

        if (!addFilterRule.__mflFilterDefaults) {
          const originalAddFilterRule = addFilterRule;
          const atMostDefaults = new Set(["age", "player_seasons", "player_id"]);
          const filterDefaultAddFilterRule = function(column, options = {}) {
            const nextOptions = { ...options };
            if (atMostDefaults.has(String(column || "")) && !nextOptions.operator) nextOptions.operator = "<=";
            const result = originalAddFilterRule(column, nextOptions);
            queueMicrotask(() => window.__mflDropdowns?.enhanceVisible(document.getElementById("filtersModal") || document));
            return result;
          };
          Object.defineProperty(filterDefaultAddFilterRule, "__mflFilterDefaults", { value: true });
          addFilterRule = filterDefaultAddFilterRule;
          window.addFilterRule = filterDefaultAddFilterRule;
        }

        return true;
      })()`));
      if (installed) syncDropdowns(document.getElementById("filtersModal") || document);
      return installed;
    } catch (error) {
      console.warn("Could not initialize filter controls.", error);
      return false;
    }
  }

  function sync() {
    if (clubRouteActive()) return false;
    installSelectedLinksDirectOpen();
    restorePageSizeSelectInteraction();
    installNumericStepperOwner();
    installCoreBridge();
    syncNumericSteppers(document.getElementById("filterRules") || document);
    syncDropdowns(document);
    return true;
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
    });
    coreObserver.observe(document.head, { childList: true });
  }

  if (!clubRouteActive()) {
    installSelectedLinksDirectOpen();
    installNumericStepperOwner();
    installCoreBridgeWhenAvailable();
  }
  window.addEventListener("mfl:ready", sync, { once: true });

  function destroy() {
    destroyed = true;
    coreObserver?.disconnect();
    coreObserver = null;
    numericStepperObserver?.disconnect();
    numericStepperObserver = null;
    window.removeEventListener("mfl:ready", sync);
  }

  window.__mflFilterControlsRuntime = Object.freeze({ sync, destroy });
})();
