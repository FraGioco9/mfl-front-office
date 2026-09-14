import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const readText = (path) => readFileSync(resolve(siteRoot, path), "utf8");
const require = createRequire(import.meta.url);
const PImage = require("pureimage");
const {
  PREVIEW_HEADER_BOTTOM_Y,
  PLAYER_PORTRAIT_GLOW_GAP,
  PLAYER_PORTRAIT_BOUNDS,
  fitPortraitDrawGeometry,
  rarityColorForOverall,
} = require("./api/_evaluation-preview-card.js");
const {
  PORTRAIT_CROP_HEIGHT_PX,
  createPortraitCloseUp,
} = require("./api/_portrait-close-up.js");
const {
  GLOW_PADDING_PX,
  GLOW_BLUR_EXTENT_PX,
  GLOW_HEADER_CLIP_TOP_PX,
  portraitSilhouetteMetrics,
  portraitGlowTopOffsetPx,
  portraitGlowRightOffsetPx,
  createPortraitSilhouetteGlow,
} = require("./api/_portrait-silhouette-glow.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function alphaAt(bitmap, x, y) {
  const offset = ((y * bitmap.width) + x) * 4;
  return bitmap.data[offset + 3];
}

const playerRuntime = readText("modules/app-core-player-runtime.js");
const previewCard = readText("api/_evaluation-preview-card.js");
const silhouetteGlow = readText("api/_portrait-silhouette-glow.js");
const canonicalBranches = [
  [95, "#00ffe9"],
  [85, "#fa53ff"],
  [75, "#0077ff"],
  [65, "#71ff30"],
  [55, "#ecd17f"],
];

for (const [minimum, color] of canonicalBranches) {
  const branch = `if (value >= ${minimum}) return "${color}";`;
  assert(playerRuntime.includes(branch), `Player-page rarity palette must retain ${minimum}+ => ${color}.`);
  assert(previewCard.includes(branch), `Evaluation preview rarity palette must match Player pages for ${minimum}+. `);
  assert(rarityColorForOverall(minimum) === color, `Evaluation preview must resolve ${minimum} Overall to ${color}.`);
}

