import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles-base.css", import.meta.url), "utf8");

const requiredRules = [
  'input[type="checkbox"] {',
  'appearance: none;',
  '-webkit-appearance: none;',
  'width: 16px;',
  'height: 16px;',
  'border: 1px solid var(--border-strong);',
  'border-radius: 4px;',
  'background-color: var(--surface);',
  'cursor: pointer;',
  'input[type="checkbox"]:hover:not(:disabled) {',
  'input[type="checkbox"]:checked {',
  'background-color: var(--primary);',
  'input[type="checkbox"]:indeterminate {',
  'input[type="checkbox"]:focus-visible {',
  'box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary);',
  'input[type="checkbox"]:disabled {',
  'cursor: not-allowed;',
];

for (const rule of requiredRules) {
  if (!css.includes(rule)) {
    throw new Error(`Shared checkbox styling is missing required contract: ${rule}`);
  }
}

const legacyDimensionBlocks = [
  /\.quickFilters input\s*\{[^}]*\b(?:width|height):/s,
  /\.evaluationOptionFilters input\s*\{[^}]*\b(?:width|height):/s,
  /\.settingsCheckbox input\s*\{[^}]*\b(?:width|height):/s,
  /\.selectionCell input\s*\{[^}]*\b(?:width|height):/s,
];

for (const legacy of legacyDimensionBlocks) {
  if (legacy.test(css)) {
    throw new Error(`Checkbox sizing must remain owned by the shared checkbox rule: ${legacy}`);
  }
}

if (css.includes('input[type="checkbox"] !important')) {
  throw new Error("Shared checkbox styling must not use !important.");
}

console.log("Shared checkbox styling validation passed.");
