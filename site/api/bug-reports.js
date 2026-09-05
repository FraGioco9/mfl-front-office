const crypto = require("node:crypto");
const { readJsonBody } = require("./_request-body");
const { signedWalletFromRequest } = require("./_wallet-proof");
const { supabaseConfig, supabaseRequest } = require("./_supabase");

const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REPORTS = 5;

class BugReportValidationError extends Error {}
class BugReportRateLimitError extends Error {}

function normalizedRequired(value, label, maxLength) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) throw new BugReportValidationError(`${label} is required.`);
  if (text.length > maxLength) throw new BugReportValidationError(`${label} is too long.`);
  return text;
}

function normalizedOptional(value, maxLength) {
  return String(value || "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function normalizeBugReport(body) {
  const data = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const title = normalizedRequired(data.title ?? data.summary, "Title", 120);
  const route = normalizedRequired(data.route, "Route or page", 300);
  const description = normalizedRequired(
    data.description ?? data.actual ?? data.actualBehavior ?? data.reproduction,
    "Description",
    4000,
  );
  const appVersion = normalizedOptional(data.appVersion ?? data.app_version, 32);
  if (appVersion && !/^\d+\.\d+\.\d+$/.test(appVersion)) {
    throw new BugReportValidationError("App version is invalid.");
  }

  return {
    summary: title,
    area: "Other",
    route,
    reproduction: description,
    expected_behavior: "Not specified.",
    actual_behavior: description.slice(0, 2000),
    environment: "",
    evidence: description.length > 2000 ? description.slice(2000, 4000) : "",
    app_version: appVersion,
  };
}

function requestAddress(request) {
  const forwarded = String(request?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  if (forwarded) return forwarded;
  const realIp = String(request?.headers?.["x-real-ip"] || "").trim();
  if (realIp) return realIp;
  return String(request?.socket?.remoteAddress || "unknown").trim() || "unknown";
}

function reporterHash(request) {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return crypto.createHmac("sha256", config.key).update(requestAddress(request)).digest("hex");
}

async function enforceRateLimit(hash) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const rows = await supabaseRequest(
    `bug_reports?select=id&reporter_hash=eq.${hash}&created_at=gte.${encodeURIComponent(cutoff)}&order=created_at.desc&limit=${RATE_LIMIT_MAX_REPORTS}`,
  );
  if (Array.isArray(rows) && rows.length >= RATE_LIMIT_MAX_REPORTS) {
    throw new BugReportRateLimitError("Too many bug reports. Try again later.");
  }
}

async function verifiedWallet(request) {
  const hasProofHeaders = Boolean(
    request?.headers?.["x-dapper-wallet-address"]
    && request?.headers?.["x-wallet-message"]
    && request?.headers?.["x-wallet-signatures"],
  );
  if (!hasProofHeaders) return "";
  return signedWalletFromRequest(request, { warning: false });
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const contentLength = Number(request.headers?.["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    response.status(413).json({ error: "Bug report is too large." });
    return;
  }

  try {
    const report = normalizeBugReport(await readJsonBody(request));
    const hash = reporterHash(request);
    await enforceRateLimit(hash);
    const wallet = await verifiedWallet(request);
    const userAgent = normalizedOptional(request.headers?.["user-agent"], 512);

    const rows = await supabaseRequest("bug_reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{
        ...report,
        user_agent: userAgent,
        wallet_address: wallet || null,
        reporter_hash: hash,
      }]),
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.id) throw new Error("Supabase did not return the created bug report.");

    response.status(201).json({ id: row.id });
  } catch (error) {
    if (error instanceof BugReportValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof BugReportRateLimitError) {
      response.status(429).json({ error: error.message });
      return;
    }
    console.warn("Could not save bug report.", error);
    response.status(500).json({ error: "Could not save bug report." });
  }
};
