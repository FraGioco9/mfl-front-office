const PORTRAIT_CROP_HEIGHT_PX = 500;

function createPortraitCloseUp(source) {
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

  const cropHeight = Math.max(1, Math.min(PORTRAIT_CROP_HEIGHT_PX, sourceHeight));
  const PImage = require("pureimage");
  const cropped = PImage.make(sourceWidth, cropHeight);
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceStart = y * sourceWidth * 4;
    const sourceEnd = sourceStart + (sourceWidth * 4);
    const targetStart = y * sourceWidth * 4;
    cropped.data.set(sourceData.subarray(sourceStart, sourceEnd), targetStart);
  }
  return cropped;
}

module.exports = {
  PORTRAIT_CROP_HEIGHT_PX,
  createPortraitCloseUp,
};