assert(playerRuntime.includes('return "#bebebe";'), "Player pages must retain the Common rarity color.");
assert(previewCard.includes('return "#bebebe";'), "Evaluation preview must retain the Common rarity color.");
assert(rarityColorForOverall(54) === "#bebebe", "Evaluation preview must resolve Common Overall values to #bebebe.");
assert(
  previewCard.includes("fillRect(context, x, y, width, 3, rarityColorForOverall(metadata.overall));"),
  "The Summary-strip top accent must use the Overall rarity color.",
);
assert(
  previewCard.includes('require("./_portrait-silhouette-glow")')
    && previewCard.includes("drawPortraitSilhouetteGlow(")
    && previewCard.includes("rarityColorForOverall(metadata.overall),")
    && silhouetteGlow.includes("sourceData[sourceOffset + 3] / 255")
    && silhouetteGlow.includes("hasTransparentPixel")
    && silhouetteGlow.includes("boxBlurAlpha"),
  "The portrait rarity glow must be derived from the portrait alpha silhouette and fade outward.",
);
assert(
  GLOW_PADDING_PX === 64
    && GLOW_BLUR_EXTENT_PX === 60
    && silhouetteGlow.includes("const GLOW_BLUR_RADIUS_PX = 20;")
    && silhouetteGlow.includes("const GLOW_BLUR_PASSES = 3;"),
  "The silhouette glow must use 20px blur passes with the expected 60px maximum fade extent.",
);
assert(
  GLOW_HEADER_CLIP_TOP_PX === 192
    && silhouetteGlow.includes("function clearGlowAbove(")
    && silhouetteGlow.includes("clearGlowAbove(glow, drawTop, GLOW_HEADER_CLIP_TOP_PX);"),
  "The portrait glow must retain the 96px logical header clip as a safety net.",
);
assert(
  PORTRAIT_CROP_HEIGHT_PX === 500
    && PREVIEW_HEADER_BOTTOM_Y === 96
    && PLAYER_PORTRAIT_GLOW_GAP === 8
    && PLAYER_PORTRAIT_BOUNDS.width === 600
    && PLAYER_PORTRAIT_BOUNDS.right === 1130
    && PLAYER_PORTRAIT_BOUNDS.bottom === 374
    && previewCard.includes("const maximumScale = bounds.width / sourceWidth;")
    && previewCard.includes("portraitGlowTopOffsetPx(source, px(height), silhouetteMetrics)")
    && previewCard.includes("portraitGlowRightOffsetPx(source, px(width), silhouetteMetrics)")
    && previewCard.includes("const targetGlowRight = px(bounds.right - PLAYER_PORTRAIT_GLOW_GAP);")
    && previewCard.includes("const y = bounds.bottom - height;")
    && previewCard.includes("fillRect(context, 0, 0, LOGICAL_WIDTH, 96, COLORS.surface);")
    && previewCard.includes("fillRect(context, 0, 95, LOGICAL_WIDTH, 1, COLORS.border);"),
  "The portrait must scale from its full-width top-500px crop and align both natural glow edges to the same 8px layout gap.",
);
assert(
  previewCard.includes("const PLAYER_TEXT_MAX_WIDTH = 1060;")
    && previewCard.includes("fittedFontSize(context, playerLabel, 700, 72, 44, PLAYER_TEXT_MAX_WIDTH)")
    && !previewCard.includes("PLAYER_TEXT_WIDTH_WITH_PORTRAIT"),
  "The player name must retain its original position and fitting width regardless of the portrait.",
);
assert(
  previewCard.includes("const FOOTER_SEPARATOR_Y = 578;")
    && previewCard.includes("const FOOTER_LABEL_CENTER_Y = ((FOOTER_SEPARATOR_Y + 1) + LOGICAL_HEIGHT) / 2;")
    && previewCard.includes('context.textBaseline = "middle";')
    && previewCard.includes('drawText(context, "MFL Front Office", 70, FOOTER_LABEL_CENTER_Y, 400, 20, COLORS.soft);'),
  "The footer label must be vertically centered in the space below its separator line.",
);
assert(
  !previewCard.includes("PLAYER_PORTRAIT_GLOW_LAYERS")
    && !previewCard.includes("function drawPortraitGlow(")
    && !previewCard.includes("PLAYER_PORTRAIT_ACCENT_GAP")
    && !previewCard.includes("PLAYER_PORTRAIT_ACCENT_HEIGHT"),
  "The portrait rarity treatment must not use a rectangular glow or hard underline accent.",
);

const cropSource = PImage.make(700, 700);
cropSource.data.fill(0);
const leftMarkerOffset = 0;
const rightMarkerOffset = (cropSource.width - 1) * 4;
cropSource.data[leftMarkerOffset] = 231;
cropSource.data[leftMarkerOffset + 1] = 17;
cropSource.data[leftMarkerOffset + 2] = 91;
cropSource.data[leftMarkerOffset + 3] = 255;
cropSource.data[rightMarkerOffset] = 13;
cropSource.data[rightMarkerOffset + 1] = 177;
cropSource.data[rightMarkerOffset + 2] = 241;
cropSource.data[rightMarkerOffset + 3] = 255;
const croppedPortrait = createPortraitCloseUp(cropSource);
assert(croppedPortrait, "A valid portrait must produce a close-up crop.");
assert(
  croppedPortrait.width === 700 && croppedPortrait.height === 500,
  "The close-up must preserve the full source width and crop only the top 500px of height.",
);
assert(
  croppedPortrait.data[0] === 231
    && croppedPortrait.data[1] === 17
    && croppedPortrait.data[2] === 91
    && croppedPortrait.data[3] === 255,
  "The close-up crop must start at the source top-left corner.",
);
const croppedRightOffset = (croppedPortrait.width - 1) * 4;
assert(
  croppedPortrait.data[croppedRightOffset] === 13
    && croppedPortrait.data[croppedRightOffset + 1] === 177
    && croppedPortrait.data[croppedRightOffset + 2] === 241
    && croppedPortrait.data[croppedRightOffset + 3] === 255,
  "The close-up crop must retain the source image's right edge instead of cropping the width.",
);

