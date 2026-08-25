const { playerPortraitUrl } = require("./_player-portrait");
const {
  renderProgressionEmailPortraitPng,
  transparentProgressionEmailPortraitPng,
} = require("./_progression-email-portrait");

module.exports = async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.status(405).send("Method not allowed.");
    return;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const playerId = String(requestUrl.searchParams.get("player") || "").trim();
  if (!playerPortraitUrl(playerId)) {
    response.status(400).send("Invalid player ID.");
    return;
  }

  let image = null;
  try {
    image = await renderProgressionEmailPortraitPng(playerId);
  } catch (error) {
    console.warn("Could not render progression email portrait.", error);
  }

  const fallback = !image;
  if (fallback) image = await transparentProgressionEmailPortraitPng();

  response.setHeader("Content-Type", "image/png");
  response.setHeader("Content-Length", String(image.length));
  response.setHeader(
    "Cache-Control",
    fallback ? "no-store, max-age=0" : "public, max-age=86400, s-maxage=86400",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(image);
};
