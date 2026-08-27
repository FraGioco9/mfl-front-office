import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [entry, runtime, dropdowns, core] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./date-picker-runtime.js"),
  read("./dropdowns.css"),
  read("./modules/app-core.js"),
]);

invariant(
  entry.includes('"/date-picker-runtime.js"'),
  "The shared date picker must load with the universal UI runtimes.",
);
invariant(
  runtime.includes('const INPUT_SELECTOR = \'input.dateValue[type="text"]\';')
    && runtime.includes('input.dataset.mflDatePicker = "true";')
    && runtime.includes('new MutationObserver('),
  "The date picker runtime must enhance current and dynamically-created Joined Agency date boxes.",
);
invariant(
  runtime.includes('element.setAttribute("role", "dialog");')
    && runtime.includes('data-mfl-date-picker-action="previous"')
    && runtime.includes('data-mfl-date-picker-action="next"')
    && runtime.includes('data-mfl-date-picker-action="today"')
    && runtime.includes('role="grid"'),
  "The date picker must expose a dialog calendar with month navigation, a date grid, and Today action.",
);
invariant(
  runtime.includes('event.key === "Escape"')
    && runtime.includes('event.key === "ArrowLeft"')
    && runtime.includes('event.key === "ArrowRight"')
    && runtime.includes('event.key === "ArrowUp"')
    && runtime.includes('event.key === "ArrowDown"')
    && runtime.includes('event.key === "PageUp"')
    && runtime.includes('event.key === "PageDown"'),
  "The date picker must support Escape and keyboard date navigation.",
);
invariant(
  runtime.includes('activeInput.dispatchEvent(new Event("input", { bubbles: true }));')
    && runtime.includes('activeInput.dispatchEvent(new Event("change", { bubbles: true }));')
    && runtime.includes('activeInput.value = iso;'),
  "Calendar selection must keep the native ISO input contract and notify existing filter behavior.",
);
invariant(
  core.includes("function buildDateInput(value = \"\")")
    && core.includes('input.type = "text";')
    && core.includes('input.inputMode = "numeric";')
    && core.includes('input.placeholder = "YYYY-MM-DD";')
    && core.includes('input.className = "dateValue";')
    && core.includes('group.className = "betweenValue dateRangeValue";'),
  "Canonical table filters must use non-native date boxes while preserving the ISO value and range contract.",
);
invariant(
  dropdowns.includes(".mflDatePicker {")
    && dropdowns.includes("background: var(--surface);")
    && dropdowns.includes("border: 1px solid var(--border-strong);")
    && dropdowns.includes("box-shadow: var(--mfl-dropdown-shadow);")
    && dropdowns.includes(".mflDatePickerDay.isSelected")
    && dropdowns.includes("background: var(--primary);")
    && dropdowns.includes(".mflDatePickerDay:hover:not(.isSelected)"),
  "The calendar must reuse the site's canonical dropdown surface and interaction tokens.",
);
invariant(
  !runtime.includes('type="date"')
    && !dropdowns.includes("calendar-picker-indicator")
    && !core.match(/function buildDateInput[\s\S]*?input\.type = "date";/),
  "The browser-native date picker path must be removed completely from Joined Agency date boxes.",
);
invariant(!dropdowns.includes(".mflDatePicker") || !dropdowns.match(/\.mflDatePicker[\s\S]*?!important/), "Date picker styling must not introduce !important overrides.");

new Function(runtime);
console.log("Shared site-styled date picker validation passed.");
