(() => {
  "use strict";

  const stateBySelect = new WeakMap();
  const liveStates = new Set();
  let activeState = null;

  function visibleSelect(select) {
    return select instanceof HTMLSelectElement
      && !select.hidden
      && select.isConnected
      && select.getClientRects().length > 0;
  }

  function selectedLabel(select) {
    const option = select.options[select.selectedIndex];
    return String(option?.textContent || option?.label || option?.value || "Select...").trim() || "Select...";
  }

  function makeChevron() {
    const chevron = document.createElement("span");
    chevron.className = "mflDropdownChevron";
    chevron.setAttribute("aria-hidden", "true");
    return chevron;
  }

  function cleanupDetached() {
    for (const state of Array.from(liveStates)) {
      if (state.select.isConnected && state.wrapper.isConnected) continue;
      if (activeState === state) activeState = null;
      state.menu.remove();
      liveStates.delete(state);
    }
  }

  function syncState(state) {
    if (!state?.select?.isConnected) return;
    const { select, wrapper, trigger, label } = state;
    const hidden = select.hidden || select.closest("[hidden]") !== null;
    wrapper.hidden = hidden;
    trigger.disabled = Boolean(select.disabled);
    trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");
    label.textContent = selectedLabel(select);

    if (select.dataset.filterConnector !== undefined) wrapper.dataset.filterRole = "connector";
    else if (select.dataset.filterOperator !== undefined) wrapper.dataset.filterRole = "operator";
    else delete wrapper.dataset.filterRole;

    if (select.classList.contains("evaluationSummaryPositionSelect")) wrapper.dataset.mflInline = "true";
    else delete wrapper.dataset.mflInline;

    if ((hidden || select.disabled) && activeState === state) closeMenu(state, false);
    if (activeState === state) syncSelectedOption(state);
  }

  function syncSelectedOption(state) {
    const selectedIndex = state.select.selectedIndex;
    state.menu.querySelectorAll(".mflDropdownOption[data-option-index]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const selected = Number(button.dataset.optionIndex) === selectedIndex;
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function buildMenu(state) {
    const { select, menu } = state;
    menu.replaceChildren();
    let lastGroup = null;

    Array.from(select.options).forEach((option, optionIndex) => {
      if (option.hidden) return;
      const group = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
      if (group && group !== lastGroup) {
        const groupLabel = document.createElement("div");
        groupLabel.className = "mflDropdownGroupLabel";
        groupLabel.textContent = group.label;
        menu.appendChild(groupLabel);
      }
      lastGroup = group;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflDropdownOption";
      button.dataset.optionIndex = String(optionIndex);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", optionIndex === select.selectedIndex ? "true" : "false");
      button.disabled = Boolean(option.disabled || group?.disabled);
      button.textContent = String(option.textContent || option.label || option.value || "");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseOption(state, optionIndex);
      });
      menu.appendChild(button);
    });
  }

  function chooseOption(state, optionIndex) {
    const option = state.select.options[optionIndex];
    if (!option || option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled)) return;
    const changed = state.select.selectedIndex !== optionIndex;
    state.select.selectedIndex = optionIndex;
    syncState(state);
    closeMenu(state, true);
    if (changed) {
      state.select.dispatchEvent(new Event("input", { bubbles: true }));
      state.select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function positionMenu(state) {
    if (!state || state.menu.hidden || !state.trigger.isConnected) return;
    const rect = state.trigger.getBoundingClientRect();
    const padding = 8;
    const viewportWidth = Math.max(0, window.innerWidth - padding * 2);
    const width = Math.min(Math.max(rect.width, 120), viewportWidth);
    const left = Math.min(
      Math.max(padding, rect.left),
      Math.max(padding, window.innerWidth - width - padding),
    );

    state.menu.style.width = `${width}px`;
    state.menu.style.left = `${left}px`;
    state.menu.style.right = "auto";

    const maxMenuHeight = Math.min(320, Math.max(120, window.innerHeight - padding * 2));
    state.menu.style.maxHeight = `${maxMenuHeight}px`;
    const menuHeight = Math.min(state.menu.scrollHeight, maxMenuHeight);
    const roomBelow = window.innerHeight - rect.bottom - padding;
    const roomAbove = rect.top - padding;
    const opensUp = menuHeight > roomBelow && roomAbove > roomBelow;
    const top = opensUp
      ? Math.max(padding, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - padding, rect.bottom + 6);
    state.menu.style.top = `${Math.max(padding, top)}px`;
  }

  function optionButtons(state) {
    return Array.from(state.menu.querySelectorAll(".mflDropdownOption:not(:disabled)"))
      .filter((button) => button instanceof HTMLButtonElement);
  }

  function focusOption(state, direction) {
    const buttons = optionButtons(state);
    if (!buttons.length) return;
    const current = document.activeElement;
    let index = buttons.indexOf(current);
    if (index < 0) {
      index = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true");
    }

    if (direction === "first") index = 0;
    else if (direction === "last") index = buttons.length - 1;
    else if (direction > 0) index = Math.min(buttons.length - 1, Math.max(-1, index) + 1);
    else index = Math.max(0, index < 0 ? buttons.length - 1 : index - 1);

    buttons[Math.max(0, index)]?.focus();
  }

  function openMenu(state, keyboardDirection = 0) {
    if (!state || state.select.disabled || state.select.hidden) return;
    cleanupDetached();
    if (activeState && activeState !== state) closeMenu(activeState, false);
    syncState(state);
    buildMenu(state);
    state.menu.hidden = false;
    state.trigger.setAttribute("aria-expanded", "true");
    activeState = state;
    positionMenu(state);
    requestAnimationFrame(() => {
      positionMenu(state);
      if (keyboardDirection > 0) focusOption(state, 1);
      else if (keyboardDirection < 0) focusOption(state, -1);
    });
  }

  function closeMenu(state, restoreFocus) {
    if (!state) return;
    state.menu.hidden = true;
    state.trigger.setAttribute("aria-expanded", "false");
    if (activeState === state) activeState = null;
    if (restoreFocus && state.trigger.isConnected) state.trigger.focus();
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    const existing = stateBySelect.get(select);
    if (existing) {
      syncState(existing);
      return existing;
    }
    if (!visibleSelect(select)) return null;

    const rect = select.getBoundingClientRect();
    const wrapper = document.createElement("span");
    wrapper.className = "mflSelect";
    wrapper.style.width = `${Math.max(1, rect.width)}px`;
    wrapper.style.setProperty("--mfl-select-width", `${Math.max(1, rect.width)}px`);
    if (select.id) wrapper.dataset.mflSelectFor = select.id;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "mflSelectTrigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.className = "mflDropdownLabel";
    trigger.append(label, makeChevron());
    wrapper.appendChild(trigger);
    select.insertAdjacentElement("afterend", wrapper);

    const menu = document.createElement("div");
    menu.className = "mflDropdownMenu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    if (select.id) {
      menu.id = `${select.id}MflDropdown`;
      trigger.setAttribute("aria-controls", menu.id);
    }
    document.body.appendChild(menu);

    select.classList.add("mflDropdownNative");
    select.dataset.mflDropdownEnhanced = "true";
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const state = { select, wrapper, trigger, label, menu };
    stateBySelect.set(select, state);
    liveStates.add(state);

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeState === state) closeMenu(state, false);
      else openMenu(state, 0);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (activeState !== state) openMenu(state, event.key === "ArrowDown" ? 1 : -1);
        else focusOption(state, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (activeState === state) closeMenu(state, false);
        else openMenu(state, 0);
      } else if (event.key === "Escape" && activeState === state) {
        event.preventDefault();
        closeMenu(state, true);
      }
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusOption(state, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusOption(state, "first");
      } else if (event.key === "End") {
        event.preventDefault();
        focusOption(state, "last");
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(state, true);
      }
    });

    select.addEventListener("change", () => syncState(state));
    select.addEventListener("input", () => syncState(state));
    syncState(state);
    return state;
  }

  function enhanceVisible(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll("select:not(.mflDropdownNative)").forEach((select) => {
      if (visibleSelect(select)) enhanceSelect(select);
    });
    cleanupDetached();
  }

  function syncSelect(select) {
    const state = stateBySelect.get(select);
    if (state) syncState(state);
    else if (visibleSelect(select)) enhanceSelect(select);
  }

  document.addEventListener("pointerdown", (event) => {
    cleanupDetached();
    const target = event.target;

    if (activeState && target instanceof Node
      && !activeState.wrapper.contains(target)
      && !activeState.menu.contains(target)) {
      closeMenu(activeState, false);
    }

    const select = target instanceof Element ? target.closest("select:not(.mflDropdownNative)") : null;
    if (!(select instanceof HTMLSelectElement) || !visibleSelect(select)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const state = enhanceSelect(select);
    if (state) openMenu(state, 0);
  }, true);

  document.addEventListener("focusin", (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select || select.classList.contains("mflDropdownNative") || !visibleSelect(select)) return;
    const state = enhanceSelect(select);
    if (!state) return;
    requestAnimationFrame(() => state.trigger.focus());
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target instanceof HTMLSelectElement) syncSelect(event.target);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeState) closeMenu(activeState, true);
  }, true);

  window.addEventListener("resize", () => {
    if (activeState) positionMenu(activeState);
  }, { passive: true });

  window.addEventListener("scroll", () => {
    if (activeState) positionMenu(activeState);
  }, true);

  enhanceVisible(document);
  window.addEventListener("mfl:ready", () => enhanceVisible(document));

  window.__mflDropdowns = Object.freeze({
    enhanceSelect,
    enhanceVisible,
    syncSelect,
  });
})();
