import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const manifest = JSON.parse(await read("./ui-behavior-foundations.json"));
const [
  foundations,
  motion,
  touch,
  stylesBase,
  dropdowns,
  controls,
  parity,
  phone,
  compact,
  sharedTableUi,
  statsMobileUi,
  interactions,
  playerInteractions,
  staticUi,
  sharedCore,
  globalSearch,
  scrollbars,
  docs,
] = await Promise.all([
  read("./ui-foundations.css"),
  read("./motion.css"),
  read("./responsive-sources/touch.css.inc"),
  read("./styles-base.css"),
  read("./dropdowns.css"),
  read("./controls.css"),
  read("./responsive-sources/parity.css.inc"),
  read("./responsive-sources/tables-phone.css.inc"),
  read("./responsive-sources/compact.css.inc"),
  read("./shared-table-ui-runtime.js"),
  read("./stats-mobile-ui-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./player-interactions-runtime.js"),
  read("./static-ui-runtime.js"),
  Promise.resolve(readCanonicalCoreSource("shared")),
  read("./global-search-runtime.js"),
  read("./scrollbars.css"),
  read("../docs/ui-behavior-foundations.md"),
]);

const { mobileMaxPx, phoneMaxPx, compactPhoneMaxPx } = manifest.breakpoints || {};
invariant(
  [mobileMaxPx, phoneMaxPx, compactPhoneMaxPx].every(Number.isInteger)
    && mobileMaxPx > phoneMaxPx
    && phoneMaxPx > compactPhoneMaxPx,
  "Behavior foundations must define ordered integer shell breakpoints.",
);
invariant(parity.includes(`@media (max-width: ${mobileMaxPx}px)`), "Mobile parity must match the canonical mobile breakpoint.");
invariant(phone.includes(`@media (max-width: ${phoneMaxPx}px)`), "Phone layout must match the canonical phone breakpoint.");
invariant(compact.includes(`@media (max-width: ${compactPhoneMaxPx}px)`), "Compact-phone layout must match the canonical compact breakpoint.");
invariant(
  sharedTableUi.includes(`const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: ${mobileMaxPx}px)");`)
    && sharedTableUi.includes(`const PHONE_TABLE_MEDIA = window.matchMedia("(max-width: ${phoneMaxPx}px)");`)
    && sharedTableUi.includes(`const TINY_TABLE_MEDIA = window.matchMedia("(max-width: ${compactPhoneMaxPx}px)");`),
  "Shared Table JS must use the same canonical shell breakpoints as responsive CSS.",
);
invariant(
  statsMobileUi.includes(`window.matchMedia("(max-width: ${mobileMaxPx}px)")`)
    && playerInteractions.includes(`window.matchMedia("(max-width: ${mobileMaxPx}px)")`)
    && !interactions.includes("PLAYER_VIEW_SCROLL_MEDIA"),
  "Responsive route runtimes must use the canonical mobile breakpoint without keeping Player-only media ownership universal.",
);

const matrix = Array.isArray(manifest.validationMatrix) ? manifest.validationMatrix : [];
for (const name of [
  "desktop-scrollbar",
  "desktop-no-scrollbar",
  "desktop-boundary",
  "mobile-boundary",
  "phone-boundary",
  "compact-phone-boundary",
]) {
  invariant(matrix.some((entry) => entry?.name === name), `Responsive validation matrix is missing ${name}.`);
}
invariant(
  matrix.some((entry) => entry.width === mobileMaxPx)
    && matrix.some((entry) => entry.width === phoneMaxPx)
    && matrix.some((entry) => entry.width === compactPhoneMaxPx),
  "Responsive validation matrix must exercise every shared shell breakpoint boundary.",
);
const symmetricPair = matrix.filter((entry) => entry.width === 1280 && entry.height === 900);
invariant(
  symmetricPair.some((entry) => entry.scrollbar === "present")
    && symmetricPair.some((entry) => entry.scrollbar === "absent"),
  "Responsive validation matrix must compare the same desktop viewport with and without a scrollbar.",
);

const { disabledOpacity, disabledCursor } = manifest.interactionStates || {};
invariant(disabledOpacity === 0.45 && disabledCursor === "not-allowed", "Canonical disabled-state semantics changed unexpectedly.");
invariant(
  stylesBase.includes(`button:disabled:not(.menuButton) {\n  cursor: ${disabledCursor};\n  opacity: ${disabledOpacity};\n}`),
  "Ordinary disabled buttons must keep the shared cursor/opacity state.",
);
invariant(
  dropdowns.includes(`.watchlistDropdownAction:disabled {\n  opacity: ${disabledOpacity};\n}`),
  "Equivalent disabled dropdown actions must keep the shared disabled opacity.",
);

