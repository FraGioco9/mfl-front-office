const PImage = require("pureimage");

const PLAYER_PORTRAIT_ORIGIN = "https://d13e14gtps4iwl.cloudfront.net";
const PLAYER_PORTRAIT_PATH_PREFIX = "/players/v2";
const PLAYER_PORTRAIT_MAX_BYTES = 6 * 1024 * 1024;
const PLAYER_PORTRAIT_MAX_DIMENSION = 4096;
const PLAYER_PORTRAIT_TIMEOUT_MS = 4000;
const portraitPromises = new Map();
let webpModule;

function normalizedPortraitPlayerId(value) {
  const playerId = String(value ?? "").trim();
  return /^\d{1,20}$/.test(playerId) ? playerId : "";
}

function playerPortraitUrl(playerIdValue) {
  const playerId = normalizedPortraitPlayerId(playerIdValue);
  return playerId
    ? `${PLAYER_PORTRAIT_ORIGIN}${PLAYER_PORTRAIT_PATH_PREFIX}/${playerId}/photo.webp`
    : "";
}

function playerIdFromPortraitUrl(urlValue) {
  try {
    const url = new URL(String(urlValue || ""));
    if (url.origin !== PLAYER_PORTRAIT_ORIGIN || url.search || url.hash) return "";
    const match = url.pathname.match(/^\/players\/v2\/(\d{1,20})\/photo\.webp$/);
    return match ? normalizedPortraitPlayerId(match[1]) : "";
  } catch {
    return "";
  }
}

function webpDecoder() {
  if (webpModule !== undefined) return webpModule;
  try {
    webpModule = require("webp-wasm");
  } catch (error) {
    console.warn("MFL player portrait WebP decoder is unavailable; using the standard Evaluation preview fallback.", error);
    webpModule = null;
  }
  return webpModule;
}

function isWebpBuffer(bytes) {
  return bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP";
}

async function fetchPlayerPortraitBitmap(urlValue) {
  const playerId = playerIdFromPortraitUrl(urlValue);
  if (!playerId) return null;

  try {
    const webp = webpDecoder();
    if (!webp) return null;

    const response = await fetch(playerPortraitUrl(playerId), {
      headers: { Accept: "image/webp,image/*;q=0.8" },
      redirect: "error",
      signal: AbortSignal.timeout(PLAYER_PORTRAIT_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > PLAYER_PORTRAIT_MAX_BYTES || !isWebpBuffer(bytes)) return null;

    const sourceBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const decoded = await webp.decode(sourceBuffer);
    const width = Number(decoded?.width);
    const height = Number(decoded?.height);
    if (
      !Number.isInteger(width)
      || !Number.isInteger(height)
      || width <= 0
      || height <= 0
      || width > PLAYER_PORTRAIT_MAX_DIMENSION
      || height > PLAYER_PORTRAIT_MAX_DIMENSION
      || !decoded?.data
      || decoded.data.length !== width * height * 4
    ) {
      return null;
    }

    const bitmap = PImage.make(width, height);
    bitmap.data.set(decoded.data);
    return bitmap;
  } catch (error) {
    console.warn("Could not load MFL player portrait for Evaluation preview.", error);
    return null;
  }
}

async function loadPlayerPortraitBitmap(urlValue) {
  const playerId = playerIdFromPortraitUrl(urlValue);
  if (!playerId) return null;
  const canonicalUrl = playerPortraitUrl(playerId);
  if (portraitPromises.has(canonicalUrl)) return portraitPromises.get(canonicalUrl);

  const pending = fetchPlayerPortraitBitmap(canonicalUrl);
  portraitPromises.set(canonicalUrl, pending);
  const portrait = await pending;
  if (!portrait) portraitPromises.delete(canonicalUrl);
  return portrait;
}

module.exports = {
  PLAYER_PORTRAIT_ORIGIN,
  playerPortraitUrl,
  loadPlayerPortraitBitmap,
};
