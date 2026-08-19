import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./validate-table-column-layout.mjs", import.meta.url);
let source = await readFile(path, "utf8");

source = source.replace(
  "const [styles, stylesBase, tableWidthRuntime, tableLoadingRuntime, staticUiRuntime, bootstrap, bootstrapCore, indexHtml, responsive, appCoreNormalizer] = await Promise.all([",
  "const [styles, stylesBase, tableWidthRuntime, tableLoadingRuntime, staticUiRuntime, bootstrap, bootstrapCore, indexHtml, responsive, coreSource] = await Promise.all([",
);
const oldRead = '  read("./modules/app-core-normalizer.js"),';
const newRead = '  read("./modules/app-core.js"),';
if (!source.includes(oldRead)) throw new Error("Table layout validator legacy normalizer read was not found.");
source = source.replace(oldRead, newRead);

const oldBlock = [
  "invariant(",
  '  appCoreNormalizer.includes("removeLegacyTableWidthOwnership(nextSource)"),',
  '  "Generated application core must remove its raw legacy table-width owner before execution.",',
  ");",
  "invariant(",
  '  appCoreNormalizer.includes("const alreadyCanonical = existingCols.length === targetClasses.length")',
  '  && appCoreNormalizer.includes("if (alreadyCanonical) return;"),',
  '  "Canonical colgroup ownership must be idempotent and preserve an already-correct first-paint colgroup.",',
  ");",
  "invariant(",
  "  !appCoreNormalizer.includes('const layoutOnlyClubFinish = `  function finishClubSwitch() {\\n    return new Promise((resolve) => {\\n      requestAnimationFrame(() => {\\n        if (typeof buildTableColGroup === \"function\") buildTableColGroup();'),",
  '  "Club completion must not rebuild an already-rendered colgroup.",',
  ");",
].join("\n");
const newBlock = [
  "invariant(",
  '  !coreSource.includes("applyExactPlayerTableWidths") && !coreSource.includes("__mflTableWidthRuntime"),',
  '  "Canonical application core must not retain the historical runtime table-width owner.",',
  ");",
  "invariant(",
  '  coreSource.includes("const alreadyCanonical = existingCols.length === targetClasses.length")',
  '  && coreSource.includes("if (alreadyCanonical) return;"),',
  '  "Canonical colgroup ownership must be idempotent and preserve an already-correct first-paint colgroup.",',
  ");",
  "invariant(",
  '  !coreSource.includes("if (typeof buildTableColGroup === \\\"function\\\") buildTableColGroup();"),',
  '  "Club completion must not rebuild an already-rendered colgroup.",',
  ");",
].join("\n");
if (!source.includes(oldBlock)) throw new Error("Table layout validator legacy normalizer ownership block was not found.");
source = source.replace(oldBlock, newBlock);
await writeFile(path, source, "utf8");

const stylesBasePath = new URL("./styles-base.css", import.meta.url);
let stylesBase = await readFile(stylesBasePath, "utf8");
let removedEvaluationWidths = 0;
stylesBase = stylesBase.replace(
  /\.evaluation(?:Summary)?Table[^,{]*:nth-child\([^)]*\)[^{]*\{[^}]*\bwidth\s*:[^}]*\}/gs,
  (rule) => {
    removedEvaluationWidths += 1;
    const cleaned = rule.replace(/\s*\bwidth\s*:[^;}]+;?/g, "");
    return /\{\s*\}/s.test(cleaned) ? "" : cleaned;
  },
);
if (!removedEvaluationWidths) {
  throw new Error("No legacy Evaluation nth-child width ownership was found in styles-base.css.");
}
await writeFile(stylesBasePath, stylesBase, "utf8");
