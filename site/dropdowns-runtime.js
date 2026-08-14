(() => {
  "use strict";

  const selectStates = new Set();
  const selectStateByElement = new WeakMap();
  let activeSelectState = null;
  let syncQueued = false;

  function makeChevron() {
    const chevron = document.createElement("span");
    chevron.className = "mflDropdownChevron";
    chevron.setAttribute("aria-hidden", "true");
    return chevron;
  }

  function normalizeAccountDropdown() {
    const menu = document.getElementById("accountDropdown");
    const trigger = document.getElementById("accountButton");
    const email = document.getElementById("accountEmail");
    const settings = document.getElementById("accountSettingsButton");
    const wallet = document.getElementById("linkWalletButton");

    if (menu instanceof HTMLElement) {
      menu.className = "mflDropdownMenu mflAccountDropdown";
    }
    if (trigger instanceof HTMLButtonElement) {
      trigger.classList.add("mflDropdownTrigger");
      if (!trigger.querySelector(":scope > .mflDropdownChevron")) trigger.appendChild(makeChevron());
    }
    if (email instanceof HTMLButtonElement) {
      email.className = "mflDropdownItem accountUserButton";
    }
    if (settings instanceof HTMLButtonElement) {
      settings.className = "mflDropdownItem accountSettingsButton";
    }
    if (wallet instanceof HTMLButtonElement) {
      const optedOut = wallet.classList.contains("walletOptOut");
      wallet.className = `mflDropdownItem${optedOut ? " walletOptOut" : ""}`;
    }
  }

  function normalizeWatchlistDropdown() {
    const trigger = document.getElementById("watchlistButton");
    const triggerText = document.getElementById("watchlistButtonText");
    const menu = document.getElementById("watchlistDropdown");

    if (trigger instanceof HTMLButtonElement) {
      trigger.className = "mflDropdownTrigger mflWatchlistTrigger";
      Array.from(trigger.children).forEach((child) => {
        if (child !== triggerText && !child.classList.contains("mflDropdownChevron")) child.remove();
      });
      if (!trigger.querySelector(":scope > .mflDropdownChevron")) trigger.appendChild(makeChevron());
    }

    if (!(menu instanceof HTMLElement)) return;
    menu.className = "mflDropdownMenu mflWatchlistDropdown";

    Array.from(menu.children).forEach((child) => {
      if (child instanceof HTMLDivElement && child.dataset.watchlistId) {
        const active = child.classList.contains("active");
        child.className = `mflDropdownItem mflWatchlistItem${active ? " active" : ""}`;

        const nameButton = child.querySelector(":scope > button");
        if (nameButton instanceof HTMLButtonElement) {
          nameButton.className = "mflWatchlistName";
          const spans = Array.from(nameButton.querySelectorAll(":scope > span"));
          if (spans[0] instanceof HTMLElement) spans[0].className = "mflWatchlistNameText";
          if (spans[1] instanceof HTMLElement) spans[1].className = "mflDropdownMeta";
        }

        const actions = child.querySelector(":scope > span");
        if (actions instanceof HTMLElement) {
          actions.className = "mflDropdownActions";
          Array.from(actions.querySelectorAll(":scope > button")).forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            const action = String(button.getAttribute("aria-label") || "").toLowerCase();
            button.className = action.includes("delete")
              ? "mflDropdownAction mflDropdownDelete"
              : "mflDropdownAction mflDropdownRename";
          });
        }
        return;
      }

      if (child instanceof HTMLButtonElement) {
        child.className = "mflDropdownItem mflDropdownAdd";
        return;
      }

      if (child instanceof HTMLElement) {
        child.className = "mflDropdownSeparator";
      }
    });
  }

  function optionSignature(select) {
    return Array.from(select.options).map((option) => [
      option.value,
      option.textContent || "",
      option.disabled ? "1" : "0",
      option.hidden ? "1" : "0",
    ].join("\u0001")).join("\u0002");
  }

  function selectedLabel(select) {
    const option = select.options[select.selectedIndex];
    return String(option?.textContent || option?.label || "Select...").trim() || "Select...";
  }

  function applySelectContext(state) {
    const { select, wrapper } = state;
    wrapper.toggleAttribute("hidden", Boolean(select.hidden));
    wrapper.dataset.mflConnectorHidden = select.classList.contains("connectorSelect") && select.disabled ? "true" : "false";
    wrapper.dataset.mflInline = select.classList.contains("evaluationSummaryPositionSelect") ? "true" : "false";

    const currentWidth = select.isConnected && !select.hidden ? select.getBoundingClientRect().width : 0;
    if (Number.isFinite(currentWidth) && currentWidth > 1) {
      wrapper.style.setProperty("--mfl-select-measured-width", `${currentWidth}px`);
      if (select.id === "pageSizeSelect") wrapper.style.width = `${currentWidth}px`;
    }
  }

  function syncSelectState(state) {
    const { select, trigger, label } = state;
    if (!select.isConnected) return;

    applySelectContext(state);
    trigger.disabled = Boolean(select.disabled);
    trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");
    label.textContent = selectedLabel(select);

    const signature = optionSignature(select);
    if (signature !== state.optionSignature) {
      state.optionSignature = signature;
      if (activeSelectState === state) buildSelectMenu(state);
    } else if (activeSelectState === state) {
      syncSelectedOption(state);
    }

    if ((select.hidden || select.disabled) && activeSelectState === state) closeSelectMenu(state, false);
  }

  function syncSelectedOption(state) {
    const selectedIndex = state.select.selectedIndex;
    state.menu.querySelectorAll(".mflSelectOption[data-option-index]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const selected = Number(button.dataset.optionIndex) === selectedIndex;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function chooseOption(state, optionIndex) {
    const { select } = state;
    const option = select.options[optionIndex];
    if (!option || option.disabled) return;
    const changed = select.selectedIndex !== optionIndex;
    select.selectedIndex = optionIndex;
    syncSelectState(state);
    closeSelectMenu(state, true);
    if (changed) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function buildSelectMenu(state) {
    const { select, menu } = state;
    menu.replaceChildren();
    state.optionSignature = optionSignature(select);

    let optionIndex = 0;
    Array.from(select.children).forEach((child) => {
      if (child instanceof HTMLOptGroupElement) {
        const groupLabel = document.createElement("div");
        groupLabel.className = "mflSelectGroupLabel";
        groupLabel.textContent = child.label;
        menu.appendChild(groupLabel);
        Array.from(child.children).forEach((option) => {
          if (!(option instanceof HTMLOptionElement)) return;
          appendOptionButton(state, option, optionIndex, child.disabled);
          optionIndex += 1;
        });
        return;
      }
      if (child instanceof HTMLOptionElement) {
        appendOptionButton(state, child, optionIndex, false);
        optionIndex += 1;
      }
    });

    syncSelectedOption(state);
  }

  function appendOptionButton(state, option, optionIndex, groupDisabled) {
    if (option.hidden) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mflDropdownItem mflSelectOption";
    button.dataset.optionIndex = String(optionIndex);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", option.selected ? "true" : "false");
    button.disabled = Boolean(option.disabled || groupDisabled);

    const label = document.createElement("span");
    label.className = "mflSelectOptionLabel";
    label.textContent = option.textContent || option.label || option.value;
    button.appendChild(label);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chooseOption(state, optionIndex);
    });
    state.menu.appendChild(button);
  }

  function positionSelectMenu(state) {
    const { trigger, menu } = state;
    if (menu.hidden || !trigger.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.min(Math.max(rect.width, 80), window.innerWidth - viewportPadding * 2);
    const left = Math.min(Math.max(rect.left, viewportPadding), Math.max(viewportPadding, window.innerWidth - width - viewportPadding));

    menu.style.width = `${width}px`;
    menu.style.left = `${left}px`;
    menu.style.right = "auto";

    const menuHeight = Math.min(menu.scrollHeight || 0, Math.max(0, window.innerHeight - viewportPadding * 2));
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const roomAbove = rect.top - viewportPadding;
    const openAbove = menuHeight > roomBelow && roomAbove > roomBelow;
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + 8);
    menu.style.top = `${Math.max(viewportPadding, top)}px`;
  }

  function enabledOptionButtons(state) {
    return Array.from(state.menu.querySelectorAll(".mflSelectOption:not(:disabled)"))
      .filter((button) => button instanceof HTMLButtonElement);
  }

  function focusRelativeOption(state, direction) {
    const buttons = enabledOptionButtons(state);
    if (!buttons.length) return;
    const active = document.activeElement;
    let index = buttons.indexOf(active);
    if (index < 0) {
      index = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true");
    }
    if (direction === "first") index = 0;
    else if (direction === "last") index = buttons.length - 1;
    else if (direction === 1) index = Math.min(buttons.length - 1, Math.max(-1, index) + 1);
    else if (direction === -1) index = Math.max(0, index < 0 ? buttons.length - 1 : index - 1);
    buttons[Math.max(0, index)]?.focus();
  }

  function openSelectMenu(state, focusDirection = 0) {
    if (activeSelectState && activeSelectState !== state) closeSelectMenu(activeSelectState, false);
    syncSelectState(state);
    if (state.select.hidden || state.select.disabled) return;
    buildSelectMenu(state);
    state.menu.hidden = false;
    state.trigger.setAttribute("aria-expanded", "true");
    activeSelectState = state;
    positionSelectMenu(state);
    requestAnimationFrame(() => {
      positionSelectMenu(state);
      if (focusDirection === 1) focusRelativeOption(state, 1);
      else if (focusDirection === -1) focusRelativeOption(state, -1);
    });
  }

  function closeSelectMenu(state, restoreFocus) {
    if (!state) return;
    state.menu.hidden = true;
    state.trigger.setAttribute("aria-expanded", "false");
    if (activeSelectState === state) activeSelectState = null;
    if (restoreFocus && state.trigger.isConnected) state.trigger.focus();
  }

  function handleTriggerKeydown(state, event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (activeSelectState !== state) openSelectMenu(state, event.key === "ArrowDown" ? 1 : -1);
      else focusRelativeOption(state, event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && activeSelectState === state) {
      event.preventDefault();
      focusRelativeOption(state, "first");
      return;
    }
    if (event.key === "End" && activeSelectState === state) {
      event.preventDefault();
      focusRelativeOption(state, "last");
      return;
    }
    if (event.key === "Escape" && activeSelectState === state) {
      event.preventDefault();
      closeSelectMenu(state, true);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && activeSelectState !== state) {
      event.preventDefault();
      openSelectMenu(state, 0);
    }
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    if (selectStateByElement.has(select)) {
      syncSelectState(selectStateByElement.get(select));
      return;
    }

    const rect = select.hidden ? null : select.getBoundingClientRect();
    const wrapper = document.createElement("span");
    wrapper.className = "mflSelect";
    if (select.id) wrapper.dataset.mflSelectFor = select.id;
    if (rect && rect.width > 1) wrapper.style.setProperty("--mfl-select-measured-width", `${rect.width}px`);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "mflDropdownTrigger mflSelectTrigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.className = "mflDropdownLabel";
    trigger.append(label, makeChevron());

    const menu = document.createElement("div");
    menu.className = "mflDropdownMenu mflSelectMenu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    if (select.id) {
      menu.id = `${select.id}DropdownMenu`;
      trigger.setAttribute("aria-controls", menu.id);
    }

    select.insertAdjacentElement("afterend", wrapper);
    wrapper.appendChild(trigger);
    document.body.appendChild(menu);

    select.classList.add("mflNativeSelect");
    select.dataset.mflDropdownEnhanced = "true";
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const state = { select, wrapper, trigger, label, menu, optionSignature: "" };
    selectStates.add(state);
    selectStateByElement.set(select, state);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeSelectState === state) closeSelectMenu(state, false);
      else openSelectMenu(state, 0);
    });
    trigger.addEventListener("keydown", (event) => handleTriggerKeydown(state, event));
    menu.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusRelativeOption(state, 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusRelativeOption(state, -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusRelativeOption(state, "first");
      } else if (event.key === "End") {
        event.preventDefault();
        focusRelativeOption(state, "last");
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeSelectMenu(state, true);
      }
    });
    select.addEventListener("change", () => {
      syncSelectState(state);
      if (activeSelectState === state) buildSelectMenu(state);
    });
    select.addEventListener("input", () => syncSelectState(state));

    syncSelectState(state);
  }

  function cleanupDetachedSelects() {
    Array.from(selectStates).forEach((state) => {
      if (state.select.isConnected) return;
      if (activeSelectState === state) closeSelectMenu(state, false);
      state.wrapper.remove();
      state.menu.remove();
      selectStates.delete(state);
    });
  }

  function syncAll() {
    cleanupDetachedSelects();
    normalizeAccountDropdown();
    normalizeWatchlistDropdown();
    document.querySelectorAll("select").forEach((select) => enhanceSelect(select));
    Array.from(selectStates).forEach((state) => syncSelectState(state));
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      syncAll();
    });
  }

  document.addEventListener("pointerdown", (event) => {
    const state = activeSelectState;
    if (!state) return;
    const target = event.target;
    if (target instanceof Node && (state.wrapper.contains(target) || state.menu.contains(target))) return;
    closeSelectMenu(state, false);
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target instanceof HTMLSelectElement) queueSync();
  }, true);

  window.addEventListener("resize", () => {
    queueSync();
    if (activeSelectState) positionSelectMenu(activeSelectState);
  }, { passive: true });
  window.addEventListener("scroll", () => {
    if (activeSelectState) positionSelectMenu(activeSelectState);
  }, true);

  const observer = new MutationObserver(queueSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "disabled"],
  });

  syncAll();
  window.addEventListener("mfl:ready", syncAll);
  window.__mflDropdownRuntime = Object.freeze({ sync: syncAll });
})();
