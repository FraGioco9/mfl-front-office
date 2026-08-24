const { queryOne } = require("./_database");
const { normalizeEvaluationId } = require("./_evaluation-payload");
const {
  evaluationPresentValueTotalFromSharePayload,
  formatEvaluationPreviewCurrency,
} = require("./_evaluation-preview-value");
const { loadRatiosFromSupabase } = require("./mfl-season-ratios-v2");
const { supabaseRequest } = require("./_supabase");

const GENERIC_PREVIEW = Object.freeze({
  title: "Shared Evaluation - MFL Front Office",
  description: "Open a shared MFL Front Office player Evaluation.",
  isShared: false,
  playerId: "",
  playerName: "",
  overall: null,
  position: "",
  age: null,
  presentValue: null,
});

function normalizedPlayerId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function normalizedPlayerName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function normalizedPosition(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 12);
}

function roundedMetric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function numericMetric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicPlayerPreview(playerIdValue) {
  const playerId = normalizedPlayerId(playerIdValue);
  if (!playerId) return { playerId: "", playerName: "", age: null, retirementYears: null };

  try {
    const row = queryOne(
      "SELECT name, age, retirement_years FROM players WHERE player_id = ? LIMIT 1",
      [playerId],
    );
    return {
      playerId,
      playerName: normalizedPlayerName(row?.name),
      age: roundedMetric(row?.age),
      retirementYears: roundedMetric(row?.retirement_years),
    };
  } catch (error) {
    console.warn("Could not read public player context for Evaluation preview.", error);
    return { playerId, playerName: "", age: null, retirementYears: null };
  }
}

async function readActiveEvaluationShare(idValue, playerIdValue = "") {
  const id = normalizeEvaluationId(idValue);
  if (!id) return null;

  const playerId = normalizedPlayerId(playerIdValue);
  const playerFilter = playerId ? `&player_id=eq.${encodeURIComponent(playerId)}` : "";
  const rows = await supabaseRequest(
    `evaluation_shares?select=id,player_id,payload,expires_at&id=eq.${encodeURIComponent(id)}${playerFilter}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) return null;
  return {
    id: normalizeEvaluationId(row.id),
    playerId: normalizedPlayerId(row.player_id),
    payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {},
    expiresAt: String(row.expires_at || ""),
  };
}

function evaluationSharePreviewFromContext(row, publicPlayer = {}, ratioRows = []) {
  if (!row?.id || !row?.playerId) return { ...GENERIC_PREVIEW };

  const payload = row.payload || {};
  const playerId = normalizedPlayerId(row.playerId);
  const payloadPlayerName = normalizedPlayerName(
    payload.summaryPlayerName
      || payload.summary_player_name
      || payload.playerName
      || payload.player_name,
  );
  const playerName = normalizedPlayerName(publicPlayer.playerName) || payloadPlayerName;
  const position = normalizedPosition(payload.summaryPosition || payload.summary_position);
  const values = Array.isArray(payload.overallValues)
    ? payload.overallValues
    : Array.isArray(payload.overall_values)
      ? payload.overall_values
      : [];
  const seasonOffset = Boolean(payload.ignoreFirstSeason ?? payload.ignore_first_season) ? 1 : 0;
  const explicitOverall = roundedMetric(payload.summaryOverall ?? payload.summary_overall);
  const derivedOverall = roundedMetric(values[seasonOffset] ?? values[0]);
  const overall = explicitOverall ?? derivedOverall;
  const age = roundedMetric(publicPlayer.age);
  const explicitPresentValue = numericMetric(payload.summaryPresentValue ?? payload.summary_present_value);
  const presentValue = explicitPresentValue ?? evaluationPresentValueTotalFromSharePayload(payload, {
    playerId,
    age,
    retirementYears: publicPlayer.retirementYears,
  }, ratioRows);
  const subject = playerName || `Player ${playerId}`;

  const details = [];
  if (overall !== null) details.push(`Overall ${overall}`);
  if (position) details.push(`Position ${position}`);
  if (age !== null) details.push(`Age ${age}`);
  if (presentValue !== null) details.push(`Value ${formatEvaluationPreviewCurrency(presentValue)}`);

  return {
    title: `${subject} Evaluation - MFL Front Office`,
    description: `Shared MFL Front Office Evaluation for ${subject}${playerName ? ` (#${playerId})` : ""}${details.length ? ` - ${details.join(" · ")}` : ""}.`,
    isShared: true,
    playerId,
    playerName,
    overall,
    position,
    age,
    presentValue,
  };
}

async function evaluationSharePreview(row) {
  if (!row?.id || !row?.playerId) return { ...GENERIC_PREVIEW };

  const payload = row.payload || {};
  const explicitPresentValue = numericMetric(payload.summaryPresentValue ?? payload.summary_present_value);
  const ignoreDiscountRate = Boolean(payload.ignoreDiscountRate ?? payload.ignore_discount_rate);
  let ratioRows = [];

  if (explicitPresentValue === null && !ignoreDiscountRate) {
    try {
      ratioRows = await loadRatiosFromSupabase();
    } catch (error) {
      console.warn("Could not load live MFL season ratios for Evaluation preview.", error);
    }
  }

  return evaluationSharePreviewFromContext(row, publicPlayerPreview(row.playerId), ratioRows);
}

module.exports = {
  GENERIC_PREVIEW,
  readActiveEvaluationShare,
  evaluationSharePreview,
  evaluationSharePreviewFromContext,
};
