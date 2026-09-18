const formations = require("../planner-formations.json");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ENTITY_ID = /^[1-9][0-9]{0,14}$/;
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

function planId(value) {
  return typeof value === "string" && UUID.test(value) ? value : "";
}

function normalizePlan(value) {
  if (!record(value) || typeof value.name !== "string") return null;
  const name = value.name.trim();
  const clubId = String(value.clubId ?? "");
  const formation = formations.find(item => item.id === value.formationId);
  if (!name || name.length > 80 || !ENTITY_ID.test(clubId) || !formation || !record(value.assignments)) return null;
  const slots = new Set(formation.slots.map(slot => slot.id));
  const players = new Set();
  const assignments = {};
  for (const [slot, rawId] of Object.entries(value.assignments)) {
    const playerId = String(rawId ?? "");
    if (!slots.has(slot) || !ENTITY_ID.test(playerId) || players.has(playerId)) return null;
    assignments[slot] = playerId;
    players.add(playerId);
  }
  return { name, clubId, formationId: formation.id, assignments };
}

function planColumns(plan) {
  return { name: plan.name, club_id: plan.clubId, formation_id: plan.formationId, assignments: plan.assignments };
}

function presentPlan(row, wallet) {
  return {
    id: row.id,
    name: row.name,
    clubId: row.club_id,
    formationId: row.formation_id,
    assignments: row.assignments,
    visibility: row.visibility,
    revision: row.revision,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: Boolean(wallet && row.wallet_address === wallet),
  };
}

module.exports = { planId, normalizePlan, planColumns, presentPlan };
