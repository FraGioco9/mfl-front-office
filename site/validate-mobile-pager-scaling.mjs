import { readFile } from "node:fs/promises";

const sharedUi = String(
  await readFile(new URL("./shared-table-ui-runtime.js", import.meta.url), "utf8"),
).replace(/\r\n?/g, "\n");
const index = String(
  await readFile(new URL("./index.html", import.meta.url), "utf8"),
).replace(/\r\n?/g, "\n");

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pagerOwnerCount = sharedUi.split("#progressionPage nav.pager {").length - 1;
invariant(
  pagerOwnerCount === 1,
  "Mobile pager geometry must have one continuous owner instead of breakpoint-specific pager blocks.",
);

for (const token of [
  "--mfl-mobile-pager-button-width: clamp(30px, calc(25.615px + 1.154vw), 36px);",
  "--mfl-mobile-pager-button-height: clamp(30px, calc(25.615px + 1.154vw), 36px);",
  "--mfl-mobile-pager-font-size: clamp(9px, calc(7.538px + 0.385vw), 11px);",
  "--mfl-mobile-pager-icon-size: clamp(12px, calc(9.077px + 0.769vw), 16px);",
  "--mfl-mobile-pager-page-gap: clamp(5px, calc(-0.115px + 1.346vw), 12px);",
  "gap: 0;",
  "#progressionPage nav.pager > :is(#prevButton, #nextButton) {",
  "display: grid;",
  "place-items: center;",
  "flex: 0 0 var(--mfl-mobile-pager-button-width);",
  "min-width: var(--mfl-mobile-pager-button-width);",
  "max-width: var(--mfl-mobile-pager-button-width);",
  "min-height: var(--mfl-mobile-pager-button-height);",
  "max-height: var(--mfl-mobile-pager-button-height);",
  "padding: 0;",
  "#progressionPage nav.pager > :is(#prevButton, #nextButton) > .pagerButtonLabel {",
  "display: none;",
  "#progressionPage nav.pager > :is(#prevButton, #nextButton)::before {",
  "width: var(--mfl-mobile-pager-icon-size);",
  "height: var(--mfl-mobile-pager-icon-size);",
  "margin: 0;",
  "background: currentColor;",
  "#progressionPage nav.pager > #prevButton::before {",
  "#progressionPage nav.pager > #nextButton::before {",
  "#progressionPage nav.pager > span#pageText {",
  "min-width: 0;",
  "margin-inline: var(--mfl-mobile-pager-page-gap);",
]) {
  invariant(sharedUi.includes(token), `Mobile pager icon scaling contract is missing: ${token}`);
}

for (const oldToken of [
  "--mfl-mobile-pager-button-width: clamp(60px, calc(43.923px + 4.231vw), 82px);",
  "--mfl-mobile-pager-button-width: clamp(56px, calc(41.385px + 3.846vw), 76px);",
  "--mfl-mobile-pager-button-height: clamp(32px, calc(26.154px + 1.538vw), 40px);",
  "--mfl-mobile-pager-inline-padding: clamp(5px, calc(1.346px + 0.962vw), 10px);",
  "--mfl-mobile-pager-inline-padding: clamp(4px, calc(1.077px + 0.769vw), 8px);",
]) {
  invariant(!sharedUi.includes(oldToken), `Mobile Previous/Next must not restore the text-button pager token: ${oldToken}`);
}

invariant(
  sharedUi.includes("%3Cpath%20d='M19%2012H5'/%3E%3Cpath%20d='m12%2019-7-7%207-7'/%3E"),
  "Previous must reuse the site's left-facing line-arrow geometry.",
);
invariant(
  sharedUi.includes("%3Cpath%20d='M5%2012h14'/%3E%3Cpath%20d='m12%205%207%207-7%207'/%3E"),
  "Next must reuse the site's right-facing line-arrow geometry.",
);
invariant(
  index.includes('<button id="prevButton" type="button"><span class="pagerButtonLabel">Previous</span></button>'),
  "Previous must retain its desktop/accessibility label in an independently hideable span.",
);
invariant(
  index.includes('<button id="nextButton" type="button"><span class="pagerButtonLabel">Next</span></button>'),
  "Next must retain its desktop/accessibility label in an independently hideable span.",
);

const pagerButtonStart = sharedUi.indexOf("#progressionPage nav.pager > :is(#prevButton, #nextButton) {");
const pagerButtonEnd = sharedUi.indexOf("#progressionPage nav.pager > :is(#prevButton, #nextButton) > .pagerButtonLabel {", pagerButtonStart);
invariant(pagerButtonStart >= 0 && pagerButtonEnd > pagerButtonStart, "Mobile pager button block must remain inspectable.");
const pagerButtonBlock = sharedUi.slice(pagerButtonStart, pagerButtonEnd);
invariant(
  !pagerButtonBlock.includes("font-size: 0;") && !pagerButtonBlock.includes("line-height: 0;"),
  "Mobile pager arrows must center by hiding the label span, not by collapsing button typography.",
);

invariant(
  !sharedUi.includes("#progressionPage nav.pager button {"),
  "Mobile pager buttons must target the real Previous/Next IDs rather than a generic button selector.",
);
invariant(
  !sharedUi.includes("#progressionPage nav.pager #pageText {\n    min-width: max-content;"),
  "Mobile page text must not retain an intrinsic-width spacer that hides the real button-to-text gap.",
);

console.log("Mobile pager icon scaling validation passed.");
