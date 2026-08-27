const { PassThrough } = require("node:stream");
const PImage = require("pureimage");
const { createPortraitCloseUp } = require("./_portrait-close-up");
const { loadPlayerPortraitBitmap, playerPortraitUrl } = require("./_player-portrait");

const PORTRAIT_CROP_HEIGHT_PX = 400;
const PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX = 216;

async function imageToPngBuffer(image) {
  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await PImage.encodePNGToStream(image, output);
  return Buffer.concat(chunks);
}

function transparentLeftInset(image) {
  for (let x = 0; x < image.width; x += 1) {
    for (let y = 0; y < image.height; y += 1) {
      const alpha = image.data[((y * image.width) + x) * 4 + 3];
      if (alpha > 0) return x;
    }
  }
  return 0;
}

function trimTransparentLeft(image) {
  const leftInset = transparentLeftInset(image);
  if (leftInset <= 0) return image;

  const width = image.width - leftInset;
  if (width <= 0) return image;

  const trimmed = PImage.make(width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    const sourceStart = ((y * image.width) + leftInset) * 4;
    const sourceEnd = sourceStart + (width * 4);
    const targetStart = y * width * 4;
    trimmed.data.set(image.data.subarray(sourceStart, sourceEnd), targetStart);
  }
  return trimmed;
}

function resizeProgressionEmailPortrait(source) {
  const cropped = createPortraitCloseUp(source, PORTRAIT_CROP_HEIGHT_PX);
  if (!cropped) return null;

  const silhouetteAligned = trimTransparentLeft(cropped);
  const outputWidth = Math.max(
    1,
    Math.round(
      (silhouetteAligned.width * PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX)
        / silhouetteAligned.height,
    ),
  );
  const output = PImage.make(
    outputWidth,
    PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  );
  const context = output.getContext("2d");
  context.drawImage(
    silhouetteAligned,
    0,
    0,
    outputWidth,
    PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  );
  return output;
}

async function renderProgressionEmailPortraitPng(playerIdValue, options = {}) {
  const sourceUrl = playerPortraitUrl(playerIdValue);
  if (!sourceUrl) return null;

  const portraitLoader = typeof options.portraitLoader === "function"
    ? options.portraitLoader
    : loadPlayerPortraitBitmap;
  const source = await portraitLoader(sourceUrl);
  if (!source) return null;

  const resized = resizeProgressionEmailPortrait(source);
  return resized ? imageToPngBuffer(resized) : null;
}

async function transparentProgressionEmailPortraitPng() {
  return imageToPngBuffer(
    PImage.make(
      PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
      PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
    ),
  );
}

module.exports = {
  PORTRAIT_CROP_HEIGHT_PX,
  PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  resizeProgressionEmailPortrait,
  renderProgressionEmailPortraitPng,
  transparentLeftInset,
  transparentProgressionEmailPortraitPng,
  trimTransparentLeft,
};
