const PORTRAIT_CROP_HEIGHT_PX = 500;

function createPortraitCloseUp(source, cropHeightPx = PORTRAIT_CROP_HEIGHT_PX) {
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

  const requestedCropHeight = Number(cropHeightPx);
  const cropLimit = Number.isFinite(requestedCropHeight) && requestedCropHeight > 0
    ? Math.floor(requestedCropHeight)
    : PORTRAIT_CROP_HEIGHT_PX;
  const cropHeight = Math.max(1, Math.min(cropLimit, sourceHeight));
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
