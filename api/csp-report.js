const { readJsonBody, sendRequestBodyError } = require("./_request-body");

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const MAX_LOGS_PER_WINDOW = 24;
const LOG_WINDOW_MS = 60_000;
const SAFE_SECTIONS = new Set([
  "home", "database", "players", "clubs", "club", "agents", "watchlist",
  "my-players", "my-clubs", "planner", "evaluation", "settings",
  "progression", "changelog", "mfl", "privacy",
]);
let windowStarted = 0;
let logged = 0;

function safeDirective(value) {
  const directive = String(value || "").trim().toLowerCase().split(/\s+/)[0];
  return /^(?:default-src|base-uri|object-src|script-src(?:-elem|-attr)?|style-src(?:-elem|-attr)?|img-src|font-src|connect-src|frame-src|child-src|worker-src|media-src|form-action|manifest-src|navigate-to|trusted-types|require-trusted-types-for)$/.test(directive)
    ? directive
    : "other";
}

function safeBlockedSource(value) {
  const text = String(value || "").trim();
  if (["inline", "eval", "wasm-eval", "data", "blob", "about", "self"].includes(text)) return text;
  if (text.startsWith("data:")) return "data";
  if (text.startsWith("blob:")) return "blob";
  try {
    const url = new URL(text);
    if (["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return url.origin.slice(0, 160);
  } catch {
    // Invalid or relative resources are never logged verbatim.
  }
  return "other";
}

function safePageSection(value) {
  try {
    const path = new URL(String(value || "")).pathname;
    const section = path.split("/").filter(Boolean)[0] || "home";
    return SAFE_SECTIONS.has(section) ? section : "other";
  } catch {
    return "other";
  }
}

function normalizedReports(body) {
  const reports = Array.isArray(body)
    ? body.filter(item => item?.type === "csp-violation").map(item => item?.body)
    : body && typeof body === "object" && !Array.isArray(body)
      ? [body["csp-report"]]
      : [];
  return reports.slice(0, MAX_REPORTS_PER_REQUEST)
    .filter(item => item && typeof item === "object" && !Array.isArray(item))
    .map(item => ({
      directive: safeDirective(item["effective-directive"] ?? item.effectiveDirective ?? item["violated-directive"]),
      blocked: safeBlockedSource(item["blocked-uri"] ?? item.blockedURL ?? item.blockedURI),
      section: safePageSection(item["document-uri"] ?? item.documentURL),
      disposition: String(item.disposition || "report") === "report" ? "report" : "other",
    }))
    .filter(report => report.disposition === "report");
}

function logReport(report, now = Date.now(), logger = console.info) {
  if (now < windowStarted || now - windowStarted >= LOG_WINDOW_MS) {
    windowStarted = now;
    logged = 0;
  }
  if (logged >= MAX_LOGS_PER_WINDOW) return false;
  logged += 1;
  // Deliberately exclude document path/query, source paths, referrer,
  // originalPolicy, line/column, script sample, cookies and IP address.
  logger("MFL CSP report-only violation", report);
  return true;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  const contentType = String(request.headers?.["content-type"] || "").trim().toLowerCase();
  if (!/^(?:application\/csp-report|application\/reports\+json)(?:\s*;|$)/.test(contentType)) {
    response.status(415).json({ error: "Unsupported report content type." });
    return;
  }
  try {
    const body = await readJsonBody(request, { maxBytes: MAX_BODY_BYTES });
    for (const report of normalizedReports(body)) logReport(report);
    response.status(204).end();
  } catch (error) {
    if (sendRequestBodyError(response, error)) return;
    console.warn("Could not handle CSP report:", error?.message || "unknown");
    response.status(500).json({ error: "Could not process CSP report." });
  }
};
module.exports.MAX_BODY_BYTES = MAX_BODY_BYTES;
module.exports.normalizedReports = normalizedReports;
module.exports.safeBlockedSource = safeBlockedSource;
module.exports.safePageSection = safePageSection;
module.exports.safeDirective = safeDirective;
module.exports.logReport = logReport;
