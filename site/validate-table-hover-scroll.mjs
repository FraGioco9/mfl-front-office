import { readFile } from "node:fs/promises";

const [runtime, styles] = await Promise.all([
  readFile(new URL("./shared-table-ui-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("./styles-base.css", import.meta.url), "utf8"),
]);
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

invariant(
  runtime.includes('function clearTableHoverState()')
    && runtime.includes('body.dispatchEvent(new Event("pointerleave"));'),
  "Shared table UI must clear the canonical hovered-row state through the existing pointerleave lifecycle.",
);

invariant(
  runtime.includes('const scrollContainer = document.querySelector("main");')
    && runtime.includes('scrollContainer?.addEventListener("scroll", onScroll, { passive: true });')
    && runtime.includes('scrollContainer?.removeEventListener("scroll", onScroll);'),
  "Shared table UI must bind hover clearing directly to the page scroll container and clean the listener up on destroy.",
);

invariant(
  !styles.includes('#tableBody tr:hover > td')
    && !styles.includes('#tableBody tr:hover > th')
    && styles.includes('#tableBody tr.tableRowHovered > td')
    && styles.includes('#tableBody tr.tableRowHovered > th'),
  "Player table row highlighting must have one owner: the JavaScript-managed tableRowHovered state, not native tr:hover.",
);

console.log("Table row hover clears on page scroll and is owned only by the managed hover state.");
