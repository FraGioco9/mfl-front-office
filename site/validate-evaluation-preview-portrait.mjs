import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const readText = (path) => readFileSync(resolve(siteRoot, path), "utf8");
const require = createRequire(import.meta.url);
const PImage = require("pureimage");
const { playerPortraitUrl } = require("./api/_player-portrait.js");
const { evaluationSharePreviewFromContext } = require("./api/_evaluation-share-preview.js");
const {
  PREVIEW_HEADER_BOTTOM_Y,
  PLAYER_PORTRAIT_GLOW_GAP,
  PLAYER_PORTRAIT_BOUNDS,
  fitPortraitDrawGeometry,
  renderEvaluationPreviewPng,
} = require("./api/_evaluation-preview-card.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pixelAt(image, x, y) {
  const index = ((y * image.width) + x) * 4;
  return Array.from(image.data.subarray(index, index + 4));
}

const packageJson = JSON.parse(readText("package.json"));
const previewCard = readText("api/_evaluation-preview-card.js");
const portraitOwner = readText("api/_player-portrait.js");
const previewOwner = readText("api/_evaluation-share-preview.js");
const configs = ["vercel.json", "vercel.production.json"].map((path) => [path, JSON.parse(readText(path))]);

assert(packageJson.dependencies?.["webp-wasm"] === "1.0.6", "Evaluation portrait rendering must pin the portable WebP decoder.");
assert(!packageJson.dependencies?.sharp && !packageJson.dependencies?.["@napi-rs/canvas"], "Evaluation portraits must not introduce native image dependencies.");
assert(
  portraitOwner.includes('const PLAYER_PORTRAIT_ORIGIN = "https://d13e14gtps4iwl.cloudfront.net"')
    && portraitOwner.includes('"/players/v2"')
    && portraitOwner.includes("photo.webp"),
  "Player portraits must come from the canonical MFL portrait CDN path.",
);
assert(
  playerPortraitUrl("80000") === "https://d13e14gtps4iwl.cloudfront.net/players/v2/80000/photo.webp",
  "Player portrait URLs must derive deterministically from the player ID.",
);
assert(playerPortraitUrl("../80000") === "", "Player portrait URL construction must reject non-numeric player identifiers.");
assert(previewOwner.includes("portraitUrl: playerPortraitUrl(playerId)"), "Shared Evaluation metadata must derive its portrait from the canonical player ID.");

for (const [path, config] of configs) {
  const includeFiles = String(config.functions?.["api/evaluation-preview-image.js"]?.includeFiles || "");
  assert(
    includeFiles.includes("node_modules/webp-wasm/webp_node_dec.wasm"),
    `${path} must bundle the WebP decoder WASM with the Evaluation preview-image function.`,
  );
}

assert(
  PLAYER_PORTRAIT_BOUNDS.width === 600
    && PLAYER_PORTRAIT_BOUNDS.right === 1130
    && PLAYER_PORTRAIT_BOUNDS.bottom === 374
    && PREVIEW_HEADER_BOTTOM_Y === 96
    && PLAYER_PORTRAIT_GLOW_GAP === 8,
  "The Evaluation portrait must size inside the expanded area and align its natural glow to the header and rarity-line endpoint with the same gap.",
);
assert(
  previewCard.includes("const PLAYER_TEXT_MAX_WIDTH = 1060;")
    && previewCard.includes("fittedFontSize(context, playerLabel, 700, 72, 44, PLAYER_TEXT_MAX_WIDTH)")
    && previewCard.includes("drawText(context, playerLabel, 70, 130, 700, playerSize, COLORS.text);")
    && !previewCard.includes("PLAYER_TEXT_WIDTH_WITH_PORTRAIT"),
  "Player heading size and position must remain the same as the original portrait-free layout.",
);
const portraitRenderMarker = "if (portrait) {\n      drawContainedImage(";
const playerNameMarker = "drawText(context, playerLabel, 70, 130, 700, playerSize, COLORS.text);";
assert(
  previewCard.includes(portraitRenderMarker)
    && previewCard.indexOf(portraitRenderMarker) < previewCard.indexOf(playerNameMarker),
  "The portrait must render before the player name so the name may spill over the image and remain on top.",
);
assert(
  previewCard.includes('require("./_portrait-close-up")')
    && previewCard.includes("const portrait = createPortraitCloseUp(source) || source;")
    && previewCard.includes("fitPortraitDrawGeometry(portrait, bounds, glowColor)")
    && previewCard.includes("portraitGlowTopOffsetPx(source, px(height), silhouetteMetrics)")
    && previewCard.includes("portraitGlowRightOffsetPx(source, px(width), silhouetteMetrics)")
    && previewCard.includes("PLAYER_PORTRAIT_BOUNDS,")
    && previewCard.includes("rarityColorForOverall(metadata.overall),")
    && previewCard.includes("fillRect(context, 0, 0, LOGICAL_WIDTH, 96, COLORS.surface);")
    && previewCard.includes("fillRect(context, 0, 95, LOGICAL_WIDTH, 1, COLORS.border);"),
  "The loaded portrait must keep its cropped aspect ratio, use two-axis glow-aware positioning, and preserve the canonical preview header.",
);

