(() => {
  "use strict";

  const SOURCE_SELECTOR = 'input.dateValue[type="date"][data-filter-value="true"]';
  const DISPLAY_SELECTOR = 'input[data-mfl-date-display="true"]';
  const WEEKDAY_LABELS = Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
  const MONTH_NAME_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long" });
  const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const MONTH_LABELS = Object.freeze(Array.from({ length: 12 }, (_, month) => (
    MONTH_NAME_FORMATTER.format(new Date(2024, month, 1))
  )));

  let picker = null;
  let activeControl = null;
  let visibleMonth = startOfMonth(new Date());
  let calendarView = "days";
  let positionFrame = 0;

  function validDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function dateFromIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return validDate(date)
      && date.getFullYear() === Number(match[1])
      && date.getMonth() === Number(match[2]) - 1
      && date.getDate() === Number(match[3])
      ? date
      : null;
  }

  function isoFromDate(date) {
    return [
      String(date.getFullYear()).padStart(4, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addDays(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  }

  function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function calendarDays(month) {
    const first = startOfMonth(month);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -mondayOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }

  function dateFormat(source) {
    return source?.dataset.mflDateFormat === "MDY" ? "MDY" : "DMY";
  }

  function datePlaceholder(source) {
    return dateFormat(source) === "MDY" ? "MM/DD/YYYY" : "DD/MM/YYYY";
  }

  function displayDateFromIso(value, source) {
    const date = dateFromIso(value);
    if (!date) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).padStart(4, "0");
    return dateFormat(source) === "MDY"
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
  }

  function maximumDay(month, yearText) {
    const monthNumber = Number(month);
    const yearNumber = yearText.length === 4 ? Number(yearText) : null;
    if (monthNumber === 2) {
      if (yearNumber === null) return 29;
      const leapYear = yearNumber % 4 === 0 && (yearNumber % 100 !== 0 || yearNumber % 400 === 0);
      return leapYear ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(monthNumber) ? 30 : 31;
  }

  function clampTwoDigits(value, minimum, maximum) {
    if (value.length !== 2) return value;
    return String(Math.min(maximum, Math.max(minimum, Number(value)))).padStart(2, "0");
  }

  function formatTypedDate(value, source) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    const first = digits.slice(0, 2);
    const second = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    const mdy = dateFormat(source) === "MDY";
    const rawMonth = mdy ? first : second;
    const rawDay = mdy ? second : first;
    const month = clampTwoDigits(rawMonth, 1, 12);
    const day = clampTwoDigits(rawDay, 1, month.length === 2 ? maximumDay(month, year) : 31);
    const leading = mdy ? month : day;
    const trailing = mdy ? day : month;

    if (digits.length <= 2) return leading;
    if (digits.length <= 4) return `${leading}/${trailing}`;
    return `${leading}/${trailing}/${year}`;
  }

  function isoFromDisplayDate(value, source) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 8) return "";
    const mdy = dateFormat(source) === "MDY";
    const monthText = mdy ? digits.slice(0, 2) : digits.slice(2, 4);
    const dayText = mdy ? digits.slice(2, 4) : digits.slice(0, 2);
    const yearText = digits.slice(4, 8);
    const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
    return validDate(date)
      && String(date.getDate()).padStart(2, "0") === dayText
      && String(date.getMonth() + 1).padStart(2, "0") === monthText
      && String(date.getFullYear()).padStart(4, "0") === yearText
      ? isoFromDate(date)
      : "";
  }

  function nativeSetInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
  }

  function dispatchSourceChange(source, value) {
    source.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertReplacementText",
      data: value || null,
    }));
    source.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function controlFromSource(source) {
    if (!(source instanceof HTMLInputElement) || !source.matches(SOURCE_SELECTOR)) return null;
    const host = source.closest(".mflDateControl");
    const display = host?.querySelector(DISPLAY_SELECTOR);
    return host instanceof HTMLElement && display instanceof HTMLInputElement
      ? { source, display, host }
      : null;
  }

  function controlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const host = target.closest(".mflDateControl");
    const source = host?.querySelector(SOURCE_SELECTOR);
    return source instanceof HTMLInputElement ? controlFromSource(source) : null;
  }

  function syncDisplay(control) {
    control.display.placeholder = datePlaceholder(control.source);
    control.display.disabled = control.source.disabled;
    control.display.readOnly = control.source.readOnly;
    if (document.activeElement !== control.display || control.display.dataset.mflDateDirty !== "true") {
      nativeSetInputValue(control.display, displayDateFromIso(control.source.value, control.source));
      delete control.display.dataset.mflDateDirty;
    }
  }

  function rememberBaseline(control) {
    if (control.display.dataset.mflDateBaseline === undefined) {
      control.display.dataset.mflDateBaseline = control.source.value;
    }
  }

  function restoreBaseline(control) {
    const baseline = control.display.dataset.mflDateBaseline;
    if (baseline === undefined) {
      syncDisplay(control);
      return;
    }
    const changed = control.source.value !== baseline;
    nativeSetInputValue(control.source, baseline);
    nativeSetInputValue(control.display, displayDateFromIso(baseline, control.source));
    control.display.removeAttribute("aria-invalid");
    delete control.display.dataset.mflDateDirty;
    delete control.display.dataset.mflDateBaseline;
    if (changed) dispatchSourceChange(control.source, baseline);
  }

  function commitDisplayedDate(control, revertIncomplete = true) {
    const value = control.display.value.trim();
    const iso = value ? isoFromDisplayDate(value, control.source) : "";
    const outsideRange = Boolean(
      iso && ((control.source.min && iso < control.source.min)
        || (control.source.max && iso > control.source.max)),
    );
    if ((value && !iso) || outsideRange) {
      if (revertIncomplete) syncDisplay(control);
      else control.display.setAttribute("aria-invalid", "true");
      return false;
    }

    const changed = control.source.value !== iso;
    nativeSetInputValue(control.source, iso);
    nativeSetInputValue(control.display, displayDateFromIso(iso, control.source));
    control.source.removeAttribute("aria-invalid");
    control.display.removeAttribute("aria-invalid");
    delete control.display.dataset.mflDateDirty;
    if (changed) dispatchSourceChange(control.source, iso);
    return true;
  }

  function calendarIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4M16 3v4M3 10.5h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"></path></svg>';
  }

  function createControl(value = "", format = "DMY") {
    const source = document.createElement("input");
    source.type = "date";
    source.className = "dateValue";
    source.dataset.filterValue = "true";
    source.dataset.mflDateFormat = format === "MDY" ? "MDY" : "DMY";
    source.value = String(value || "");
    const control = ensureSource(source);
    if (!control) throw new Error("Could not create managed date control.");
    return control.host;
  }

  function ensureSource(source) {
    if (!(source instanceof HTMLInputElement) || !source.matches(SOURCE_SELECTOR)) return null;
    const existing = controlFromSource(source);
    if (existing) {
      syncDisplay(existing);
      existing.host.querySelectorAll(".mflDatePickerToggle").forEach((button) => {
        if (button instanceof HTMLButtonElement) button.disabled = source.disabled || source.readOnly;
      });
      return existing;
    }

    const host = document.createElement("div");
    host.className = "mflDateControl";
    host.dataset.mflDateControl = "true";
    source.before(host);
    host.appendChild(source);

    source.dataset.mflDateSource = "true";
    source.dataset.mflDateManaged = "true";
    source.dataset.mflDateOriginalTabindex = source.getAttribute("tabindex") || "";
    source.tabIndex = -1;
    source.setAttribute("aria-hidden", "true");

    const display = document.createElement("input");
    display.type = "text";
    display.inputMode = "numeric";
    display.enterKeyHint = "done";
    display.autocomplete = "off";
    display.spellcheck = false;
    display.maxLength = 10;
    display.className = `${source.className} mflDateInput`.trim();
    display.dataset.mflDateDisplay = "true";
    display.setAttribute("aria-label", source.getAttribute("aria-label") || "Date");
    host.appendChild(display);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mflDatePickerToggle";
    toggle.dataset.mflDatePickerToggle = "true";
    toggle.setAttribute("aria-label", "Open or close calendar");
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = calendarIcon();
    host.appendChild(toggle);

    const control = { source, display, host };
    syncDisplay(control);
    toggle.disabled = source.disabled || source.readOnly;
    return control;
  }

  function enhance(root = document) {
    if (root instanceof Element && root.matches(SOURCE_SELECTOR)) ensureSource(root);
    root.querySelectorAll?.(SOURCE_SELECTOR).forEach((source) => ensureSource(source));
    if (activeControl && !activeControl.source.isConnected) closePicker();
    return true;
  }

  function monthLabel() {
    if (calendarView === "days") return MONTH_FORMATTER.format(visibleMonth);
    if (calendarView === "months") return String(visibleMonth.getFullYear());
    return "Year";
  }

  function navIcon(direction, coarse) {
    if (direction < 0 && coarse) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 18-6-6 6-6M18 18l-6-6 6-6"></path></svg>';
    if (direction < 0) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>';
    if (coarse) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 6 6-6 6M11 6l6 6-6 6"></path></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';
  }

  function shiftVisible(direction, coarse) {
    let months;
    if (calendarView === "days") months = direction * (coarse ? 12 : 1);
    else if (calendarView === "months") months = direction * (coarse ? 120 : 12);
    else months = direction * (coarse ? 1200 : 120);
    visibleMonth = addMonths(visibleMonth, months);
    renderPicker();
  }

  function renderHeader(host) {
    const labels = calendarView === "days"
      ? ["Previous year", "Previous month", "Next month", "Next year"]
      : calendarView === "months"
        ? ["Previous 10 years", "Previous year", "Next year", "Next 10 years"]
        : ["Previous 100 years", "Previous 10 years", "Next 10 years", "Next 100 years"];
    host.innerHTML = `
      <button type="button" class="mflDatePickerNav mflDatePickerYearNav" data-date-shift="-1" data-date-coarse="true" aria-label="${labels[0]}">${navIcon(-1, true)}</button>
      <button type="button" class="mflDatePickerNav" data-date-shift="-1" data-date-coarse="false" aria-label="${labels[1]}">${navIcon(-1, false)}</button>
      <button type="button" class="mflDatePickerMonth" data-date-title aria-live="polite" aria-expanded="${calendarView === "months" ? "true" : "false"}" ${calendarView === "years" ? "disabled" : ""}>${monthLabel()}</button>
      <button type="button" class="mflDatePickerNav" data-date-shift="1" data-date-coarse="false" aria-label="${labels[2]}">${navIcon(1, false)}</button>
      <button type="button" class="mflDatePickerNav mflDatePickerYearNav" data-date-shift="1" data-date-coarse="true" aria-label="${labels[3]}">${navIcon(1, true)}</button>
    `;
  }

  function selectedIso() {
    return dateFromIso(activeControl?.source.value) ? activeControl.source.value : "";
  }

  function dateDisabled(iso) {
    if (!activeControl) return true;
    return Boolean(
      (activeControl.source.min && iso < activeControl.source.min)
      || (activeControl.source.max && iso > activeControl.source.max),
    );
  }

  function renderDays(body) {
    const weekdays = document.createElement("div");
    weekdays.className = "mflDatePickerWeekdays";
    weekdays.setAttribute("aria-hidden", "true");
    WEEKDAY_LABELS.forEach((label) => {
      const item = document.createElement("span");
      item.textContent = label;
      weekdays.appendChild(item);
    });

    const grid = document.createElement("div");
    grid.className = "mflDatePickerGrid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", MONTH_FORMATTER.format(visibleMonth));
    const selected = selectedIso();
    const today = isoFromDate(new Date());
    calendarDays(visibleMonth).forEach((date) => {
      const iso = isoFromDate(date);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflDatePickerDay";
      button.dataset.calendarDate = iso;
      button.dataset.outsideMonth = date.getMonth() !== visibleMonth.getMonth() ? "true" : "false";
      button.textContent = String(date.getDate());
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", LONG_DATE_FORMATTER.format(date));
      button.setAttribute("aria-selected", iso === selected ? "true" : "false");
      if (iso === today) button.setAttribute("aria-current", "date");
      button.disabled = dateDisabled(iso);
      if (iso === selected || (!selected && iso === today)) button.dataset.calendarAutofocus = "true";
      grid.appendChild(button);
    });

    const footer = document.createElement("div");
    footer.className = "mflDatePickerFooter";
    const todayButton = document.createElement("button");
    todayButton.type = "button";
    todayButton.dataset.dateToday = "true";
    todayButton.textContent = "Today";
    todayButton.disabled = dateDisabled(today);
    footer.appendChild(todayButton);
    body.replaceChildren(weekdays, grid, footer);
  }

  function renderMonths(body) {
    const grid = document.createElement("div");
    grid.className = "mflDatePickerOptionGrid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", `Choose month ${visibleMonth.getFullYear()}`);
    MONTH_LABELS.forEach((label, month) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflDatePickerOption mflDatePickerMonthOption";
      button.dataset.calendarMonth = String(month);
      button.textContent = label;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-selected", month === visibleMonth.getMonth() ? "true" : "false");
      grid.appendChild(button);
    });
    body.replaceChildren(grid);
  }

  function renderYears(body) {
    const grid = document.createElement("div");
    grid.className = "mflDatePickerOptionGrid mflDatePickerYearGrid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Choose year");
    const visibleYear = visibleMonth.getFullYear();
    for (let year = visibleYear - 100; year <= visibleYear + 100; year += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mflDatePickerOption mflDatePickerYearOption";
      button.dataset.calendarYear = String(year);
      button.textContent = String(year);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-selected", year === visibleYear ? "true" : "false");
      grid.appendChild(button);
    }
    body.replaceChildren(grid);
  }

  function ensurePicker() {
    if (picker instanceof HTMLElement && picker.isConnected) return picker;
    const element = document.createElement("div");
    element.className = "mflDatePickerPopover";
    element.dataset.mflDatePickerPopover = "true";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-modal", "false");
    element.setAttribute("aria-label", "Calendar");
    element.hidden = true;
    element.innerHTML = '<div class="mflDatePickerHeader" data-date-header></div><div class="mflDatePickerBody" data-date-body></div>';
    document.body.appendChild(element);
    picker = element;
    return element;
  }

  function renderPicker() {
    const element = ensurePicker();
    const header = element.querySelector("[data-date-header]");
    const body = element.querySelector("[data-date-body]");
    if (!(header instanceof HTMLElement) || !(body instanceof HTMLElement)) return;
    renderHeader(header);
    if (calendarView === "days") renderDays(body);
    else if (calendarView === "months") renderMonths(body);
    else renderYears(body);
    schedulePosition();
  }

  function positionPicker() {
    if (!(picker instanceof HTMLElement) || picker.hidden || !activeControl?.display.isConnected) return false;
    const anchor = activeControl.display.getBoundingClientRect();
    const calendar = picker.getBoundingClientRect();
    const edge = 12;
    const gap = 8;
    const maxLeft = Math.max(edge, window.innerWidth - calendar.width - edge);
    const left = Math.min(Math.max(anchor.left, edge), maxLeft);
    const belowTop = anchor.bottom + gap;
    const fitsBelow = belowTop + calendar.height <= window.innerHeight - edge;
    const top = fitsBelow ? belowTop : Math.max(edge, anchor.top - calendar.height - gap);
    picker.style.left = `${Math.round(left)}px`;
    picker.style.top = `${Math.round(top)}px`;
    picker.dataset.placement = fitsBelow ? "below" : "above";
    return true;
  }

  function schedulePosition() {
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      positionPicker();
    });
  }

  function setOpenState(control, open) {
    control.host.dataset.mflDatePickerOpen = open ? "true" : "false";
    control.display.dataset.mflDatePickerOpen = open ? "true" : "false";
    const toggle = control.host.querySelector(".mflDatePickerToggle");
    if (toggle instanceof HTMLButtonElement) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      delete control.host.dataset.mflDatePickerOpen;
      delete control.display.dataset.mflDatePickerOpen;
    }
  }

  function openPicker(control) {
    if (!control || control.source.disabled || control.source.readOnly) return false;
    commitDisplayedDate(control);
    delete control.display.dataset.mflDateBaseline;
    if (activeControl?.source === control.source && picker && !picker.hidden) {
      closePicker();
      return false;
    }
    if (activeControl) setOpenState(activeControl, false);
    activeControl = control;
    visibleMonth = startOfMonth(dateFromIso(control.source.value) || new Date());
    calendarView = "days";
    setOpenState(control, true);
    const element = ensurePicker();
    element.hidden = false;
    renderPicker();
    schedulePosition();
    requestAnimationFrame(() => {
      element.querySelector('[data-calendar-autofocus="true"]')?.focus({ preventScroll: true });
    });
    return true;
  }

  function closePicker({ restoreFocus = false } = {}) {
    if (!activeControl) return false;
    const control = activeControl;
    if (picker instanceof HTMLElement) picker.hidden = true;
    setOpenState(control, false);
    activeControl = null;
    calendarView = "days";
    if (restoreFocus && control.display.isConnected) control.display.focus({ preventScroll: true });
    return true;
  }

  function commitCalendarDate(date) {
    if (!activeControl) return false;
    const control = activeControl;
    const iso = isoFromDate(date);
    if (dateDisabled(iso)) return false;
    const changed = control.source.value !== iso;
    nativeSetInputValue(control.source, iso);
    nativeSetInputValue(control.display, displayDateFromIso(iso, control.source));
    control.source.removeAttribute("aria-invalid");
    control.display.removeAttribute("aria-invalid");
    delete control.display.dataset.mflDateDirty;
    delete control.display.dataset.mflDateBaseline;
    if (changed) dispatchSourceChange(control.source, iso);
    closePicker();
    return true;
  }

  function focusCalendarDate(date) {
    if (!(picker instanceof HTMLElement)) return;
    const iso = isoFromDate(date);
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      visibleMonth = startOfMonth(date);
      renderPicker();
    }
    requestAnimationFrame(() => {
      picker?.querySelector(`[data-calendar-date="${iso}"]`)?.focus({ preventScroll: true });
    });
  }

  function handleDayKeydown(event, button) {
    const date = dateFromIso(button.dataset.calendarDate || "");
    if (!date) return;
    let destination = null;
    if (event.key === "ArrowLeft") destination = addDays(date, -1);
    else if (event.key === "ArrowRight") destination = addDays(date, 1);
    else if (event.key === "ArrowUp") destination = addDays(date, -7);
    else if (event.key === "ArrowDown") destination = addDays(date, 7);
    else if (event.key === "Home") destination = addDays(date, -((date.getDay() + 6) % 7));
    else if (event.key === "End") destination = addDays(date, 6 - ((date.getDay() + 6) % 7));
    else if (event.key === "PageUp") destination = new Date(date.getFullYear(), date.getMonth() - 1, date.getDate());
    else if (event.key === "PageDown") destination = new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (!destination) return;
    event.preventDefault();
    focusCalendarDate(destination);
  }

  function pickerClick(event) {
    if (!(event.target instanceof Element)) return;
    const shiftButton = event.target.closest("[data-date-shift]");
    if (shiftButton instanceof HTMLButtonElement) {
      shiftVisible(Number(shiftButton.dataset.dateShift) < 0 ? -1 : 1, shiftButton.dataset.dateCoarse === "true");
      return;
    }
    const title = event.target.closest("[data-date-title]");
    if (title instanceof HTMLButtonElement && !title.disabled) {
      calendarView = calendarView === "days" ? "months" : "years";
      renderPicker();
      requestAnimationFrame(() => {
        const selector = calendarView === "months"
          ? '.mflDatePickerMonthOption[aria-selected="true"]'
          : '.mflDatePickerYearOption[aria-selected="true"]';
        const selected = picker?.querySelector(selector);
        selected?.scrollIntoView({ block: "center" });
        selected?.focus({ preventScroll: true });
      });
      return;
    }
    const day = event.target.closest("[data-calendar-date]");
    if (day instanceof HTMLButtonElement) {
      const date = dateFromIso(day.dataset.calendarDate || "");
      if (date) commitCalendarDate(date);
      return;
    }
    const month = event.target.closest("[data-calendar-month]");
    if (month instanceof HTMLButtonElement) {
      visibleMonth = new Date(visibleMonth.getFullYear(), Number(month.dataset.calendarMonth), 1);
      calendarView = "days";
      renderPicker();
      return;
    }
    const year = event.target.closest("[data-calendar-year]");
    if (year instanceof HTMLButtonElement) {
      visibleMonth = new Date(Number(year.dataset.calendarYear), visibleMonth.getMonth(), 1);
      calendarView = "months";
      renderPicker();
      return;
    }
    if (event.target.closest("[data-date-today]")) commitCalendarDate(new Date());
  }

  function documentPointerDown(event) {
    if (!(event.target instanceof Node)) return;
    if (picker instanceof HTMLElement && picker.contains(event.target)) return;
    const control = controlFromTarget(event.target);
    const toggle = event.target instanceof Element ? event.target.closest(".mflDatePickerToggle") : null;
    if (control && toggle instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      openPicker(control);
      return;
    }
    if (control) {
      if (activeControl && activeControl.source !== control.source) closePicker();
      rememberBaseline(control);
      return;
    }
    closePicker();
  }

  function documentFocusIn(event) {
    const control = controlFromTarget(event.target);
    if (!control) return;
    if (event.target === control.source && !control.display.disabled) {
      control.display.focus({ preventScroll: true });
      return;
    }
    if (event.target === control.display) rememberBaseline(control);
  }

  function documentFocusOut(event) {
    const control = controlFromTarget(event.target);
    if (!control || event.target !== control.display) return;
    setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof Node && (control.host.contains(active) || picker?.contains(active))) return;
      if (activeControl?.source === control.source) return;
      commitDisplayedDate(control);
      delete control.display.dataset.mflDateBaseline;
    }, 0);
  }

  function documentInput(event) {
    const control = controlFromTarget(event.target);
    if (!control) return;
    if (event.target === control.display) {
      rememberBaseline(control);
      const formatted = formatTypedDate(control.display.value, control.source);
      if (control.display.value !== formatted) nativeSetInputValue(control.display, formatted);
      control.display.dataset.mflDateDirty = "true";
      const complete = formatted.replace(/\D/g, "").length === 8;
      if (complete && commitDisplayedDate(control, false)) {
        delete control.display.dataset.mflDateBaseline;
        if (activeControl?.source === control.source) closePicker();
        control.display.blur();
      } else if (!complete) {
        control.display.removeAttribute("aria-invalid");
      }
      return;
    }
    if (event.target === control.source) syncDisplay(control);
  }

  function documentKeyDown(event) {
    if (event.key === "Escape" && activeControl) {
      event.preventDefault();
      event.stopPropagation();
      closePicker({ restoreFocus: true });
      return;
    }
    if (event.key === "Tab" && activeControl) closePicker();

    if (event.target instanceof HTMLButtonElement && event.target.matches("[data-calendar-date]")) {
      handleDayKeydown(event, event.target);
      return;
    }

    const control = controlFromTarget(event.target);
    if (!control) return;
    const toggle = event.target instanceof Element ? event.target.closest(".mflDatePickerToggle") : null;
    if (toggle && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openPicker(control);
      return;
    }
    if (event.target !== control.display) return;
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      openPicker(control);
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      rememberBaseline(control);
      nativeSetInputValue(control.display, "");
      control.display.dataset.mflDateDirty = "true";
      commitDisplayedDate(control, false);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      restoreBaseline(control);
      control.display.blur();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!commitDisplayedDate(control, false)) return;
      delete control.display.dataset.mflDateBaseline;
      control.display.blur();
    }
  }

  function installPickerHandlers() {
    const element = ensurePicker();
    if (element.dataset.mflDatePickerBound === "true") return;
    element.dataset.mflDatePickerBound = "true";
    element.addEventListener("click", pickerClick);
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof Element) enhance(node);
    }));
    if (activeControl && !activeControl.source.isConnected) closePicker();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("pointerdown", documentPointerDown, true);
  document.addEventListener("focusin", documentFocusIn, true);
  document.addEventListener("focusout", documentFocusOut, true);
  document.addEventListener("input", documentInput, true);
  document.addEventListener("change", documentInput, true);
  document.addEventListener("keydown", documentKeyDown, true);
  window.addEventListener("resize", () => activeControl && schedulePosition());
  window.addEventListener("scroll", () => activeControl && schedulePosition(), true);

  installPickerHandlers();
  enhance();

  window.__mflDatePickerRuntime = Object.freeze({
    sync: () => enhance(),
    close: () => closePicker(),
    createControl,
  });
})();