const { minimumTargetPx, formFieldFontSizePx } = manifest.touch || {};
invariant(minimumTargetPx === 44 && formFieldFontSizePx === 16, "Canonical touch geometry changed unexpectedly.");
invariant(
  touch.includes(`.themeButton,\n  #accountButton,\n  .navButton,\n  .pager button {\n    min-height: ${minimumTargetPx}px;\n  }`),
  "Primary coarse-pointer controls must keep the canonical minimum touch target.",
);
invariant(touch.includes("touch-action: manipulation;"), "Touch controls must keep direct manipulation semantics.");
invariant(
  parity.includes(`input:where(:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])),\n  select,\n  textarea {\n    font-size: ${formFieldFontSizePx}px;\n  }`),
  "Touch form fields must retain the canonical anti-zoom font size.",
);

for (const token of [
  ".filtersDialog [data-filter-value]",
  "#evaluationSearchInput",
  "#playerSearchInput",
  "border-color: var(--border-strong);",
  "border-radius: var(--mfl-radius-control);",
  "background: var(--surface);",
  "color: var(--text);",
  "::placeholder",
]) {
  invariant(controls.includes(token), `Shared form-field foundation is missing ${token}.`);
}

invariant(
  staticUi.includes('function resetMainPageScroll() {')
    && staticUi.includes('if (pageChanged) resetMainPageScroll();'),
  "Cross-route navigation must reset the canonical main vertical scroll while same-page view changes preserve it.",
);
invariant(
  sharedCore.includes("function syncMobileTablePageTransitionChrome(pageName)")
    && sharedCore.includes("scroller.scrollLeft = 0;"),
  "Mobile page changes must reset player-table horizontal scroll through the existing shared owner.",
);
invariant(
  interactions.includes("playerAttributeViewScrollLeft = views.scrollLeft;")
    && interactions.includes("applyPlayerAttributeViewScroll()"),
  "Player same-route view changes must preserve their horizontal control-strip position.",
);

invariant(
  interactions.includes("const escapeHandlers = new Map();")
    && interactions.includes("function registerEscapeHandler(key, handler, options = {})")
    && interactions.includes("function dispatchEscapeHandlers(event)"),
  "Modal and overlay Escape behavior must keep one global priority registry.",
);
invariant(
  interactions.includes("function visibleModalBackdrop()")
    && scrollbars.includes(':root:has(body > .modalBackdrop:not([hidden])) body > #appShell > main {\n  overflow-y: hidden;\n}'),
  "Visible modals must use the shared modal-presence and scroll-lock foundation.",
);

for (const token of [
  "--mfl-helper-text-font-size: 12px;",
  "--mfl-helper-text-color: var(--text-soft);",
  "--mfl-helper-error-color: var(--danger);",
]) {
  invariant(foundations.includes(token), `Empty/error feedback foundation is missing ${token}.`);
}
invariant(
  globalSearch.includes('function renderSettledTypedSearchEmptyState(normalizedQuery) {')
    && globalSearch.includes('renderSearchMessage("No players, clubs, or agents found.");'),
  "Settled no-results states must remain distinct from loading/searching states.",
);

const overflowTolerance = Number(manifest.overflow?.measurementTolerancePx);
invariant(overflowTolerance === 2, "Canonical overflow measurement tolerance changed unexpectedly.");
invariant(
  sharedTableUi.includes(`const VIEW_SCROLL_EPSILON = ${overflowTolerance};`)
    && sharedTableUi.includes(`const PLAYER_TABLE_SCROLL_EPSILON = ${overflowTolerance};`)
    && sharedTableUi.includes('const VIEW_SCROLL_CLASS = "mflViewsOverflowing";'),
  "Horizontal overflow affordances must use one shared tolerance and state language.",
);
invariant(
  interactions.includes(`views.scrollWidth - views.clientWidth > ${overflowTolerance}`)
    && interactions.includes('views.classList.contains("mflViewsOverflowing")'),
  "Hydrated control-strip overflow detection must match the shared affordance contract.",
);

for (const token of [
  "--mfl-motion-fast: 0ms;",
  "--mfl-motion-tooltip: 0ms;",
  "--mfl-motion-standard: 0ms;",
  "--mfl-motion-expand: 0ms;",
  "--mfl-motion-slow: 0ms;",
]) {
  invariant(motion.includes(token), `Reduced-motion foundation is missing ${token}`);
}
invariant(motion.includes("@media (prefers-reduced-motion: reduce)"), "Shared motion must respect prefers-reduced-motion.");
for (const token of [
  "--mfl-focus-ring-color: var(--primary);",
  "--mfl-focus-ring-width: 2px;",
  "--mfl-focus-ring-offset: 2px;",
]) {
  invariant(foundations.includes(token), `Keyboard-focus foundation is missing ${token}`);
}

for (const heading of [
  "## Responsive breakpoint foundation",
  "## Interaction-state foundation",
  "## Touch-target foundation",
  "## Form-field foundation",
  "## Scroll and navigation-state foundation",
  "## Modal interaction foundation",
  "## Empty, no-data, and error-state foundation",
  "## Overflow-affordance foundation",
  "## Reduced-motion and accessibility foundation",
  "## Responsive validation matrix",
]) {
  invariant(docs.includes(heading), `Behavior-foundations documentation is missing ${heading}.`);
}

console.log("Cross-site UI behavior foundations passed: breakpoints, states, touch, fields, scroll, modals, feedback, overflow, accessibility, and responsive matrix.");
