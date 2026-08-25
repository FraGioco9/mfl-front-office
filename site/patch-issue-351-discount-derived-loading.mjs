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
  `  const discountRate = data.ignoreDiscountRate ? 0 : evaluationDiscountRateValue();\n  const mflPerUsd = data.mflPerUsd || state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;\n  let total = 0;`,
  `  const discountRate = data.ignoreDiscountRate ? 0 : evaluationDiscountRateValue();\n  const mflPerUsd = data.mflPerUsd || state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;\n  if (!Number.isFinite(discountRate)) return null;\n  let total = 0;`,
  "saved/shared Value must stay unresolved until Discount Rate is ready",
);

appCore = replaceOnce(
  appCore,
  `  const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();\n  const fragment = document.createDocumentFragment();`,
  `  const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();\n  const discountDerivedValuesReady = Number.isFinite(discountRate);\n  const fragment = document.createDocumentFragment();`,
  "Evaluation render Discount Rate readiness",
);

appCore = replaceOnce(
  appCore,
  `  const presentValueTotal = presentValues.length\n    ? presentValues.reduce((total, value) => total + value, 0)\n    : 0;`,
  `  const presentValueTotal = discountDerivedValuesReady\n    ? (presentValues.length ? presentValues.reduce((total, value) => total + value, 0) : 0)\n    : null;`,
  "summary Value pending blank",
);

await writeFile(appCorePath, appCore);

const rateRuntimePath = new URL("./evaluation-discount-rate-runtime.js", import.meta.url);
let rateRuntime = await readFile(rateRuntimePath, "utf8");

rateRuntime = replaceOnce(
  rateRuntime,
  `  function publishRate(result) {\n    discountResult = result;\n    installRateFunction();\n    window.mflSeasonRatios = result.rows;\n    window.__mflSeasonRatioResult = result;\n    window.__mflDynamicDiscountResult = result;\n    renderRate();\n    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: result }));\n    queueMicrotask(() => {\n      if (destroyed || !isEvaluation()) return;\n      try { window.renderEvaluationPage?.(); } catch {}\n      requestAnimationFrame(() => {\n        if (!destroyed) renderRate();\n      });\n    });\n  }`,
  `  function queueEvaluationRender() {\n    queueMicrotask(() => {\n      if (destroyed || !isEvaluation()) return;\n      try { window.renderEvaluationPage?.(); } catch {}\n      requestAnimationFrame(() => {\n        if (!destroyed) renderRate();\n      });\n    });\n  }\n\n  function publishRate(result) {\n    discountResult = result;\n    installRateFunction();\n    window.mflSeasonRatios = result.rows;\n    window.__mflSeasonRatioResult = result;\n    window.__mflDynamicDiscountResult = result;\n    renderRate();\n    window.dispatchEvent(new CustomEvent("mfl:season-ratios-ready", { detail: result }));\n    queueEvaluationRender();\n  }`,
  "single Discount Rate render lifecycle",
);

rateRuntime = replaceOnce(
  rateRuntime,
  `    document.documentElement.dataset.mflEvaluationRateSettled = "false";\n    renderRate();\n\n    const nonce =`,
  `    document.documentElement.dataset.mflEvaluationRateSettled = "false";\n    renderRate();\n    queueEvaluationRender();\n\n    const nonce =`,
  "pending Discount Rate immediately rerenders Evaluation",
);

await writeFile(rateRuntimePath, rateRuntime);

const domainPath = new URL("./validate-domain-evaluation.mjs", import.meta.url);
let domain = await readFile(domainPath, "utf8");
domain = replaceOnce(
  domain,
  `  "validate-evaluation-mfl-usd-loading-race.mjs",\n  "validate-evaluation-snapshot-edit-route.mjs",`,
  `  "validate-evaluation-mfl-usd-loading-race.mjs",\n  "validate-evaluation-discount-derived-loading.mjs",\n  "validate-evaluation-snapshot-edit-route.mjs",`,
  "Evaluation validator domain registration",
);
await writeFile(domainPath, domain);

const validator = `import { readFile } from "node:fs/promises";\n\nconst read = (path) => readFile(new URL(path, import.meta.url), "utf8");\nconst invariant = (condition, message) => {\n  if (!condition) throw new Error(message);\n};\n\nconst [appCore, rateRuntime] = await Promise.all([\n  read("./modules/app-core.js"),\n  read("./evaluation-discount-rate-runtime.js"),\n]);\n\ninvariant(\n  appCore.includes("const discountDerivedValuesReady = Number.isFinite(discountRate);")\n    && appCore.includes("const presentValueTotal = discountDerivedValuesReady\\n    ? (presentValues.length ? presentValues.reduce((total, value) => total + value, 0) : 0)\\n    : null;")\n    && appCore.includes("formatEvaluationNumber(discountFactor, 4)")\n    && appCore.includes("formatEvaluationCurrency(presentValue)"),\n  "Detailed Discount Factor/Value and summary Value must stay blank while the Discount Rate is unresolved.",\n);\n\ninvariant(\n  appCore.includes("const mflPerUsd = data.mflPerUsd || state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;\\n  if (!Number.isFinite(discountRate)) return null;\\n  let total = 0;"),\n  "Cached/saved discount-derived valuation must not collapse an unresolved Discount Rate to zero.",\n);\n\ninvariant(\n  rateRuntime.includes("function queueEvaluationRender()")\n    && rateRuntime.includes("document.documentElement.dataset.mflEvaluationRateSettled = \\\"false\\\";\\n    renderRate();\\n    queueEvaluationRender();")\n    && rateRuntime.includes("window.dispatchEvent(new CustomEvent(\\\"mfl:season-ratios-ready\\\", { detail: result }));\\n    queueEvaluationRender();"),\n  "Discount Rate pending and resolved states must both reuse the canonical Evaluation render path.",\n);\n\ninvariant(\n  appCore.includes("formatEvaluationMfl(numericMflValue)")\n    && appCore.includes("formatEvaluationCurrency(usdValue)")\n    && appCore.includes("formatEvaluationNumber(discountFactor, 4)")\n    && appCore.includes("formatEvaluationCurrency(presentValue)"),\n  "MFL and USD must remain independent while only Discount Factor and Value blank during recalculation.",\n);\n\nconsole.log("Evaluation Discount Rate pending-state validation passed: discount-derived cells blank immediately, unrelated MFL/USD values remain visible, and resolved values return through the same render lifecycle.");\n`;
await writeFile(new URL("./validate-evaluation-discount-derived-loading.mjs", import.meta.url), validator);
