import { readFile } from "node:fs/promises";

const sharedUi = String(
  await readFile(new URL("./shared-table-ui-runtime.js", import.meta.url), "utf8"),
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
  "--mfl-mobile-pager-button-width: clamp(60px, calc(43.923px + 4.231vw), 82px);",
  "--mfl-mobile-pager-button-height: clamp(32px, calc(26.154px + 1.538vw), 40px);",
  "--mfl-mobile-pager-font-size: clamp(10px, calc(8.538px + 0.385vw), 12px);",
  "--mfl-mobile-pager-page-gap: clamp(5px, calc(-0.115px + 1.346vw), 12px);",
  "gap: 0;",
  "#progressionPage nav.pager > :is(#prevButton, #nextButton) {",
  "flex: 0 0 var(--mfl-mobile-pager-button-width);",
  "min-width: var(--mfl-mobile-pager-button-width);",
  "max-width: var(--mfl-mobile-pager-button-width);",
  "min-height: var(--mfl-mobile-pager-button-height);",
  "max-height: var(--mfl-mobile-pager-button-height);",
  "#progressionPage nav.pager > span#pageText {",
  "min-width: 0;",
  "margin-inline: var(--mfl-mobile-pager-page-gap);",
]) {
  invariant(sharedUi.includes(token), `Mobile pager scaling contract is missing: ${token}`);
}

invariant(
  !sharedUi.includes("#progressionPage nav.pager button {"),
  "Mobile pager buttons must target the real Previous/Next IDs rather than a generic button selector.",
);
invariant(
  !sharedUi.includes("#progressionPage nav.pager #pageText {\n    min-width: max-content;"),
  "Mobile page text must not retain an intrinsic-width spacer that hides the real button-to-text gap.",
);

console.log("Mobile pager scaling validation passed.");
