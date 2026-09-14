const crypto = require("crypto");

const DEFAULT_EVALUATION_MFL_PER_USD = 400;
const DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES = Object.freeze([80, 80, 60]);

function normalizeEvaluationId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
}

function generateEvaluationId() {
  return crypto.randomBytes(4).toString("hex");
}

function parseEvaluationRewardRate(value) {
  const parsedValue = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 100
    ? Math.round(parsedValue * 100) / 100
    : null;
}

function normalizeLateSeasonRewardRates(value) {
  const source = Array.isArray(value) ? value : [];
  return DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES.map((defaultRate, index) => {
    const parsedRate = parseEvaluationRewardRate(source[index]);
    return parsedRate === null ? defaultRate : parsedRate;
  });
}

function evaluationLateSeasonRewardRates(data) {
  if (Array.isArray(data?.lateSeasonRewardRates)) return data.lateSeasonRewardRates;
  if (Array.isArray(data?.late_season_reward_rates)) return data.late_season_reward_rates;
  if (Array.isArray(data?.lateCareerRewardRates)) return data.lateCareerRewardRates;
  if (Array.isArray(data?.late_career_reward_rates)) return data.late_career_reward_rates;
  return [];
}

function normalizeEvaluationPayload(payload, options = {}) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const playerId = String(data.playerId || "").trim();
  const mflPerUsd = Number(data.mflPerUsd);
  const overallValues = Array.isArray(data.overallValues)
    ? data.overallValues.map((value) => Number(value)).filter((value) => Number.isFinite(value)).slice(0, 40)
    : [];
  const summaryPosition = String(data.summaryPosition || "").trim().slice(0, 12);

  if (!playerId) return null;

  const normalized = {
    playerId,
    mflPerUsd: Number.isFinite(mflPerUsd) && mflPerUsd > 0
      ? Math.round(mflPerUsd * 100) / 100
      : DEFAULT_EVALUATION_MFL_PER_USD,
    ignoreDiscountRate: Boolean(data.ignoreDiscountRate),
    ignoreFirstSeason: Boolean(data.ignoreFirstSeason),
    lateSeasonRewardRates: normalizeLateSeasonRewardRates(evaluationLateSeasonRewardRates(data)),
    overallValues,
    summaryPosition,
  };

  if (options.includeSummaryMetrics === true) {
    const summaryOverall = Number(data.summaryOverall);
    const summaryAge = Number(data.summaryAge);
    normalized.summaryOverall = Number.isFinite(summaryOverall) ? Math.round(summaryOverall) : null;
    normalized.summaryAge = Number.isFinite(summaryAge) ? Math.round(summaryAge) : null;
  }

  return normalized;
}

module.exports = {
  normalizeEvaluationId,
  generateEvaluationId,
  normalizeLateSeasonRewardRates,
  normalizeEvaluationPayload,
};
