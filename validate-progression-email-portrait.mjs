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
const {
  BACKGROUND_ALPHA_CUTOFF,
  BACKGROUND_COLOR_DISTANCE,
  PORTRAIT_CROP_HEIGHT_PX,
  PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  resizeProgressionEmailPortrait,
  renderProgressionEmailPortraitPng,
  horizontalVisibleBounds,
  removePortraitBackground,
  trimTransparentSides,
} = require("./api/_progression-email-portrait.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function setPixel(image, x, y, red, green, blue, alpha = 255) {
  const index = ((y * image.width) + x) * 4;
  image.data[index] = red;
  image.data[index + 1] = green;
  image.data[index + 2] = blue;
  image.data[index + 3] = alpha;
}

function pixelAt(image, x, y) {
  const index = ((y * image.width) + x) * 4;
  return Array.from(image.data.subarray(index, index + 4));
}

function dominantChannel(pixel) {
  const [red, green, blue] = pixel;
  if (red > green && red > blue) return "red";
  if (green > red && green > blue) return "green";
  if (blue > red && blue > green) return "blue";
  return "mixed";
}

const rendererSource = readText("api/_progression-email-portrait.js");
const endpointSource = readText("api/progression-email-portrait.js");
const configs = ["vercel.json", "vercel.production.json"].map((path) => [path, JSON.parse(readText(path))]);

assert(PORTRAIT_CROP_HEIGHT_PX === 400, "Progression email portraits must crop exactly the top 400 source pixels.");
assert(PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX === 216, "Progression email portraits must render at 216px high for high-density displays.");
assert(BACKGROUND_ALPHA_CUTOFF === 16, "Very low-alpha source pixels must be treated as portrait background.");
assert(BACKGROUND_COLOR_DISTANCE === 52, "Portrait background removal must use the validated edge-color tolerance.");
assert(
  rendererSource.includes("const cropped = createPortraitCloseUp(source, PORTRAIT_CROP_HEIGHT_PX);")
    && rendererSource.indexOf("const cropped = createPortraitCloseUp(source, PORTRAIT_CROP_HEIGHT_PX);")
      < rendererSource.indexOf("context.drawImage("),
  "Progression email portrait rendering must crop the unscaled source before resizing it.",
);
assert(
  rendererSource.includes("const backgroundRemoved = removePortraitBackground(cropped);")
    && rendererSource.indexOf("removePortraitBackground(cropped)")
      < rendererSource.indexOf("trimTransparentSides(backgroundRemoved)"),
  "Progression email portrait rendering must remove edge-connected background before horizontal trimming.",
);
assert(
  rendererSource.includes("const horizontallyTrimmed = trimTransparentSides(backgroundRemoved);")
    && rendererSource.includes("horizontalVisibleBounds"),
  "Progression email portrait rendering must trim transparent columns from both horizontal sides after background removal.",
);
assert(
  rendererSource.includes("output.data.fill(0);")
    && rendererSource.indexOf("output.data.fill(0);") < rendererSource.indexOf("context.drawImage("),
  "The final resize canvas must be explicitly transparent before drawing the portrait cutout.",
);
assert(
  rendererSource.includes("(horizontallyTrimmed.width * PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX)"),
  "Progression email portrait width must be derived proportionally from the horizontally trimmed silhouette.",
);
assert(
  endpointSource.includes("renderProgressionEmailPortraitPng(playerId)")
    && endpointSource.includes('response.setHeader("Content-Type", "image/png")'),
  "The progression email portrait endpoint must return the preprocessed PNG renderer output.",
);
for (const [path, config] of configs) {
  const includeFiles = String(config.functions?.["api/progression-email-portrait.js"]?.includeFiles || "");
  assert(
    includeFiles.includes("node_modules/webp-wasm/webp_node_dec.wasm"),
    `${path} must bundle the WebP decoder WASM with the progression-email portrait function.`,
  );
}

// Use an opaque neutral background to verify that Gmail portrait preprocessing
// actually cuts out the player instead of merely preserving existing alpha.
const backgroundSource = PImage.make(120, 400);
for (let y = 0; y < backgroundSource.height; y += 1) {
  for (let x = 0; x < backgroundSource.width; x += 1) {
    setPixel(backgroundSource, x, y, 232, 234, 236);
  }
  for (let x = 20; x < 100; x += 1) {
    setPixel(backgroundSource, x, y, 190, 30, 35);
  }
}
const cutout = removePortraitBackground(backgroundSource);
assert(pixelAt(cutout, 0, 200)[3] === 0, "Opaque edge-connected background pixels must become fully transparent.");
assert(pixelAt(cutout, 119, 200)[3] === 0, "Background removal must work from both horizontal edges.");
assert(pixelAt(cutout, 60, 200)[3] === 255, "Foreground silhouette pixels must remain opaque.");
const cutoutBounds = horizontalVisibleBounds(cutout);
assert(cutoutBounds?.left === 20 && cutoutBounds?.right === 99, "Background removal must expose the real horizontal silhouette bounds.");
const cutoutTrimmed = trimTransparentSides(cutout);
assert(cutoutTrimmed.width === 80 && cutoutTrimmed.height === 400, "Only the transparent left/right margins around the cutout may be trimmed.");

