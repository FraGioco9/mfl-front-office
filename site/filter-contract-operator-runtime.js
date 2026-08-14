(() => {
  "use strict";

  const CONTRACT_COLUMN = "contract_status";

  function syncExistingContractOperators() {
    document.querySelectorAll(`.filterRule[data-filter-column="${CONTRACT_COLUMN}"] select[data-filter-operator]`).forEach((select) => {
      if (!(select instanceof HTMLSelectElement)) return;
      const selected = select.value === "!=" ? "!=" : "=";
      select.hidden = false;
      select.replaceChildren(
        new Option("is", "="),
        new Option("is not", "!="),
      );
      select.value = selected;
    });
  }

  function installCoreBridge() {
    try {
      const installed = Boolean(window.eval(`(() => {
        if (typeof buildOperatorSelect !== "function" || typeof ruleMatches !== "function") return false;
        if (typeof contractStatusFilterColumn === "undefined") return false;

        if (!buildOperatorSelect.__mflContractIsNot) {
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
          Object.defineProperty(contractAwareBuildOperatorSelect, "__mflContractIsNot", { value: true });
          buildOperatorSelect = contractAwareBuildOperatorSelect;
        }

        if (!ruleMatches.__mflContractIsNot) {
          const originalRuleMatches = ruleMatches;
          const contractAwareRuleMatches = function(row, rule) {
            if (rule?.column === contractStatusFilterColumn && rule.operator === "!=") {
              return !originalRuleMatches(row, { ...rule, operator: "=" });
            }
            return originalRuleMatches(row, rule);
          };
          Object.defineProperty(contractAwareRuleMatches, "__mflContractIsNot", { value: true });
          ruleMatches = contractAwareRuleMatches;
        }

        return true;
      })();`));
      if (installed) syncExistingContractOperators();
      return installed;
    } catch (error) {
      console.warn("Could not install Contracts filter operators.", error);
      return false;
    }
  }

  installCoreBridge();
  window.addEventListener("mfl:ready", () => {
    installCoreBridge();
    syncExistingContractOperators();
  });

  const observer = new MutationObserver(() => syncExistingContractOperators());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
