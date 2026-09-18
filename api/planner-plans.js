const { randomUUID } = require("node:crypto");
const { signedWalletFromRequest } = require("./_wallet-auth");
const { supabaseConfig, supabaseRequest } = require("./_supabase");
const { readJsonBody, sendRequestBodyError } = require("./_request-body");
const { requestOrigin } = require("./wallet-session");
const { planId, normalizePlan, planColumns, presentPlan } = require("./_planner-plan");

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PAGE_SIZE = 50;
const MAX_BODY_BYTES = 16 * 1024;
const fields = "id,wallet_address,name,club_id,formation_id,assignments,visibility,revision,schema_version,created_at,updated_at";
const encoded = encodeURIComponent;
const ownerFilter = wallet => `wallet_address=eq.${encoded(wallet)}`;
const idFilter = id => `id=eq.${encoded(id)}`;
const first = rows => Array.isArray(rows) ? rows[0] : null;

async function readOwned(id, wallet) {
  return first(await supabaseRequest(`planner_plans?select=${fields}&${idFilter(id)}&${ownerFilter(wallet)}&limit=1`));
}

async function readVisible(id, wallet) {
  if (wallet) {
    const owned = await readOwned(id, wallet);
    if (owned) return owned;
  }
  return first(await supabaseRequest(`planner_plans?select=${fields}&${idFilter(id)}&visibility=eq.unlisted&limit=1`));
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const fail = (status, error) => response.status(status).json({ error });
  if (!METHODS.includes(request.method)) {
    response.setHeader("Allow", METHODS.join(", "));
    return fail(405, "Method not allowed.");
  }
  if (!supabaseConfig()) return fail(503, "Planner storage is not configured.");

  try {
    const url = new URL(request.url, "http://localhost");
    const id = planId(url.searchParams.get("id"));
    if (url.searchParams.has("id") && !id) return fail(400, "Invalid plan ID.");
    const wallet = await signedWalletFromRequest(request);
    if (request.method === "GET") {
      if (id) {
        const row = await readVisible(id, wallet);
        if (!row) return fail(404, "Plan not found.");
        return response.status(200).json({ plan: presentPlan(row, wallet) });
      }
      if (!wallet) return fail(401, "Opt in to use saved plans.");
      const rawOffset = url.searchParams.get("offset") || "0";
      if (!/^(0|[1-9][0-9]{0,6})$/.test(rawOffset)) return fail(400, "Invalid list offset.");
      const offset = Number(rawOffset);
      const rows = await supabaseRequest(`planner_plans?select=${fields}&${ownerFilter(wallet)}&order=updated_at.desc,id.asc&limit=${PAGE_SIZE + 1}&offset=${offset}`);
      return response.status(200).json({
        plans: rows.slice(0, PAGE_SIZE).map(row => presentPlan(row, wallet)),
        nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
      });
    }

    if (!wallet) return fail(401, "Opt in to use saved plans.");
    let origin;
    try { origin = requestOrigin(request); } catch { return fail(403, "Invalid request origin."); }
    if (request.headers?.origin !== origin) return fail(403, "Invalid request origin.");
    if (String(request.headers?.["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
      return fail(415, "Use application/json.");
    }
    const body = await readJsonBody(request, { maxBytes: MAX_BODY_BYTES });
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Invalid plan payload.");

    if (request.method === "POST") {
      if (id) return fail(400, "Use PUT to update a saved plan.");
      let plan;
      if (Object.hasOwn(body, "sourceId")) {
        const sourceId = planId(body.sourceId);
        if (!sourceId) return fail(400, "Invalid source plan ID.");
        const source = await readVisible(sourceId, wallet);
        if (!source) return fail(404, "Plan not found.");
        plan = normalizePlan(presentPlan(source, wallet));
      } else {
        plan = normalizePlan(body);
      }
      if (!plan) return fail(400, "Invalid plan payload.");
      const rows = await supabaseRequest("planner_plans", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: randomUUID(), wallet_address: wallet, ...planColumns(plan),
          visibility: "private", revision: 1, schema_version: 1,
        }),
      });
      const row = first(rows);
      if (!row) throw new Error("Planner insert returned no row.");
      return response.status(201).json({ plan: presentPlan(row, wallet) });
    }

    if (!id) return fail(400, "Missing plan ID.");
    if (!Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision >= 2147483647) {
      return fail(400, "Missing or invalid plan revision.");
    }
    let patch = {};
    if (request.method === "PUT") {
      const plan = normalizePlan(body);
      if (!plan) return fail(400, "Invalid plan payload.");
      patch = planColumns(plan);
    } else if (request.method === "PATCH") {
      if (typeof body.shared !== "boolean") return fail(400, "Specify whether the plan is shared.");
      patch = { visibility: body.shared ? "unlisted" : "private" };
    }
    const rows = await supabaseRequest(`planner_plans?${idFilter(id)}&${ownerFilter(wallet)}&revision=eq.${body.revision}`, {
      method: request.method === "DELETE" ? "DELETE" : "PATCH",
      headers: { Prefer: "return=representation" },
      ...(request.method !== "DELETE" ? { body: JSON.stringify({ ...patch, revision: body.revision + 1, updated_at: new Date().toISOString() }) } : {}),
    });
    const row = first(rows);
    if (!row) {
      const existing = await readOwned(id, wallet);
      return existing ? fail(409, "This plan changed. Reload before saving.") : fail(404, "Plan not found.");
    }
    return response.status(200).json(request.method === "DELETE" ? { ok: true } : { plan: presentPlan(row, wallet) });
  } catch (error) {
    if (sendRequestBodyError(response, error)) return;
    console.warn("Could not handle Planner plans.", error);
    return fail(500, "Could not handle Planner plans.");
  }
};
