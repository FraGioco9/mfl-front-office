const PImage = require("pureimage");

const GLOW_PADDING_PX = 64;
const GLOW_BLUR_RADIUS_PX = 20;
const GLOW_BLUR_PASSES = 3;
const GLOW_BLUR_EXTENT_PX = GLOW_BLUR_RADIUS_PX * GLOW_BLUR_PASSES;
const GLOW_OPACITY = 0.55;
const GLOW_HEADER_CLIP_TOP_PX = 192;

function colorChannels(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function portraitSilhouetteMetrics(source) {
  const sourceWidth = Number(source?.width);
  const sourceHeight = Number(source?.height);
  const sourceData = source?.data;
  if (
    !Number.isInteger(sourceWidth)
    || !Number.isInteger(sourceHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
    || !(sourceData instanceof Uint8Array)
  ) {
    return null;
  }

  let topVisibleRow = sourceHeight;
  let rightVisibleColumn = -1;
  let hasVisiblePixel = false;
  let hasTransparentPixel = false;
  for (let y = 0; y < sourceHeight; y += 1) {
    const rowStart = y * sourceWidth * 4;
    const rowEnd = rowStart + (sourceWidth * 4);
    for (let offset = rowStart + 3; offset < rowEnd; offset += 4) {
      const alpha = sourceData[offset];
      if (alpha > 0) {
        hasVisiblePixel = true;
        if (topVisibleRow === sourceHeight) topVisibleRow = y;
        const x = ((offset - rowStart) - 3) / 4;
        if (x > rightVisibleColumn) rightVisibleColumn = x;
      }
      if (alpha < 250) hasTransparentPixel = true;
    }
  }

  if (!hasVisiblePixel) return null;
  return {
    sourceWidth,
    sourceHeight,
    topVisibleRow,
    rightVisibleColumn,
    hasTransparentPixel,
  };
}

function portraitGlowTopOffsetPx(source, targetHeight, metrics = portraitSilhouetteMetrics(source)) {
  const height = Math.max(1, Math.round(Number(targetHeight) || 0));
  if (!metrics?.hasTransparentPixel) return 0;
  const scaledTopVisibleRow = Math.max(
    0,
    Math.floor((metrics.topVisibleRow * height) / metrics.sourceHeight),
  );
  return scaledTopVisibleRow - GLOW_BLUR_EXTENT_PX;
}

function portraitGlowRightOffsetPx(source, targetWidth, metrics = portraitSilhouetteMetrics(source)) {
  const width = Math.max(1, Math.round(Number(targetWidth) || 0));
  if (!metrics?.hasTransparentPixel) return width;
  const scaledRightVisibleEdge = Math.min(
    width,
    Math.ceil(((metrics.rightVisibleColumn + 1) * width) / metrics.sourceWidth),
  );
  return scaledRightVisibleEdge + GLOW_BLUR_EXTENT_PX;
}

function scaledAlphaMask(source, targetWidth, targetHeight, padding) {
  const sourceWidth = Number(source?.width);
  const sourceHeight = Number(source?.height);
  const sourceData = source?.data;
  if (
    !Number.isInteger(sourceWidth)
    || !Number.isInteger(sourceHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
    || !(sourceData instanceof Uint8Array)
  ) {
    return null;
  }

  let hasVisiblePixel = false;
  let hasTransparentPixel = false;
  for (let offset = 3; offset < sourceData.length; offset += 4) {
    const alpha = sourceData[offset];
    if (alpha > 0) hasVisiblePixel = true;
    if (alpha < 250) hasTransparentPixel = true;
    if (hasVisiblePixel && hasTransparentPixel) break;
  }
  if (!hasVisiblePixel || !hasTransparentPixel) return null;

  const width = targetWidth + (padding * 2);
  const height = targetHeight + (padding * 2);
  const mask = new Float32Array(width * height);

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor(((targetY + 0.5) * sourceHeight) / targetHeight),
    );
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor(((targetX + 0.5) * sourceWidth) / targetWidth),
      );
      const sourceOffset = ((sourceY * sourceWidth) + sourceX) * 4;
      const targetOffset = ((targetY + padding) * width) + targetX + padding;
      mask[targetOffset] = sourceData[sourceOffset + 3] / 255;
    }
  }

  return { mask, width, height };
}

function boxBlurAlpha(input, width, height, radius) {
  const diameter = (radius * 2) + 1;
  const horizontal = new Float32Array(input.length);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x <= radius && x < width; x += 1) sum += input[row + x];

    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum / diameter;
      const removeX = x - radius;
      const addX = x + radius + 1;
      if (removeX >= 0) sum -= input[row + removeX];
      if (addX < width) sum += input[row + addX];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = 0; y <= radius && y < height; y += 1) sum += horizontal[(y * width) + x];

    for (let y = 0; y < height; y += 1) {
      output[(y * width) + x] = sum / diameter;
      const removeY = y - radius;
      const addY = y + radius + 1;
      if (removeY >= 0) sum -= horizontal[(removeY * width) + x];
      if (addY < height) sum += horizontal[(addY * width) + x];
    }
  }

  return output;
}

function createPortraitSilhouetteGlow(source, targetWidth, targetHeight, color) {
  const width = Math.max(1, Math.round(Number(targetWidth) || 0));
  const height = Math.max(1, Math.round(Number(targetHeight) || 0));
  const channels = colorChannels(color);
  if (!channels) return null;

  const scaled = scaledAlphaMask(source, width, height, GLOW_PADDING_PX);
  if (!scaled) return null;

  let alpha = scaled.mask;
  for (let pass = 0; pass < GLOW_BLUR_PASSES; pass += 1) {
    alpha = boxBlurAlpha(alpha, scaled.width, scaled.height, GLOW_BLUR_RADIUS_PX);
  }

  const glow = PImage.make(scaled.width, scaled.height);
  const [red, green, blue] = channels;
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * 4;
    glow.data[offset] = red;
    glow.data[offset + 1] = green;
    glow.data[offset + 2] = blue;
    glow.data[offset + 3] = Math.round(Math.min(1, alpha[pixel] * GLOW_OPACITY) * 255);
  }
  return glow;
}

function clearGlowAbove(glow, drawTop, clipTop) {
  const rowsToClear = Math.min(
    glow.height,
    Math.max(0, Math.ceil(clipTop - drawTop)),
  );
  for (let row = 0; row < rowsToClear; row += 1) {
    const rowStart = row * glow.width * 4;
    const rowEnd = rowStart + (glow.width * 4);
    for (let offset = rowStart + 3; offset < rowEnd; offset += 4) {
      glow.data[offset] = 0;
    }
  }
}

function drawPortraitSilhouetteGlow(context, source, x, y, width, height, color) {
  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  const glow = createPortraitSilhouetteGlow(source, targetWidth, targetHeight, color);
  if (!glow) return false;

  const drawLeft = Math.round(x) - GLOW_PADDING_PX;
  const drawTop = Math.round(y) - GLOW_PADDING_PX;
  clearGlowAbove(glow, drawTop, GLOW_HEADER_CLIP_TOP_PX);

  context.drawImage(
    glow,
    drawLeft,
    drawTop,
    glow.width,
    glow.height,
  );
  return true;
}

module.exports = {
  GLOW_PADDING_PX,
  GLOW_BLUR_EXTENT_PX,
  GLOW_HEADER_CLIP_TOP_PX,
  portraitSilhouetteMetrics,
  portraitGlowTopOffsetPx,
  portraitGlowRightOffsetPx,
  createPortraitSilhouetteGlow,
  drawPortraitSilhouetteGlow,
};
