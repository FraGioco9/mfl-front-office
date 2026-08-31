import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [core, generated, styles] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-table-runtime.js"),
  read("./styles-base.css"),
]);

for (const source of [core, generated]) {
  invariant(
    source.includes('input.type = "date";')
      && source.includes('field.dataset.siteDateField = "true";')
      && source.includes('button.className = "siteDatePickerButton";')
      && source.includes('openSiteDatePicker(input, field);'),
    "Joined Agency must keep the working native date value input while exposing a site-owned calendar button.",
  );
  invariant(
    source.includes('rule.querySelector("[data-site-date-field]")'),
    "Operator/column changes must replace the whole date field rather than only its input.",
  );
  invariant(
    source.includes("for (let index = 0; index < 42; index += 1)")
      && source.includes('previous.setAttribute("aria-label", "Previous month")')
      && source.includes('next.setAttribute("aria-label", "Next month")')
      && source.includes('todayButton.textContent = "Today";'),
    "The custom calendar must render its own 42-day grid, month navigation, and Today action.",
  );
  invariant(
    source.includes('.toLocaleDateString("en-US", { month: "long", year: "numeric" })'),
    "Calendar month and year labels must always render in English.",
  );
  invariant(
    source.includes("closeSiteDatePicker();\n      input.blur();")
      && source.includes("event.stopImmediatePropagation();\n  const input = activeSiteDatePicker.input;"),
    "Calendar selection and Escape must deselect the date box without closing the parent popup.",
  );
  invariant(
    !source.includes("showPicker()") && !source.includes(".showPicker("),
    "The calendar icon must never invoke the browser-native date picker.",
  );
}

invariant(
  styles.includes(".siteDatePicker {")
    && styles.includes("z-index: var(--mfl-z-critical-modal);")
    && styles.includes("width: min(228px, calc(100vw - 16px));")
    && styles.includes("background: var(--surface);")
    && styles.includes("border: 1px solid var(--border-strong);")
    && styles.includes(".siteDatePickerDay.is-selected")
    && styles.includes("background: var(--primary);")
    && styles.includes(".siteDateField > .dateValue::-webkit-calendar-picker-indicator"),
  "The calendar must use MFL surface/border/accent tokens and hide the browser calendar indicator.",
);
invariant(!styles.includes("!important"), "The site calendar must not add CSS override workarounds.");

new Function(generated);
console.log("Site-owned date picker validation passed.");
