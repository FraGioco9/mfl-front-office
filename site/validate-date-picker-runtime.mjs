import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [bootstrap, entry, runtime, styles, mainStyles, core, tableRuntime] = await Promise.all([
  read("./bootstrap.js"),
  read("./modules/app-entry.js"),
  read("./date-picker-runtime.js"),
  read("./date-picker.css"),
  read("./styles.css"),
  read("./modules/app-core.js"),
  read("./modules/app-core-table-runtime.js"),
]);

invariant(
  bootstrap.includes('await loadRuntime("/date-picker-runtime.js");')
    && !entry.includes('"/date-picker-runtime.js"'),
  "The shared Baraccano-style date picker must load before bootstrap-core and must not be loaded a second time by app-entry.",
);
invariant(
  mainStyles.includes('@import url("/date-picker.css");'),
  "The shared Baraccano-style date picker stylesheet must be loaded centrally.",
);
invariant(
  runtime.includes('const SOURCE_SELECTOR = \'input.dateValue[type="date"][data-filter-value="true"]\';')
    && runtime.includes('display.dataset.mflDateDisplay = "true";')
    && runtime.includes('source.dataset.mflDateSource = "true";')
    && runtime.includes('window.__mflDatePickerRuntime = Object.freeze({'),
  "The calendar must use the Baraccano visible-editor/hidden-ISO-source control contract.",
);
invariant(
  runtime.includes("createControl")
    && core.includes("__mflDatePickerRuntime")
    && core.includes("createControl")
    && tableRuntime.includes("__mflDatePickerRuntime")
    && tableRuntime.includes("createControl")
    && !core.includes('input.className = "dateValue";')
    && !tableRuntime.includes('input.className = "dateValue";'),
  "Canonical table filters must create only managed Baraccano date controls; the old native date-control fallback must not exist.",
);
invariant(
  core.includes('state.settingsDateFormat === "MDY" ? "MDY" : "DMY"')
    && runtime.includes('return source?.dataset.mflDateFormat === "MDY" ? "MDY" : "DMY";')
    && runtime.includes('return dateFormat(source) === "MDY" ? "MM/DD/YYYY" : "DD/MM/YYYY";'),
  "Visible date editing must follow the existing MFL DMY/MDY setting while preserving ISO source values.",
);
invariant(
  styles.includes('.mflDateControl > input[data-mfl-date-source="true"]')
    && styles.includes("visibility: hidden;")
    && styles.includes("pointer-events: none;")
    && styles.includes("appearance: none;")
    && styles.includes("-webkit-appearance: none;"),
  "The native ISO source must be fully hidden and non-interactive so browser date UI cannot surface.",
);
invariant(
  (runtime.match(/mflDatePickerYearNav/g) || []).length >= 2
    && styles.includes("grid-template-columns: 34px 34px minmax(0, 1fr) 34px 34px;"),
  "The calendar header must match Baraccano with persistent previous/next year shortcut arrows.",
);
invariant(
  runtime.includes('calendarView === "days" ? "months" : "years"')
    && runtime.includes('calendarView === "years" ? "disabled" : ""')
    && runtime.includes('className = "mflDatePickerOption mflDatePickerMonthOption";')
    && runtime.includes('className = "mflDatePickerOption mflDatePickerYearOption";'),
  "The center title must progress from days to month picker to year picker and become inert in year view.",
);
invariant(
  runtime.includes("Array.from({ length: 42 }")
    && runtime.includes('todayButton.textContent = "Today";')
    && runtime.includes('grid-template-columns: repeat(3') === false,
  "The runtime must provide the 42-day grid and Today action; option-grid columns belong in CSS.",
);
invariant(
  styles.includes("--mfl-date-picker-width: 272px;")
    && styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr));")
    && styles.includes("z-index: var(--mfl-z-critical-modal);")
    && styles.includes("background: var(--surface);")
    && styles.includes("border: 1px solid var(--border-strong);"),
  "The popup must keep Baraccano's compact geometry while using MFL theme and stacking tokens.",
);
invariant(
  runtime.includes('event.altKey && event.key === "ArrowDown"')
    && runtime.includes('event.key === "Delete"')
    && runtime.includes('event.key === "Escape"')
    && runtime.includes('event.key === "Enter"')
    && runtime.includes('event.key === "ArrowLeft"')
    && runtime.includes('event.key === "ArrowRight"')
    && runtime.includes('event.key === "ArrowUp"')
    && runtime.includes('event.key === "ArrowDown"')
    && runtime.includes('event.key === "Home"')
    && runtime.includes('event.key === "End"')
    && runtime.includes('event.key === "PageUp"')
    && runtime.includes('event.key === "PageDown"'),
  "The retry must preserve Baraccano-style manual editing and keyboard calendar controls.",
);
invariant(
  runtime.includes("formatTypedDate")
    && runtime.includes("isoFromDisplayDate")
    && runtime.includes("rememberBaseline")
    && runtime.includes("restoreBaseline")
    && runtime.includes("new MutationObserver("),
  "Typed-date formatting, edit cancellation, and dynamic date-control enhancement must remain centrally owned.",
);
invariant(
  core.includes('rule.querySelector("[data-mfl-date-display]")')
    && tableRuntime.includes('rule.querySelector("[data-mfl-date-display]")'),
  "New date filters must focus the visible managed editor rather than the hidden ISO source.",
);
invariant(
  !core.includes("syncDatePickerControls();")
    && !tableRuntime.includes("syncDatePickerControls();")
    && core.includes("filterRules.appendChild(rule);\n  refreshRuleConnectors();")
    && tableRuntime.includes("filterRules.appendChild(rule);\n  refreshRuleConnectors();"),
  "Joined Agency insertion and replacement must not call the removed date-picker sync helper after managed controls are created.",
);
invariant(
  core.includes('rule.querySelector("[data-mfl-date-control]")')
    && tableRuntime.includes('rule.querySelector("[data-mfl-date-control]")'),
  "Joined Agency operator and column changes must replace the whole managed date box, never only its hidden ISO source.",
);
invariant(
  core.includes('filterRules.querySelector("[data-mfl-date-display]")')
    && tableRuntime.includes('filterRules.querySelector("[data-mfl-date-display]")'),
  "Opening Filters with a Joined Agency rule must focus a visible date box rather than the hidden ISO source.",
);
invariant(
  !styles.includes("!important") && !runtime.includes("!important"),
  "The date picker must not introduce CSS override workarounds.",
);

new Function(runtime);
console.log("Baraccano-style MFL date picker validation passed.");
