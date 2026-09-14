import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const dropdowns = await read("./dropdowns.css");

const ruleSource = (selector) => {
  const start = dropdowns.indexOf(selector);
  if (start < 0) return "";
  const blockStart = dropdowns.indexOf("{", start);
  const blockEnd = dropdowns.indexOf("}", blockStart);
  return blockStart >= 0 && blockEnd > blockStart ? dropdowns.slice(start, blockEnd + 1) : "";
};

for (const [selector, label] of [
  ['#accountButton[aria-expanded="true"]', "Account dropdown trigger"],
  ['.playerHeroActionMenuButton[aria-expanded="true"]', "Player-page action chevron"],
  ['.playerTableActionsButton[aria-expanded="true"]', "Player-table three-dots trigger"],
]) {
  const source = ruleSource(selector);
  invariant(source, `${label} must define an explicit open state.`);
  invariant(
    source.includes("border-color: var(--primary-hover);")
      && source.includes("background: var(--primary-hover);")
      && source.includes("color: #ffffff;"),
    `${label} must retain its hover highlight while its menu is open.`,
  );
}

invariant(
  dropdowns.includes('.watchlistButton[aria-expanded="true"] {')
    && dropdowns.includes("background: var(--row-hover);"),
  "Existing watchlist open-state highlighting must remain unchanged.",
);

console.log("Dropdown trigger open-state highlight validation passed.");
