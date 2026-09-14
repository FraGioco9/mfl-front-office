const { normalizeEvaluationId } = require("./_evaluation-payload");
const { supabaseConfig } = require("./_supabase");
const {
  GENERIC_PREVIEW,
  readActiveEvaluationShare,
  evaluationSharePreview,
} = require("./_evaluation-share-preview");
const { renderEvaluationPreviewPng } = require("./_evaluation-preview-card");

module.exports = async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.status(405).send("Method not allowed.");
    return;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const shareId = normalizeEvaluationId(requestUrl.searchParams.get("share"));
  const playerId = String(requestUrl.searchParams.get("player") || "").trim();
  let metadata = { ...GENERIC_PREVIEW };

  if (shareId && supabaseConfig()) {
    try {
      const share = await readActiveEvaluationShare(shareId, playerId);
      metadata = await evaluationSharePreview(share);
    } catch (error) {
      console.warn("Could not build Evaluation preview image.", error);
    }
  }

  const image = await renderEvaluationPreviewPng(metadata);
  response.setHeader("Content-Type", "image/png");
  response.setHeader("Content-Length", String(image.length));
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(image);
};
