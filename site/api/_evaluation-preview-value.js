const { normalizeLateSeasonRewardRates } = require("./_evaluation-payload");

const DEFAULT_EVALUATION_MFL_PER_USD = 400;

const BASE_CONTRACT_VALUES = Object.freeze({
  99: 84000,
  98: 78000,
  97: 72000,
  96: 60000,
  95: 48000,
  94: 39000,
  93: 30000,
  92: 24000,
  91: 18000,
  90: 15000,
  89: 12000,
  88: 9000,
  87: 7500,
  86: 6000,
  85: 4500,
  84: 3000,
  83: 2400,
  82: 1800,
  81: 1500,
  80: 1200,
  79: 1050,
  78: 900,
  77: 750,
  76: 600,
  75: 450,
  74: 360,
  73: 300,
  72: 240,
  71: 210,
  70: 180,
  69: 150,
  68: 135,
  67: 120,
  66: 108,
  65: 96,
  64: 84,
  63: 72,
  62: 60,
  61: 54,
  60: 48,
  59: 42,
  58: 37.5,
  57: 33,
  56: 33,
  55: 33,
  54: 33,
  53: 33,
  52: 33,
  51: 33,
  50: 33,
});

const POSITION_MULTIPLIERS = Object.freeze({
  GK: 1,
  LB: 1,
  CB: 1,
  RB: 4 / 3,
  LWB: 2 / 3,
  RWB: 2 / 3,
  CDM: 5 / 6,
  LM: 4 / 3,
  CM: 4 / 3,
  RM: 4 / 3,
  CAM: 5 / 6,
  CF: 1 / 2,
  LW: 1,
  RW: 1,
  ST: 4 / 3,
});

const EVALUATION_CONVERSIONS = Object.freeze({
  1: 300,
  2: 333,
  3: 333,
  4: 300,
  5: 225,
  6: 250,
  7: 333,
  8: 400,
  9: 450,
  10: 500,
  11: 475,
  12: 450,
  13: 450,
  14: 400,
});

function evaluationContractValue(overall, position) {
  const roundedOverall = Math.round(Number(overall));
  const baseValue = BASE_CONTRACT_VALUES[roundedOverall] || 0;
  const multiplier = POSITION_MULTIPLIERS[String(position || "").trim().toUpperCase()] || 0;
  return baseValue * multiplier;
}

function evaluationDiscountRateValueFromRatios(value, currentMflPerUsd) {
  const rows = (Array.isArray(value) ? value : [])
    .map((row) => ({ season: Number(row?.season), ratio: Number(row?.ratio) }))
    .filter((row) => Number.isInteger(row.season) && row.season > 0
      && Number.isFinite(row.ratio) && row.ratio > 0)
    .sort((a, b) => a.season - b.season)
    .slice(-4);

  if (rows.length !== 4) return null;
  if (!rows.every((row, index) => !index || row.season === rows[index - 1].season + 1)) return null;

  const currentValue = Number(currentMflPerUsd);
  if (!Number.isFinite(currentValue) || currentValue <= 0) return null;

  const factors = rows.slice(1).map((row, index) => row.ratio / rows[index].ratio);
  factors.push(currentValue / rows.at(-1).ratio);
  if (factors.some((factor) => !Number.isFinite(factor) || factor <= 0)) return null;

  const rate = Math.pow(factors.reduce((product, factor) => product * factor, 1), 1 / 4) - 1;
  return Number.isFinite(rate) ? rate : null;
}

function evaluationDiscountFactor(rate, season) {
  return Number.isFinite(rate) ? 1 / Math.pow(1 + rate, season) : null;
}

function evaluationMflMultiplierForSeason(rowIndex, expectedSeasons, rates) {
  const seasonsFromEnd = expectedSeasons - rowIndex;
  const normalizedRates = normalizeLateSeasonRewardRates(rates);

  if (seasonsFromEnd >= 1 && seasonsFromEnd <= 3) {
    return normalizedRates[3 - seasonsFromEnd] / 100;
  }

  return 1;
}

function evaluationExpectedSeasonsFromPlayer(playerContext = {}) {
  const playerId = Number(playerContext.playerId ?? playerContext.player_id);
  const age = Number(playerContext.age);
  const retirementYears = Number(playerContext.retirementYears ?? playerContext.retirement_years);

  if (Number.isFinite(retirementYears) && retirementYears > 0) {
    return retirementYears;
  }

  if (!Number.isFinite(age)) {
    return 0;
  }

  const averageRetirementAge = playerId <= 77848 ? 37 : 35;
  const yearsToAverageRetirement = averageRetirementAge - age;

  if (yearsToAverageRetirement <= 3) {
    return 4;
  }

  return Math.max(0, yearsToAverageRetirement);
}

function evaluationPresentValueTotalFromSharePayload(payload, playerContext = {}, ratioRows = []) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const overallValues = Array.isArray(data.overallValues)
    ? data.overallValues.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : Array.isArray(data.overall_values)
      ? data.overall_values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
  const position = String(data.summaryPosition || data.summary_position || "").trim().toUpperCase();
  const rawExpectedSeasons = overallValues.length || evaluationExpectedSeasonsFromPlayer(playerContext);

  if (!overallValues.length || !POSITION_MULTIPLIERS[position] || rawExpectedSeasons <= 0) return null;

  const seasonOffset = Boolean(data.ignoreFirstSeason ?? data.ignore_first_season) ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const parsedMflPerUsd = Number(data.mflPerUsd ?? data.mfl_per_usd);
  const mflPerUsd = Number.isFinite(parsedMflPerUsd) && parsedMflPerUsd > 0
    ? parsedMflPerUsd
    : DEFAULT_EVALUATION_MFL_PER_USD;
  const ignoreDiscountRate = Boolean(data.ignoreDiscountRate ?? data.ignore_discount_rate);
  const discountRate = ignoreDiscountRate
    ? 0
    : evaluationDiscountRateValueFromRatios(ratioRows, mflPerUsd);
  if (!ignoreDiscountRate && !Number.isFinite(discountRate)) return null;

  const rates = data.lateSeasonRewardRates
    ?? data.late_season_reward_rates
    ?? data.lateCareerRewardRates
    ?? data.late_career_reward_rates;
  let total = 0;

  for (let rowIndex = 0; rowIndex < expectedSeasons; rowIndex += 1) {
    const season = rowIndex + 1 + seasonOffset;
    const overall = overallValues[season - 1] ?? overallValues[0];
    const contractValue = evaluationContractValue(overall, position);
    const mflValue = contractValue * evaluationMflMultiplierForSeason(rowIndex, expectedSeasons, rates);
    const usdValue = Number.isFinite(mflValue) ? mflValue / mflPerUsd : null;
    const discountFactor = evaluationDiscountFactor(discountRate, season);
    const presentValue = Number.isFinite(usdValue) && Number.isFinite(discountFactor)
      ? usdValue * discountFactor
      : null;

    if (Number.isFinite(presentValue)) total += presentValue;
  }

  return Number.isFinite(total) ? total : null;
}

function formatEvaluationPreviewCurrency(value) {
  return Number.isFinite(value)
    ? `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
    : "";
}

module.exports = {
  EVALUATION_CONVERSIONS,
  evaluationContractValue,
  evaluationDiscountRateValueFromRatios,
  evaluationExpectedSeasonsFromPlayer,
  evaluationPresentValueTotalFromSharePayload,
  formatEvaluationPreviewCurrency,
};
