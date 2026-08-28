const { PassThrough } = require("node:stream");
const PImage = require("pureimage");
const { createPortraitCloseUp } = require("./_portrait-close-up");
const { loadPlayerPortraitBitmap, playerPortraitUrl } = require("./_player-portrait");

const PORTRAIT_CROP_HEIGHT_PX = 400;
const PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX = 216;
const BACKGROUND_ALPHA_CUTOFF = 16;
const BACKGROUND_COLOR_DISTANCE = 52;

async function imageToPngBuffer(image) {
  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await PImage.encodePNGToStream(image, output);
  return Buffer.concat(chunks);
}

function pixelOffset(image, x, y) {
  return ((y * image.width) + x) * 4;
}

function colorDistance(image, offset, color) {
  const red = image.data[offset] - color[0];
  const green = image.data[offset + 1] - color[1];
  const blue = image.data[offset + 2] - color[2];
  return Math.sqrt((red * red) + (green * green) + (blue * blue));
}

function cornerBackgroundPalette(image) {
  const coordinates = [
    [0, 0],
    [Math.max(0, image.width - 1), 0],
    [0, Math.max(0, image.height - 1)],
    [Math.max(0, image.width - 1), Math.max(0, image.height - 1)],
  ];
  const palette = [];
  const seen = new Set();

  for (const [anchorX, anchorY] of coordinates) {
    const startX = Math.max(0, anchorX - 1);
    const endX = Math.min(image.width - 1, anchorX + 1);
    const startY = Math.max(0, anchorY - 1);
    const endY = Math.min(image.height - 1, anchorY + 1);
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const offset = pixelOffset(image, x, y);
        if (image.data[offset + 3] <= BACKGROUND_ALPHA_CUTOFF) continue;
        const color = [
          image.data[offset],
          image.data[offset + 1],
          image.data[offset + 2],
        ];
        const key = color.map((channel) => Math.round(channel / 8)).join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        palette.push(color);
      }
    }
  }
  return palette;
}

function isBackgroundLike(image, offset, palette) {
  if (image.data[offset + 3] <= BACKGROUND_ALPHA_CUTOFF) return true;
  return palette.some(
    (color) => colorDistance(image, offset, color) <= BACKGROUND_COLOR_DISTANCE,
  );
}

function removePortraitBackground(image) {
  const palette = cornerBackgroundPalette(image);
  const output = PImage.make(image.width, image.height);
  output.data.set(image.data);

  if (!palette.length) {
    for (let offset = 0; offset < output.data.length; offset += 4) {
      if (output.data[offset + 3] <= BACKGROUND_ALPHA_CUTOFF) {
        output.data[offset] = 0;
        output.data[offset + 1] = 0;
        output.data[offset + 2] = 0;
        output.data[offset + 3] = 0;
      }
    }
    return output;
  }

  const pixelCount = image.width * image.height;
  const removed = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  function enqueue(x, y) {
    const index = (y * image.width) + x;
    if (removed[index]) return;
    const offset = index * 4;
    if (!isBackgroundLike(image, offset, palette)) return;
    removed[index] = 1;
    queue[queueEnd] = index;
    queueEnd += 1;
  }

  for (let x = 0; x < image.width; x += 1) {
    enqueue(x, 0);
    if (image.height > 1) enqueue(x, image.height - 1);
  }
  for (let y = 1; y < image.height - 1; y += 1) {
    enqueue(0, y);
    if (image.width > 1) enqueue(image.width - 1, y);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < image.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < image.height) enqueue(x, y + 1);
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (!removed[index]) continue;
    const offset = index * 4;
    output.data[offset] = 0;
    output.data[offset + 1] = 0;
    output.data[offset + 2] = 0;
    output.data[offset + 3] = 0;
  }

  return output;
}

function horizontalVisibleBounds(image) {
  let left = image.width;
  let right = -1;
  for (let x = 0; x < image.width; x += 1) {
    for (let y = 0; y < image.height; y += 1) {
      const alpha = image.data[((y * image.width) + x) * 4 + 3];
      if (alpha <= 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return right >= left ? { left, right } : null;
}

function trimTransparentSides(image) {
  const bounds = horizontalVisibleBounds(image);
  if (!bounds) return image;

  const width = bounds.right - bounds.left + 1;
  if (bounds.left === 0 && width === image.width) return image;

  const trimmed = PImage.make(width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    const sourceStart = ((y * image.width) + bounds.left) * 4;
    const sourceEnd = sourceStart + (width * 4);
    const targetStart = y * width * 4;
    trimmed.data.set(image.data.subarray(sourceStart, sourceEnd), targetStart);
  }
  return trimmed;
}

function resizeProgressionEmailPortrait(source) {
  const cropped = createPortraitCloseUp(source, PORTRAIT_CROP_HEIGHT_PX);
  if (!cropped) return null;

  const backgroundRemoved = removePortraitBackground(cropped);
  const horizontallyTrimmed = trimTransparentSides(backgroundRemoved);
  const outputWidth = Math.max(
    1,
    Math.round(
      (horizontallyTrimmed.width * PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX)
        / horizontallyTrimmed.height,
    ),
  );
  const output = PImage.make(
    outputWidth,
    PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  );
  output.data.fill(0);
  const context = output.getContext("2d");
  context.drawImage(
    horizontallyTrimmed,
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
  const transparent = PImage.make(
    PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
    PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  );
  transparent.data.fill(0);
  return imageToPngBuffer(transparent);
}

module.exports = {
  BACKGROUND_ALPHA_CUTOFF,
  BACKGROUND_COLOR_DISTANCE,
  PORTRAIT_CROP_HEIGHT_PX,
  PROGRESSION_EMAIL_PORTRAIT_HEIGHT_PX,
  cornerBackgroundPalette,
  horizontalVisibleBounds,
  removePortraitBackground,
  resizeProgressionEmailPortrait,
  renderProgressionEmailPortraitPng,
  transparentProgressionEmailPortraitPng,
  trimTransparentSides,
};
