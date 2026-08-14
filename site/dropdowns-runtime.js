(() => {
  "use strict";

  const stateBySelect = new WeakMap();
  const liveStates = new Set();
  let activeState = null;

  function visibleSelect(select) {
    return select instanceof HTMLSelectElement
      && select.isConnected
      && !select.hidden
      && select.getClientRects().length > 0;
  }

  function createState(select) {
    const menu = document.createElement("div");
    menu.className = "mflDropdownMenu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    if (select.id) {
      menu.id = `${select.id}MflDropdown`;
      select.setAttribute("aria-controls", menu.id);
    }
    document.body.appendChild(menu);

    const state = { select, menu };
    stateBySelect.set(select, state);
    liveStates.add(state);

    select.dataset.mflDropdownEnhanced = "true";
    select.setAttribute("aria-haspopup", "listbox");
    select.setAttribute("aria-expanded", "false");
    return state;
  }

  function ensureState(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    return stateBySelect.get(select) || createState(select);
  }

  function cleanupDetached() {
    for (const state of Array.from(liveStates)) {
      if (state.select.isConnected) continue;
      if (activeState === state) activeState = null;
      state.menu.remove();
      liveStates.delete(state);
    }
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
        const label = document.createElement("div");
        label.className = "mflDropdownGroupLabel";
        label.textContent = group.label;
        menu.appendChild(label);
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
    if (!option || option.disabled) return;
    if (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) return;

    const changed = state.select.selectedIndex !== optionIndex;
    state.select.selectedIndex = optionIndex;
    closeMenu(state, true);
    if (changed) {
      state.select.dispatchEvent(new Event("input", { bubbles: true }));
      state.select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function positionMenu(state) {
    if (!state || state.menu.hidden || !state.select.isConnected) return;
    const rect = state.select.getBoundingClientRect();
    const viewportPadding = 8;
    const maxWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const width = Math.min(Math.max(rect.width, 120), maxWidth);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );

    state.menu.style.width = `${width}px`;
    state.menu.style.left = `${left}px`;
    state.menu.style.right = "auto";

    const maxHeight = Math.min(320, Math.max(120, window.innerHeight - viewportPadding * 2));
    state.menu.style.maxHeight = `${maxHeight}px`;
    const menuHeight = Math.min(state.menu.scrollHeight, maxHeight);
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const roomAbove = rect.top - viewportPadding;
    const openAbove = menuHeight > roomBelow && roomAbove > roomBelow;
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + 6);
    state.menu.style.top = `${Math.max(viewportPadding, top)}px`;
  }

  function enabledOptions(state) {
    return Array.from(state.menu.querySelectorAll(".mflDropdownOption:not(:disabled)"))
      .filter((button) => button instanceof HTMLButtonElement);
  }

  function focusOption(state, direction) {
    const options = enabledOptions(state);
    if (!options.length) return;
    const focused = document.activeElement;
    let index = options.indexOf(focused);
    if (index < 0) {
      index = options.findIndex((button) => button.getAttribute("aria-selected") === "true");
    }

    if (direction === "first") index = 0;
    else if (direction === "last") index = options.length - 1;
    else if (direction > 0) index = Math.min(options.length - 1, Math.max(-1, index) + 1);
    else index = Math.max(0, index < 0 ? options.length - 1 : index - 1);

    options[Math.max(0, index)]?.focus();
  }

  function openMenu(state, keyboardDirection = 0) {
    if (!state || !visibleSelect(state.select) || state.select.disabled) return;
    cleanupDetached();
    if (activeState && activeState !== state) closeMenu(activeState, false);

    buildMenu(state);
    state.menu.hidden = false;
    state.select.setAttribute("aria-expanded", "true");
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
    state.select.setAttribute("aria-expanded", "false");
    if (activeState === state) activeState = null;
    if (restoreFocus && state.select.isConnected) {
      try {
        state.select.focus({ preventScroll: true });
      } catch {
        state.select.focus();
      }
    }
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return null;
    return ensureState(select);
  }

  function enhanceVisible(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll("select").forEach((select) => {
      if (visibleSelect(select)) ensureState(select);
    });
    cleanupDetached();
  }

  function syncSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    const state = ensureState(select);
    if (!state) return;
    if (!visibleSelect(select) || select.disabled) {
      if (activeState === state) closeMenu(state, false);
      return;
    }
    if (activeState === state) {
      buildMenu(state);
      syncSelectedOption(state);
      positionMenu(state);
    }
  }

  function selectFromEvent(event) {
    const target = event.target;
    return target instanceof Element ? target.closest("select") : null;
  }

  document.addEventListener("pointerdown", (event) => {
    cleanupDetached();
    const target = event.target;

    if (activeState && target instanceof Node && !activeState.menu.contains(target) && target !== activeState.select) {
      closeMenu(activeState, false);
    }

    const select = selectFromEvent(event);
    if (!(select instanceof HTMLSelectElement) || !visibleSelect(select) || select.disabled) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const state = ensureState(select);
    try {
      select.focus({ preventScroll: true });
    } catch {
      select.focus();
    }
    if (activeState === state) closeMenu(state, false);
    else openMenu(state, 0);
  }, true);

  document.addEventListener("mousedown", (event) => {
    const select = selectFromEvent(event);
    if (!(select instanceof HTMLSelectElement) || !visibleSelect(select) || select.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("click", (event) => {
    const select = selectFromEvent(event);
    if (!(select instanceof HTMLSelectElement) || !visibleSelect(select) || select.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeState) {
      event.preventDefault();
      closeMenu(activeState, true);
      return;
    }

    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select || !visibleSelect(select) || select.disabled) return;
    if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const state = ensureState(select);
    if (activeState !== state) {
      openMenu(state, event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0);
    } else if (event.key === "ArrowDown") {
      focusOption(state, 1);
    } else if (event.key === "ArrowUp") {
      focusOption(state, -1);
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!activeState || !activeState.menu.contains(event.target)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(activeState, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(activeState, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(activeState, "first");
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(activeState, "last");
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target instanceof HTMLSelectElement) syncSelect(event.target);
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