const scalablePortrait = PImage.make(1000, 500);
scalablePortrait.data.fill(0);
for (let y = 100; y < 500; y += 1) {
  for (let x = 160; x < 840; x += 1) {
    const offset = ((y * scalablePortrait.width) + x) * 4;
    scalablePortrait.data[offset] = 255;
    scalablePortrait.data[offset + 3] = 255;
  }
}
const scalableMetrics = portraitSilhouetteMetrics(scalablePortrait);
assert(
  scalableMetrics?.topVisibleRow === 100
    && scalableMetrics.rightVisibleColumn === 839
    && scalableMetrics.hasTransparentPixel,
  "Silhouette metrics must measure the actual top and right visible player edges before sizing and aligning the portrait.",
);
const scalableGeometry = fitPortraitDrawGeometry(scalablePortrait, PLAYER_PORTRAIT_BOUNDS, "#0077ff");
assert(scalableGeometry, "A transparent portrait must produce glow-aware draw geometry.");
assert(
  scalableGeometry.width > 500 && scalableGeometry.height > 270,
  "The expanded portrait region must visibly scale a wide 1000x500 crop beyond the old 360px-width / 270px-height presentation.",
);
assert(
  scalableGeometry.width <= PLAYER_PORTRAIT_BOUNDS.width + 0.01
    && Math.abs((scalableGeometry.y + scalableGeometry.height) - PLAYER_PORTRAIT_BOUNDS.bottom) < 0.01,
  "Glow-aware sizing must keep the portrait within its scale limit and on the rarity-line baseline.",
);
const measuredGlowTopOffset = portraitGlowTopOffsetPx(
  scalablePortrait,
  Math.round(scalableGeometry.height * 2),
  scalableMetrics,
) / 2;
const measuredGlowRightOffset = portraitGlowRightOffsetPx(
  scalablePortrait,
  Math.round(scalableGeometry.width * 2),
  scalableMetrics,
) / 2;
const topGlowGap = scalableGeometry.y + measuredGlowTopOffset - PREVIEW_HEADER_BOTTOM_Y;
const rightGlowGap = PLAYER_PORTRAIT_BOUNDS.right - (scalableGeometry.x + measuredGlowRightOffset);
assert(
  Math.abs(topGlowGap - PLAYER_PORTRAIT_GLOW_GAP) < 1
    && Math.abs(rightGlowGap - PLAYER_PORTRAIT_GLOW_GAP) < 0.1
    && Math.abs(topGlowGap - rightGlowGap) < 1,
  "The top glow-to-header gap and right glow-to-rarity-line-end gap must be the same distance.",
);
assert(
  Math.abs(scalableGeometry.naturalGlowRight - (PLAYER_PORTRAIT_BOUNDS.right - PLAYER_PORTRAIT_GLOW_GAP)) < 0.1,
  "The natural right glow edge must finish exactly 8px before the rarity line endpoint.",
);

const syntheticPortrait = PImage.make(16, 16);
syntheticPortrait.data.fill(0);
for (let y = 4; y <= 13; y += 1) {
  for (let x = 6; x <= 9; x += 1) {
    const offset = ((y * syntheticPortrait.width) + x) * 4;
    syntheticPortrait.data[offset] = 255;
    syntheticPortrait.data[offset + 3] = 255;
  }
}

const syntheticGlow = createPortraitSilhouetteGlow(syntheticPortrait, 64, 64, "#0077ff");
assert(syntheticGlow, "A transparent portrait silhouette must produce a glow bitmap.");
assert(
  syntheticGlow.width === 64 + (GLOW_PADDING_PX * 2)
    && syntheticGlow.height === 64 + (GLOW_PADDING_PX * 2),
  "Silhouette glow must reserve transparent padding for its outward fade.",
);

const silhouetteLeftEdge = GLOW_PADDING_PX + 24;
const silhouetteMidY = GLOW_PADDING_PX + 32;
const nearEdgeAlpha = alphaAt(syntheticGlow, silhouetteLeftEdge - 4, silhouetteMidY);
const farEdgeAlpha = alphaAt(syntheticGlow, silhouetteLeftEdge - 60, silhouetteMidY);
assert(nearEdgeAlpha > farEdgeAlpha, "Silhouette glow opacity must fade gradually away from the player edge.");
assert(nearEdgeAlpha > 0, "Silhouette glow must remain visible immediately outside the player edge.");

const opaquePortrait = PImage.make(8, 8);
assert(
  createPortraitSilhouetteGlow(opaquePortrait, 32, 32, "#0077ff") === null,
  "An image without transparent background must not fall back to a rectangular glow.",
);

console.log("Evaluation preview rarity accents, full-width crop, symmetric glow-edge alignment, name overlay, and footer alignment are validated.");
