import { readFile, writeFile } from "node:fs/promises";

const replaceOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
};

const appCorePath = new URL("./modules/app-core.js", import.meta.url);
let appCore = await readFile(appCorePath, "utf8");

appCore = replaceOnce(
  appCore,
  `function commitEvaluationMflPerUsdValue(value) {\n  saveEvaluationMflPerUsd(value);\n  state.evaluationMflPerUsdRevision += 1;\n}`,
  `function commitEvaluationMflPerUsdValue(value) {\n  const previousMflPerUsd = state.evaluationMflPerUsd;\n  saveEvaluationMflPerUsd(value);\n  state.evaluationMflPerUsdRevision += 1;\n  if (state.currentPage === "evaluation" && state.evaluationMflPerUsd !== previousMflPerUsd) {\n    void window.__mflEvaluationDiscountRateRuntime?.refresh?.();\n  }\n}`,
  "MFL/USD commit starts Discount Rate pending state synchronously",
);

appCore = replaceOnce(
  appCore,
  `function evaluationTableRenderSignature(row) {\n  const playerId = String(getValue(row, "player_id") || "");\n  return JSON.stringify([\n    state.columns,\n    row,\n    state.evaluationIgnoreDiscountRate,\n    state.evaluationIgnoreFirstSeason,\n    state.evaluationMflPerUsd,\n    state.evaluationLateSeasonRewardRates,`,
  `function evaluationTableRenderSignature(row) {\n  const playerId = String(getValue(row, "player_id") || "");\n  const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();\n  return JSON.stringify([\n    state.columns,\n    row,\n    state.evaluationIgnoreDiscountRate,\n    state.evaluationIgnoreFirstSeason,\n    state.evaluationMflPerUsd,\n    discountRate,\n    state.evaluationLateSeasonRewardRates,`,
  "Evaluation reuse signature tracks Discount Rate pending/resolved state",
);

await writeFile(appCorePath, appCore);

const validatorPath = new URL("./validate-evaluation-discount-derived-loading.mjs", import.meta.url);
let validator = await readFile(validatorPath, "utf8");

validator = replaceOnce(
  validator,
  `invariant(\n  rateRuntime.includes("function queueEvaluationRender()")\n    && rateRuntime.includes("document.documentElement.dataset.mflEvaluationRateSettled = \\\"false\\\";\\n    renderRate();\\n    queueEvaluationRender();")\n    && rateRuntime.includes("window.dispatchEvent(new CustomEvent(\\\"mfl:season-ratios-ready\\\", { detail: result }));\\n    queueEvaluationRender();"),\n  "Discount Rate pending and resolved states must both reuse the canonical Evaluation render path.",\n);`,
  `invariant(\n  rateRuntime.includes("function queueEvaluationRender()")\n    && rateRuntime.includes("document.documentElement.dataset.mflEvaluationRateSettled = \\\"false\\\";\\n    renderRate();\\n    queueEvaluationRender();")\n    && rateRuntime.includes("window.dispatchEvent(new CustomEvent(\\\"mfl:season-ratios-ready\\\", { detail: result }));\\n    queueEvaluationRender();"),\n  "Discount Rate pending and resolved states must both reuse the canonical Evaluation render path.",\n);\n\ninvariant(\n  appCore.includes('const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();\\n  return JSON.stringify([')\n    && appCore.includes("state.evaluationMflPerUsd,\\n    discountRate,\\n    state.evaluationLateSeasonRewardRates,"),\n  "Evaluation render reuse must treat Discount Rate resolved -> pending -> resolved as three distinct render signatures.",\n);\n\ninvariant(\n  appCore.includes('const previousMflPerUsd = state.evaluationMflPerUsd;')\n    && appCore.includes('if (state.currentPage === "evaluation" && state.evaluationMflPerUsd !== previousMflPerUsd) {\\n    void window.__mflEvaluationDiscountRateRuntime?.refresh?.();\\n  }'),\n  "A committed MFL/USD change must synchronously start Discount Rate recalculation before the caller renders derived values.",\n);`,
  "regression coverage for the render-reuse failure path",
);

validator = validator.replace(
  'console.log("Evaluation Discount Rate pending-state validation passed: discount-derived cells blank immediately, unrelated MFL/USD values remain visible, and resolved values return through the same render lifecycle.");',
  'console.log("Evaluation Discount Rate pending-state validation passed: MFL/USD commits synchronously invalidate the rate, render reuse tracks pending/resolved rate identity, discount-derived cells blank immediately, and resolved values return through the same render lifecycle.");',
);

await writeFile(validatorPath, validator);
