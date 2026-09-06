import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [appCore, rateRuntime, indexHtml] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./evaluation-discount-rate-runtime.js"),
  read("./index.html"),
]);

invariant(
  !appCore.includes("const evaluationConversions = {")
    && !appCore.includes("currentSeason = 15, seasonsToAverage = 5")
    && appCore.includes("function evaluationDiscountRateValue() {\n  const liveRate = window.__mflSupabaseDiscountRateFunction?.();\n  return Number.isFinite(liveRate) ? liveRate : null;\n}")
    && !indexHtml.includes("last five completed seasons"),
  "Evaluation Discount Rate must have no legacy static conversion fallback or stale first-paint tooltip; unresolved state must wait for the live authority.",
);

invariant(
  appCore.includes("const discountDerivedValuesReady = Number.isFinite(discountRate);")
    && appCore.includes("const presentValueTotal = discountDerivedValuesReady\n    ? (presentValues.length ? presentValues.reduce((total, value) => total + value, 0) : 0)\n    : null;")
    && appCore.includes("formatEvaluationNumber(discountFactor, 4)")
    && appCore.includes("formatEvaluationCurrency(presentValue)"),
  "Detailed Discount Factor/Value and summary Value must stay blank while the Discount Rate is unresolved.",
);

invariant(
  appCore.includes("const mflPerUsd = data.mflPerUsd || state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;\n  if (!Number.isFinite(discountRate)) return null;\n  let total = 0;"),
  "Cached/saved discount-derived valuation must not collapse an unresolved Discount Rate to zero.",
);

invariant(
  rateRuntime.includes("function queueEvaluationRender()")
    && rateRuntime.includes("document.documentElement.dataset.mflEvaluationRateSettled = \"false\";\n    renderRate();\n    queueEvaluationRender();")
    && rateRuntime.includes("window.dispatchEvent(new CustomEvent(\"mfl:season-ratios-ready\", { detail: result }));\n    queueEvaluationRender();"),
  "Discount Rate pending and resolved states must both reuse the canonical Evaluation render path.",
);

invariant(
  appCore.includes('const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();\n  return JSON.stringify([')
    && appCore.includes("state.evaluationMflPerUsd,\n    discountRate,\n    state.evaluationLateSeasonRewardRates,"),
  "Evaluation render reuse must treat Discount Rate resolved -> pending -> resolved as three distinct render signatures.",
);

invariant(
  appCore.includes('const previousMflPerUsd = state.evaluationMflPerUsd;')
    && appCore.includes('if (state.currentPage === "evaluation" && state.evaluationMflPerUsd !== previousMflPerUsd) {\n    void window.__mflEvaluationDiscountRateRuntime?.refresh?.();\n  }'),
  "A committed MFL/USD change must synchronously start Discount Rate recalculation before the caller renders derived values.",
);

invariant(
  appCore.includes("formatEvaluationMfl(numericMflValue)")
    && appCore.includes("formatEvaluationCurrency(usdValue)")
    && appCore.includes("formatEvaluationNumber(discountFactor, 4)")
    && appCore.includes("formatEvaluationCurrency(presentValue)"),
  "MFL and USD must remain independent while only Discount Factor and Value blank during recalculation.",
);

console.log("Evaluation Discount Rate pending-state validation passed: MFL/USD commits synchronously invalidate the rate, render reuse tracks pending/resolved rate identity, discount-derived cells blank immediately, and resolved values return through the same render lifecycle.");
