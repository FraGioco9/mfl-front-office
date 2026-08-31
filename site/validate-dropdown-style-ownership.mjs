import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [stylesBase, styles, dropdowns, runtime, shared] = await Promise.all([
  read("./styles-base.css"),
  read("./styles.css"),
  read("./dropdowns.css"),
  read("./dropdowns-runtime.js"),
  read("./modules/core-sources/shared.js"),
]);

for (const required of [
  "--mfl-dropdown-gap:",
  "--mfl-dropdown-max-height:",
  "--mfl-dropdown-chevron-inset:",
  "--mfl-dropdown-transition-duration: 150ms;",
  'select[data-mfl-dropdown-enhanced="true"]:open',
  '#accountButton[aria-expanded="true"]',
  "#watchlistButton::after",
  ".watchlistButtonChevron {\n  display: none;",
  ".filtersDialog select::picker(select)",
  "#pageSizeSelect::picker(select)",
  "margin-block: var(--mfl-dropdown-gap);",
]) {
  invariant(dropdowns.includes(required), `dropdowns.css is missing canonical rule: ${required}`);
}

const accountDropdownStart = dropdowns.indexOf("#accountDropdown {");
const accountDropdownEnd = dropdowns.indexOf("\n}\n\n#accountDropdown[hidden]", accountDropdownStart);
const accountDropdownSource = accountDropdownStart >= 0 && accountDropdownEnd > accountDropdownStart
  ? dropdowns.slice(accountDropdownStart, accountDropdownEnd + 2)
  : "";
const accountDropdownHiddenStart = dropdowns.indexOf("#accountDropdown[hidden] {");
const accountDropdownHiddenEnd = dropdowns.indexOf("\n}\n\n@starting-style", accountDropdownHiddenStart);
const accountDropdownHiddenSource = accountDropdownHiddenStart >= 0 && accountDropdownHiddenEnd > accountDropdownHiddenStart
  ? dropdowns.slice(accountDropdownHiddenStart, accountDropdownHiddenEnd + 2)
  : "";

invariant(
  accountDropdownSource.includes("opacity: 1;")
    && accountDropdownSource.includes("transform: translateY(0) scale(1);")
    && accountDropdownSource.includes("pointer-events: auto;")
    && accountDropdownSource.includes("opacity var(--mfl-dropdown-transition-duration) ease")
    && accountDropdownSource.includes("transform var(--mfl-dropdown-transition-duration) ease")
    && accountDropdownSource.includes("display var(--mfl-dropdown-transition-duration)")
    && accountDropdownSource.includes("transition-behavior: allow-discrete;"),
  "The account dropdown must use the canonical dropdown entrance/exit transition, including discrete display ownership.",
);
invariant(
  accountDropdownHiddenSource.includes("display: none;")
    && accountDropdownHiddenSource.includes("opacity: 0;")
    && accountDropdownHiddenSource.includes("transform: translateY(-4px) scale(0.98);")
    && accountDropdownHiddenSource.includes("pointer-events: none;"),
  "The hidden account dropdown state must retain the matching faded, raised transition endpoint.",
);
invariant(
  dropdowns.includes("@starting-style {\n  #accountDropdown:not([hidden]) {\n    opacity: 0;\n    transform: translateY(-4px) scale(0.98);\n  }\n}"),
  "The account dropdown must define its pre-paint opening state so it never flashes fully visible before animating.",
);

for (const duplicate of [
  "--mfl-dropdown-max-height:",
  "--mfl-dropdown-chevron-inset:",
  'select[data-mfl-dropdown-enhanced="true"]:open',
  '#accountButton[aria-expanded="true"]',
  "#accountButton",
  "#accountDropdown",
  "#watchlistButton::after",
  ".watchlistButtonChevron {",
  ".filtersDialog select::picker(select)",
  "#pageSizeSelect::picker(select)",
]) {
  invariant(!styles.includes(duplicate), `styles.css must not duplicate dropdown ownership through ${duplicate}`);
}

for (const legacySelector of [
  ".accountMenu",
  ".accountDropdown",
  ".accountDropdownItem",
  ".accountSettingsButton",
  ".accountUserButton",
  "#accountButton",
  "#linkWalletButton",
  ".watchlistButton",
  ".watchlistDropdown",
]) {
  invariant(
    !stylesBase.includes(legacySelector),
    `styles-base.css must not retain canonical dropdown selector ${legacySelector}.`,
  );
}

invariant(
  !runtime.includes('!select.classList.contains("evaluationSummaryPositionSelect")'),
  "Evaluation Position must participate in the canonical dropdown enhancer instead of being special-cased out.",
);
invariant(
  shared.includes('class="evaluationSummaryPositionSelect" data-mfl-dropdown-enhanced="true" data-evaluation-summary-position'),
  "Evaluation Position must render with canonical dropdown ownership on its first rendered frame.",
);
invariant(
  dropdowns.includes('--mfl-dropdown-chevron-gap: auto;')
    && dropdowns.includes('.evaluationSummaryPositionSelect[data-mfl-dropdown-enhanced="true"] {\n  --mfl-dropdown-chevron-gap: auto;')
    && dropdowns.includes('--mfl-evaluation-position-trigger-width: 46px;')
    && dropdowns.includes('--mfl-evaluation-position-chevron-left: 35px;')
    && dropdowns.includes('width: var(--mfl-evaluation-position-trigger-width);')
    && dropdowns.includes('border: 0;\n  border-radius: 0;\n  background: transparent;')
    && dropdowns.includes('.evaluationSummaryPositionSelect[data-mfl-dropdown-enhanced="true"]:open {\n  outline: 0;\n  border: 0;\n  background: transparent;')
    && dropdowns.includes('.evaluationSummaryPositionSelect[data-mfl-dropdown-enhanced="true"]::picker(select) {\n    margin-block: 4px;\n    margin-inline-start: -5px;\n    padding-inline: 4px 5px;')
    && dropdowns.includes('.evaluationSummaryPositionSelect[data-mfl-dropdown-enhanced="true"] option {\n    padding-inline: 0 9px;')
    && dropdowns.includes('left: var(--mfl-evaluation-position-chevron-left);')
    && dropdowns.includes('transform: translateY(-50%) rotate(45deg);'),
  "Evaluation Position must keep a boxless trigger, anchor the chevron independently of value length, move the opened picker surface left, keep its option text aligned with the selected Position text, and use the compact 4px trigger-to-picker gap.",
);
invariant(
  !stylesBase.includes('.evaluationSummaryTable td:nth-child(2):has(.evaluationSummaryPositionSelect)::after')
    && !stylesBase.includes('.evaluationSummaryPositionSelect {'),
  "Evaluation Position must not retain its legacy custom trigger or pseudo-element chevron owner.",
);

for (const runtimeStyleOwner of [
  'document.createElement("style")',
  "mflDropdownRuntimeAdjustments",
  "installRuntimeStyles",
  "style.textContent",
]) {
  invariant(!runtime.includes(runtimeStyleOwner), `dropdowns-runtime.js must not inject deterministic CSS through ${runtimeStyleOwner}`);
}

console.log("Canonical dropdown CSS ownership and account transition validation passed.");
