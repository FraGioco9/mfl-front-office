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
  PORTRAIT_CROP_HEIGHT_PX,
  PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  resizeProgressionEmailPortrait,
  renderProgressionEmailPortraitPng,
  transparentLeftInset,
  trimTransparentLeft,
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

assert(PORTRAIT_CROP_HEIGHT_PX === 500, "Progression email portraits must crop exactly the top 500 source pixels.");
assert(PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX === 216, "Progression email portraits must render at 216px high for high-density displays.");
assert(
  rendererSource.includes("const cropped = createPortraitCloseUp(source);")
    && rendererSource.indexOf("const cropped = createPortraitCloseUp(source);")
      < rendererSource.indexOf("context.drawImage("),
  "Progression email portrait rendering must crop the unscaled source before resizing it.",
);
assert(
  rendererSource.includes("const silhouetteAligned = trimTransparentLeft(cropped);")
    && rendererSource.includes("transparentLeftInset"),
  "Progression email portrait rendering must align from the leftmost visible silhouette pixel.",
);
assert(
  rendererSource.includes("(silhouetteAligned.width * PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX)"),
  "Progression email portrait width must be derived proportionally from the silhouette-aligned crop.",
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

// Deliberately use a non-square 100x700 source. The top 500 rows are split
// red/green; the bottom 200 rows are blue. Correct crop-then-resize output must
// contain both red and green but no blue. The 100x500 crop scaled to 216px high
// must be 43px wide after rounding, proving width is not forced to a square.
const source = PImage.make(100, 700);
for (let y = 0; y < source.height; y += 1) {
  for (let x = 0; x < source.width; x += 1) {
    if (y < 250) setPixel(source, x, y, 255, 0, 0);
    else if (y < 500) setPixel(source, x, y, 0, 255, 0);
    else setPixel(source, x, y, 0, 0, 255);
  }
}

const resized = resizeProgressionEmailPortrait(source);
assert(resized?.width === 43 && resized?.height === 216, "The 100x500 crop must become 43x216 while preserving proportions.");
assert(dominantChannel(pixelAt(resized, 21, 36)) === "red", "The upper half must come from the upper part of the top-500px crop.");
assert(dominantChannel(pixelAt(resized, 21, 180)) === "green", "The lower half must come from near row 500 of the source crop.");
assert(dominantChannel(pixelAt(resized, 21, 180)) !== "blue", "Pixels below source row 499 must never enter the email portrait.");

// The first 20 columns are transparent and the visible silhouette begins at x=20.
// Keep another 10 transparent columns on the right: only the left transparent
// padding should be removed, so harmless transparent overflow on the right stays.
const silhouetteSource = PImage.make(110, 500);
for (let y = 0; y < silhouetteSource.height; y += 1) {
  for (let x = 0; x < silhouetteSource.width; x += 1) {
    setPixel(silhouetteSource, x, y, 0, 0, 0, 0);
  }
  for (let x = 20; x < 100; x += 1) {
    setPixel(silhouetteSource, x, y, 255, 0, 0);
  }
}
assert(transparentLeftInset(silhouetteSource) === 20, "The silhouette left edge must be detected from alpha pixels.");
const leftTrimmed = trimTransparentLeft(silhouetteSource);
assert(leftTrimmed.width === 90 && leftTrimmed.height === 500, "Only the 20 transparent columns before the silhouette may be removed.");
assert(pixelAt(leftTrimmed, 0, 250)[3] > 0, "The trimmed crop must begin on the visible silhouette.");
assert(pixelAt(leftTrimmed, leftTrimmed.width - 1, 250)[3] === 0, "Transparent pixels on the right must remain available for harmless overflow.");
const silhouetteAligned = resizeProgressionEmailPortrait(silhouetteSource);
assert(silhouetteAligned?.width === 39 && silhouetteAligned?.height === 216, "A 90x500 left-aligned crop, including right transparency, must become 39x216.");
assert(pixelAt(silhouetteAligned, 0, 108)[3] > 0, "The visible silhouette must begin at the output's left edge.");

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
assert(decoded.width === 43 && decoded.height === 216, "Encoded progression email portrait PNG must preserve the cropped aspect ratio at 216px high.");
assert(dominantChannel(pixelAt(decoded, 21, 36)) === "red", "Encoded PNG must preserve the upper crop pixels.");
assert(dominantChannel(pixelAt(decoded, 21, 180)) === "green", "Encoded PNG must preserve pixels near source row 500 after scaling.");

console.log("Progression email portrait validation passed: top-500 crop, silhouette-left alignment, proportional 216px high-density output.");
