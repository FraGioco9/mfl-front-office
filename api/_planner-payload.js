const crypto = require("node:crypto");

const PLANNER_SCHEMA_VERSION = 1;
const MAX_PLAN_NAME_LENGTH = 60;
const MAX_PLAN_PLAYERS = 25;
const MAX_PLAN_LINEUP = 11;
const FORMATIONS = new Set([
  "3421","343","343b","352","352b","41212","41212narrow","4132","4141",
  "4222","4231","424","4312","4321","433","433a","433d","433cf","4411",
  "442","442b","523","532","541","541f",
]);

function normalizePlannerId(value) {
  const id = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{16}$/.test(id) ? id : "";
}

function generatePlannerId() {
  return crypto.randomBytes(8).toString("hex");
}

function normalizePlannerName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, MAX_PLAN_NAME_LENGTH);
}

function normalizePlannerClubId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : "";
}

function normalizePlannerPlayerId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : "";
}

function normalizeContract(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(20, Math.max(0, Math.round(number * 100) / 100));
}

function normalizeSquad(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const squad = [];
  let remainingContract = 100;
  for (const entry of source) {
    const playerId = normalizePlannerPlayerId(entry?.playerId ?? entry?.player_id ?? entry?.id);
    if (!playerId || seen.has(playerId)) continue;
    seen.add(playerId);
    const contract = Math.min(
      normalizeContract(entry?.contract ?? entry?.plannedContract ?? entry?.planned_contract_value),
      remainingContract,
    );
    remainingContract = Math.max(0, Math.round((remainingContract - contract) * 100) / 100);
    squad.push({ playerId, contract });
    if (squad.length >= MAX_PLAN_PLAYERS) break;
  }
  return squad;
}

function normalizeLineup(value, squadIds) {
  const source = Array.isArray(value) ? value : [];
  const usedSlots = new Set();
  const usedPlayers = new Set();
  const lineup = [];
  for (const entry of source) {
    const slotKey = String(entry?.slotKey ?? entry?.slot_key ?? "").trim().toUpperCase();
    const playerId = normalizePlannerPlayerId(entry?.playerId ?? entry?.player_id);
    if (!/^[A-Z]{2,3}#[1-9][0-9]?$/.test(slotKey) || !playerId || !squadIds.has(playerId)
      || usedSlots.has(slotKey) || usedPlayers.has(playerId)) continue;
    usedSlots.add(slotKey);
    usedPlayers.add(playerId);
    lineup.push({ slotKey, playerId });
    if (lineup.length >= MAX_PLAN_LINEUP) break;
  }
  return lineup;
}

function normalizePlannerPayload(value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const clubId = normalizePlannerClubId(data.clubId ?? data.club_id);
  const formation = String(data.formation || "").trim().toLowerCase();
  if (!clubId || !FORMATIONS.has(formation)) return null;
  const squad = normalizeSquad(data.squad);
  const squadIds = new Set(squad.map((entry) => entry.playerId));
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    clubId,
    formation,
    squad,
    lineup: normalizeLineup(data.lineup, squadIds),
  };
}

module.exports = {
  PLANNER_SCHEMA_VERSION,
  MAX_PLAN_NAME_LENGTH,
  MAX_PLAN_PLAYERS,
  normalizePlannerId,
  generatePlannerId,
  normalizePlannerName,
  normalizePlannerClubId,
  normalizePlannerPayload,
};