const metadata = evaluationSharePreviewFromContext({
  id: "portrait-test",
  playerId: "80000",
  payload: {
    summaryOverall: 82,
    summaryPosition: "ST",
    summaryPresentValue: 24,
  },
}, {
  playerId: "80000",
  playerName: "Mario Rossi",
  positions: "ST",
  nationality: "",
  age: 24,
  retirementYears: 0,
});
const expectedPortraitUrl = playerPortraitUrl("80000");
assert(metadata.portraitUrl === expectedPortraitUrl, "Shared Evaluation metadata must carry the evaluated player's portrait URL.");

const portraitFixture = PImage.make(80, 80);
const portraitContext = portraitFixture.getContext("2d");
portraitContext.fillStyle = "#ff00ff";
portraitContext.fillRect(0, 0, 80, 80);
const portraitGeometry = fitPortraitDrawGeometry(portraitFixture, PLAYER_PORTRAIT_BOUNDS, "#0077ff");
assert(portraitGeometry, "A valid synthetic portrait must produce draw geometry.");
assert(
  Math.abs(portraitGeometry.naturalGlowTop - (PREVIEW_HEADER_BOTTOM_Y + PLAYER_PORTRAIT_GLOW_GAP)) < 0.1
    && Math.abs(portraitGeometry.naturalGlowRight - (PLAYER_PORTRAIT_BOUNDS.right - PLAYER_PORTRAIT_GLOW_GAP)) < 0.1,
  "An opaque portrait must use the same 8px gap from its visible top to the header and visible right to the rarity-line endpoint.",
);

let requestedPortraitUrl = "";
const portraitCard = await renderEvaluationPreviewPng(metadata, {
  portraitLoader: async (url) => {
    requestedPortraitUrl = url;
    return portraitFixture;
  },
});
const fallbackCard = await renderEvaluationPreviewPng(metadata, {
  portraitLoader: async () => null,
});
assert(requestedPortraitUrl === expectedPortraitUrl, "The renderer must request only the portrait URL owned by shared Evaluation metadata.");
assert(!portraitCard.equals(fallbackCard), "A loaded portrait must visibly change the generated Evaluation preview.");

const decodedPortraitCard = await PImage.decodePNGFromStream(Readable.from([portraitCard]));
const centerX = Math.round((portraitGeometry.x + (portraitGeometry.width / 2)) * 2);
const centerY = Math.round((portraitGeometry.y + (portraitGeometry.height / 2)) * 2);
const portraitCenter = pixelAt(decodedPortraitCard, centerX, centerY);
assert(
  portraitCenter[0] === 255 && portraitCenter[1] === 0 && portraitCenter[2] === 255 && portraitCenter[3] === 255,
  "The synthetic player portrait must render at the center of its glow-aware geometry.",
);

console.log("Evaluation preview portrait validation passed with original player-name geometry, name-over-portrait layering, symmetric glow-edge alignment, and fallback rendering.");