// Deliberately use a non-square 100x700 source. The player occupies the middle
// 60 columns from source row 40 downward over an opaque neutral background.
// The top 400 rows are split red/green and everything below is blue. Correct
// crop -> cutout -> trim -> resize must retain a transparent top area, contain
// red and green silhouette pixels, and never contain blue.
const source = PImage.make(100, 700);
for (let y = 0; y < source.height; y += 1) {
  for (let x = 0; x < source.width; x += 1) {
    setPixel(source, x, y, 235, 235, 235);
  }
  if (y >= 40) {
    for (let x = 20; x < 80; x += 1) {
      if (y < 200) setPixel(source, x, y, 255, 0, 0);
      else if (y < 400) setPixel(source, x, y, 0, 255, 0);
      else setPixel(source, x, y, 0, 0, 255);
    }
  }
}

const resized = resizeProgressionEmailPortrait(source);
assert(resized?.width === 32 && resized?.height === 216, "The 60x400 cutout must become 32x216 while preserving proportions.");
assert(pixelAt(resized, 16, 0)[3] === 0, "The transparent background above the silhouette must survive resizing.");
assert(dominantChannel(pixelAt(resized, 16, 36)) === "red", "The upper silhouette must come from the upper part of the top-400px crop.");
assert(dominantChannel(pixelAt(resized, 16, 180)) === "green", "The lower silhouette must come from near row 400 of the source crop.");
assert(dominantChannel(pixelAt(resized, 16, 180)) !== "blue", "Pixels below source row 399 must never enter the email portrait.");
assert(pixelAt(resized, 0, 108)[3] > 0, "After horizontal trimming the scaled image must begin at the silhouette edge.");
assert(pixelAt(resized, resized.width - 1, 108)[3] > 0, "After horizontal trimming the scaled image must end at the silhouette edge.");

// Existing transparent portraits must stay transparent without inventing a
// replacement background.
const transparentSource = PImage.make(110, 400);
for (let y = 0; y < transparentSource.height; y += 1) {
  for (let x = 0; x < transparentSource.width; x += 1) {
    setPixel(transparentSource, x, y, 0, 0, 0, 0);
  }
  for (let x = 20; x < 100; x += 1) {
    setPixel(transparentSource, x, y, 255, 0, 0);
  }
}
const transparentCutout = removePortraitBackground(transparentSource);
assert(pixelAt(transparentCutout, 0, 200)[3] === 0, "Existing transparent margins must remain fully transparent.");
assert(pixelAt(transparentCutout, 60, 200)[3] > 0, "Existing transparent portraits must preserve their visible silhouette.");
const transparentTrimmed = resizeProgressionEmailPortrait(transparentSource);
assert(transparentTrimmed?.width === 43 && transparentTrimmed?.height === 216, "An 80x400 transparent silhouette must become 43x216 while preserving proportions.");

let requestedUrl = "";
const png = await renderProgressionEmailPortraitPng("374512", {
  portraitLoader: async (url) => {
    requestedUrl = url;
    return source;
  },
});
assert(
  requestedUrl === playerPortraitUrl("374512"),
  "The renderer must load the full canonical MFL portrait before cropping.",
);
assert(png, "A valid source portrait must produce PNG bytes.");
const decoded = await PImage.decodePNGFromStream(Readable.from([png]));
assert(decoded.width === 32 && decoded.height === 216, "Encoded progression email portrait PNG must preserve the cutout aspect ratio at 216px high.");
assert(pixelAt(decoded, 16, 0)[3] === 0, "PNG encoding must preserve the transparent background above the silhouette.");
assert(dominantChannel(pixelAt(decoded, 16, 36)) === "red", "Encoded PNG must preserve the upper silhouette pixels.");
assert(dominantChannel(pixelAt(decoded, 16, 180)) === "green", "Encoded PNG must preserve pixels near source row 400 after scaling.");
assert(pixelAt(decoded, 16, 108)[3] > 0, "Encoded PNG must preserve opaque silhouette alpha.");

console.log("Progression email portrait validation passed: top-400 crop, opaque background removal, transparent resize canvas, two-sided trim, proportional 216px output.");
