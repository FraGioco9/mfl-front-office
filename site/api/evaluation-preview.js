const fs = require("fs");
const path = require("path");
const { normalizeEvaluationId } = require("./_evaluation-payload");
const { supabaseConfig } = require("./_supabase");
const {
  GENERIC_PREVIEW,
  readActiveEvaluationShare,
  evaluationSharePreview,
} = require("./_evaluation-share-preview");

function htmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requestOrigin(request) {
  const forwardedHost = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return forwardedHost ? `${protocol}://${forwardedHost}` : "https://mfl-front-office.vercel.app";
}

function evaluationShellPath() {
  return path.resolve(__dirname, "..", "index.html");
}

function evaluationCanonicalUrl(origin, shareId, playerId) {
  const url = new URL("/evaluation", origin);
  const normalizedId = normalizeEvaluationId(shareId);
  const normalizedPlayerId = String(playerId || "").trim();
  if (normalizedId && normalizedPlayerId) url.searchParams.set("player", normalizedPlayerId);
  if (normalizedId) url.searchParams.set("share", normalizedId);
  return url.toString();
}

function evaluationPreviewImageUrl(origin, shareId, playerId) {
  const url = new URL("/api/evaluation-preview-image", origin);
  const normalizedId = normalizeEvaluationId(shareId);
  const normalizedPlayerId = String(playerId || "").trim();
  if (normalizedId && normalizedPlayerId) url.searchParams.set("player", normalizedPlayerId);
  if (normalizedId) url.searchParams.set("share", normalizedId);
  return url.toString();
}

function previewMetadataHtml(metadata, canonicalUrl, imageUrl) {
  const title = htmlEscape(metadata.title);
  const description = htmlEscape(metadata.description);
  const escapedUrl = htmlEscape(canonicalUrl);
  const escapedImage = htmlEscape(imageUrl);
  return [
    `<meta name="description" content="${description}">`,
    '<meta name="robots" content="noindex,nofollow,noarchive">',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${escapedUrl}">`,
    `<meta property="og:image" content="${escapedImage}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="2400">',
    '<meta property="og:image:height" content="1260">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${escapedImage}">`,
  ].join("\n    ");
}

function renderPreviewHtml(indexHtml, metadata, canonicalUrl, imageUrl) {
  const title = htmlEscape(metadata.title);
  const meta = previewMetadataHtml(metadata, canonicalUrl, imageUrl);
  return indexHtml.replace(
    "<title>MFL Front Office</title>",
    `<title>${title}</title>\n    ${meta}`,
  );
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.status(405).send("Method not allowed.");
    return;
  }

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Robots-Tag", "noindex, nofollow,noarchive");

  const requestUrl = new URL(request.url, "http://localhost");
  const shareId = normalizeEvaluationId(requestUrl.searchParams.get("share"));
  const playerId = String(requestUrl.searchParams.get("player") || "").trim();
  const origin = requestOrigin(request);
  const canonicalUrl = evaluationCanonicalUrl(origin, shareId, playerId);
  const imageUrl = evaluationPreviewImageUrl(origin, shareId, playerId);
  let metadata = { ...GENERIC_PREVIEW };

  if (shareId && supabaseConfig()) {
    try {
      const share = await readActiveEvaluationShare(shareId, playerId);
      metadata = await evaluationSharePreview(share);
    } catch (error) {
      console.warn("Could not build Evaluation share preview.", error);
    }
  }

  const indexHtml = fs.readFileSync(evaluationShellPath(), "utf8");
  const html = renderPreviewHtml(indexHtml, metadata, canonicalUrl, imageUrl);
  response.status(200);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.send(html);
};

module.exports.htmlEscape = htmlEscape;
module.exports.renderPreviewHtml = renderPreviewHtml;
module.exports.evaluationShellPath = evaluationShellPath;
module.exports.evaluationCanonicalUrl = evaluationCanonicalUrl;
module.exports.evaluationPreviewImageUrl = evaluationPreviewImageUrl;
