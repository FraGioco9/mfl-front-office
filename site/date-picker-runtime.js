(() => {
  "use strict";

  const INPUT_SELECTOR = 'input.dateValue[type="text"]';
  const WEEKDAY_LABELS = Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  let picker = null;
  let activeInput = null;
  let viewYear = 0;
  let viewMonth = 0;
  let focusedIso = "";
  let positionFrame = 0;

  function localTodayDate() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  function parseIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
    return date;
  }

  function isoFromDate(date) {
    return [
      String(date.getUTCFullYear()).padStart(4, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }

  function sameIsoDate(a, b) {
    return String(a || "") === String(b || "");
  }

  function shiftDate(date, dayDelta) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + dayDelta);
    return next;
  }

  function normalizedMonthDate(year, month, day = 1) {
    return new Date(Date.UTC(year, month, day));
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }

  function dateForViewDay(year, month, preferredDay) {
    return normalizedMonthDate(year, month, Math.min(Math.max(1, preferredDay), daysInMonth(year, month)));
  }

  function setViewFromDate(date) {
    viewYear = date.getUTCFullYear();
    viewMonth = date.getUTCMonth();
  }

  function selectedDate() {
    return parseIsoDate(activeInput?.value) || null;
  }

  function todayIso() {
    return isoFromDate(localTodayDate());
  }

  function schedulePosition() {
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      positionPicker();
    });
  }

  function positionPicker() {
    if (!(picker instanceof HTMLElement) || picker.hidden || !(activeInput instanceof HTMLInputElement) || !activeInput.isConnected) return false;
    const inputRect = activeInput.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    const edgeGap = 8;
    const popupGap = 8;
    let left = inputRect.left;
    left = Math.max(edgeGap, Math.min(left, window.innerWidth - pickerRect.width - edgeGap));
    let top = inputRect.bottom + popupGap;
    if (top + pickerRect.height > window.innerHeight - edgeGap) {
      top = Math.max(edgeGap, inputRect.top - pickerRect.height - popupGap);
    }
    picker.style.left = `${Math.round(left)}px`;
    picker.style.top = `${Math.round(top)}px`;
    return true;
  }

  function monthLabel() {
    return MONTH_LABEL_FORMATTER.format(normalizedMonthDate(viewYear, viewMonth));
  }

  function monthGridStart() {
    const first = normalizedMonthDate(viewYear, viewMonth, 1);
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    return shiftDate(first, -mondayOffset);
  }

  function renderWeekdays(host) {
    if (host.childElementCount === WEEKDAY_LABELS.length) return;
    const fragment = document.createDocumentFragment();
    WEEKDAY_LABELS.forEach((label) => {
      const item = document.createElement("span");
      item.className = "mflDatePickerWeekday";
      item.textContent = label;
      item.setAttribute("aria-hidden", "true");
      fragment.appendChild(item);
    });
    host.replaceChildren(fragment);
  }

  function renderDays(host) {
    const selectedIso = selectedDate() ? isoFromDate(selectedDate()) : "";
    const currentTodayIso = todayIso();
    const gridStart = monthGridStart();
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 42; index += 1) {
      const date = shiftDate(gridStart, index);
      const iso = isoFromDate(date);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflDatePickerDay";
      button.dataset.date = iso;
      button.textContent = String(date.getUTCDate());
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", DAY_LABEL_FORMATTER.format(date));
      button.setAttribute("aria-selected", sameIsoDate(iso, selectedIso) ? "true" : "false");
      button.classList.toggle("isOutsideMonth", date.getUTCMonth() !== viewMonth);
      button.classList.toggle("isToday", sameIsoDate(iso, currentTodayIso));
      button.classList.toggle("isSelected", sameIsoDate(iso, selectedIso));
      button.tabIndex = sameIsoDate(iso, focusedIso) ? 0 : -1;
      fragment.appendChild(button);
    }

    host.replaceChildren(fragment);
  }

  function renderPicker() {
    if (!(picker instanceof HTMLElement)) return;
    const label = picker.querySelector("[data-mfl-date-picker-month]");
    const weekdays = picker.querySelector("[data-mfl-date-picker-weekdays]");
    const days = picker.querySelector("[data-mfl-date-picker-days]");
    if (label) label.textContent = monthLabel();
    if (weekdays) renderWeekdays(weekdays);
    if (days) renderDays(days);
    schedulePosition();
  }

  function commitDate(iso) {
    if (!(activeInput instanceof HTMLInputElement)) return false;
    activeInput.value = iso;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new Event("change", { bubbles: true }));
    closePicker({ restoreFocus: true });
    return true;
  }

  function moveFocusedDate(dayDelta) {
    const base = parseIsoDate(focusedIso) || selectedDate() || localTodayDate();
    const next = shiftDate(base, dayDelta);
    focusedIso = isoFromDate(next);
    setViewFromDate(next);
    renderPicker();
    requestAnimationFrame(() => picker?.querySelector(`[data-date="${focusedIso}"]`)?.focus({ preventScroll: true }));
  }

  function moveFocusedMonth(monthDelta) {
    const base = parseIsoDate(focusedIso) || selectedDate() || localTodayDate();
    const target = dateForViewDay(base.getUTCFullYear(), base.getUTCMonth() + monthDelta, base.getUTCDate());
    focusedIso = isoFromDate(target);
    setViewFromDate(target);
    renderPicker();
    requestAnimationFrame(() => picker?.querySelector(`[data-date="${focusedIso}"]`)?.focus({ preventScroll: true }));
  }

  function moveFocusedToWeekEdge(toEnd) {
    const base = parseIsoDate(focusedIso) || selectedDate() || localTodayDate();
    const mondayOffset = (base.getUTCDay() + 6) % 7;
    moveFocusedDate(toEnd ? 6 - mondayOffset : -mondayOffset);
  }

  function handlePickerKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker({ restoreFocus: true });
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocusedDate(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocusedDate(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusedDate(-7);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocusedDate(7);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      moveFocusedMonth(-1);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      moveFocusedMonth(1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveFocusedToWeekEdge(false);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveFocusedToWeekEdge(true);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && document.activeElement instanceof HTMLButtonElement && document.activeElement.dataset.date) {
      event.preventDefault();
      commitDate(document.activeElement.dataset.date);
    }
  }

  function ensurePicker() {
    if (picker instanceof HTMLElement && picker.isConnected) return picker;

    const element = document.createElement("div");
    element.className = "mflDatePicker";
    element.dataset.mflDatePickerPopover = "true";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-label", "Choose date");
    element.hidden = true;
    element.innerHTML = `
      <div class="mflDatePickerHeader">
        <button class="mflDatePickerNav" type="button" data-mfl-date-picker-action="previous" aria-label="Previous month">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <strong class="mflDatePickerMonth" data-mfl-date-picker-month aria-live="polite"></strong>
        <button class="mflDatePickerNav" type="button" data-mfl-date-picker-action="next" aria-label="Next month">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
        </button>
      </div>
      <div class="mflDatePickerWeekdays" data-mfl-date-picker-weekdays></div>
      <div class="mflDatePickerDays" data-mfl-date-picker-days role="grid"></div>
      <button class="mflDatePickerToday" type="button" data-mfl-date-picker-action="today">Today</button>
    `;

    element.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const day = event.target.closest("[data-date]");
      if (day instanceof HTMLButtonElement) {
        commitDate(day.dataset.date || "");
        return;
      }
      const actionButton = event.target.closest("[data-mfl-date-picker-action]");
      if (!(actionButton instanceof HTMLButtonElement)) return;
      const action = actionButton.dataset.mflDatePickerAction;
      if (action === "previous") {
        const base = dateForViewDay(viewYear, viewMonth - 1, 1);
        setViewFromDate(base);
        focusedIso = isoFromDate(base);
        renderPicker();
      } else if (action === "next") {
        const base = dateForViewDay(viewYear, viewMonth + 1, 1);
        setViewFromDate(base);
        focusedIso = isoFromDate(base);
        renderPicker();
      } else if (action === "today") {
        commitDate(todayIso());
      }
    });
    element.addEventListener("keydown", handlePickerKeydown);
    document.body.appendChild(element);
    picker = element;
    return element;
  }

  function openPicker(input, { focusDay = false } = {}) {
    if (!(input instanceof HTMLInputElement) || !input.matches(INPUT_SELECTOR)) return false;
    const element = ensurePicker();
    if (activeInput instanceof HTMLInputElement && activeInput !== input) {
      activeInput.setAttribute("aria-expanded", "false");
    }
    activeInput = input;
    const initialDate = parseIsoDate(input.value) || localTodayDate();
    setViewFromDate(initialDate);
    focusedIso = isoFromDate(initialDate);
    input.setAttribute("aria-expanded", "true");
    element.hidden = false;
    renderPicker();
    schedulePosition();
    if (focusDay) {
      requestAnimationFrame(() => element.querySelector(`[data-date="${focusedIso}"]`)?.focus({ preventScroll: true }));
    }
    return true;
  }

  function closePicker({ restoreFocus = false } = {}) {
    if (!(picker instanceof HTMLElement) || picker.hidden) return false;
    picker.hidden = true;
    if (activeInput instanceof HTMLInputElement) {
      activeInput.setAttribute("aria-expanded", "false");
      if (restoreFocus && activeInput.isConnected) activeInput.focus({ preventScroll: true });
    }
    activeInput = null;
    focusedIso = "";
    return true;
  }

  function enhanceInput(input) {
    if (!(input instanceof HTMLInputElement) || !input.matches(INPUT_SELECTOR) || input.dataset.mflDatePicker === "true") return false;
    input.dataset.mflDatePicker = "true";
    input.setAttribute("aria-haspopup", "dialog");
    input.setAttribute("aria-expanded", "false");
    input.autocomplete = "off";

    input.addEventListener("focus", () => openPicker(input));
    input.addEventListener("click", () => openPicker(input));
    input.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      event.preventDefault();
      input.focus({ preventScroll: true });
      openPicker(input);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeInput === input) {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key === "F4" || (event.altKey && event.key === "ArrowDown")) {
        event.preventDefault();
        openPicker(input, { focusDay: true });
      }
    });
    input.addEventListener("input", () => {
      if (activeInput !== input) return;
      const parsed = parseIsoDate(input.value);
      if (!parsed) return;
      setViewFromDate(parsed);
      focusedIso = isoFromDate(parsed);
      renderPicker();
    });
    return true;
  }

  function enhance(root = document) {
    if (root instanceof HTMLInputElement) enhanceInput(root);
    root.querySelectorAll?.(INPUT_SELECTOR).forEach(enhanceInput);
    if (activeInput instanceof HTMLInputElement && !activeInput.isConnected) closePicker();
  }

  document.addEventListener("pointerdown", (event) => {
    if (!(picker instanceof HTMLElement) || picker.hidden || !(event.target instanceof Node)) return;
    if (picker.contains(event.target) || activeInput?.contains(event.target)) return;
    closePicker();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !(picker instanceof HTMLElement) || picker.hidden) return;
    event.preventDefault();
    closePicker({ restoreFocus: true });
  }, true);

  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, true);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof Element) enhance(node);
    }));
    if (activeInput instanceof HTMLInputElement && !activeInput.isConnected) closePicker();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  enhance();

  window.__mflDatePickerRuntime = Object.freeze({
    sync: () => enhance(),
    close: () => closePicker(),
  });
})();
