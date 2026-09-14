import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [controls, stylesBase] = await Promise.all([
  read("./controls.css"),
  read("./styles-base.css"),
]);

for (const selector of [
  ".evaluationMflUsdInput:focus:not(:disabled)",
  ".evaluationMflUsdInput:focus-visible:not(:disabled)",
  ".advancedMflUsdInput:focus:not(:disabled)",
  ".advancedMflUsdInput:focus-visible:not(:disabled)",
]) {
  invariant(
    controls.includes(selector),
    `controls.css is missing canonical MFL/USD focus selector: ${selector}`,
  );
}

const terminalSelector = ".advancedMflUsdInput:focus-visible:not(:disabled)";
const selectorIndex = controls.indexOf(terminalSelector);
const blockStart = controls.indexOf("{", selectorIndex);
const blockEnd = controls.indexOf("}", blockStart);
const focusBlock = blockStart >= 0 && blockEnd > blockStart
  ? controls.slice(blockStart + 1, blockEnd)
  : "";

for (const declaration of [
  "outline: 0;",
  "border-color: var(--primary-hover);",
  "background: var(--row-hover);",
  "color: var(--text);",
  "box-shadow: none;",
]) {
  invariant(
    focusBlock.includes(declaration),
    `MFL/USD focus state must use canonical shared declaration: ${declaration}`,
  );
}

invariant(
  !stylesBase.includes(".evaluationMflUsdInput:focus"),
  "MFL/USD focus state must remain owned by controls.css, not styles-base.css.",
);
invariant(
  !controls.includes("!important"),
  "Canonical shared controls must not use !important.",
);

console.log("MFL/USD canonical focus-highlight validation passed.");
