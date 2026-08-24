const { PassThrough } = require("node:stream");
const PImage = require("pureimage");
const { formatEvaluationPreviewCurrency } = require("./_evaluation-preview-value");

const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 630;
const RENDER_SCALE = 2;
const WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const FONT_FAMILY = "Titillium Web";
const FONT_FAMILIES = Object.freeze({
  400: "TitilliumWebPreviewRegular",
  600: "TitilliumWebPreviewSemiBold",
  700: "TitilliumWebPreviewBold",
});

// Mirror the canonical dark-theme tokens from styles-base.css.
const COLORS = Object.freeze({
  pageBg: "#101418",
  surface: "#171d22",
  surfaceMuted: "#1d252c",
  border: "#303b44",
  borderStrong: "#46535e",
  text: "#e8eef3",
  muted: "#a9b4bd",
  soft: "#8f9ba5",
  primary: "#4aa3df",
});

const FONT_PATHS = Object.freeze([
  [400, require.resolve("@expo-google-fonts/titillium-web/400Regular/TitilliumWeb_400Regular.ttf")],
  [600, require.resolve("@expo-google-fonts/titillium-web/600SemiBold/TitilliumWeb_600SemiBold.ttf")],
  [700, require.resolve("@expo-google-fonts/titillium-web/700Bold/TitilliumWeb_700Bold.ttf")],
]);

let fontsRegistered = false;

function registerPreviewFonts() {
  if (fontsRegistered) return;
  for (const [weight, fontPath] of FONT_PATHS) {
    const font = PImage.registerFont(fontPath, FONT_FAMILIES[weight]);
    font.loadSync();
  }
  fontsRegistered = true;
}

function px(value) {
  return value * RENDER_SCALE;
}

function cardText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fontFamilyForWeight(weight) {
  return FONT_FAMILIES[weight] || FONT_FAMILIES[400];
}

function setFont(context, weight, size) {
  context.font = `${px(size)}px '${fontFamilyForWeight(weight)}'`;
}

function fittedFontSize(context, value, weight, preferredSize, minSize, maxWidth) {
  const text = cardText(value);
  let size = preferredSize;
  while (size > minSize) {
    setFont(context, weight, size);
    if (context.measureText(text).width / RENDER_SCALE <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

function fillRect(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(px(x), px(y), px(width), px(height));
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const left = px(x);
  const top = px(y);
  const right = px(x + width);
  const bottom = px(y + height);
  const scaledRadius = px(r);
  context.beginPath();
  context.moveTo(left + scaledRadius, top);
  context.lineTo(right - scaledRadius, top);
  context.quadraticCurveTo(right, top, right, top + scaledRadius);
  context.lineTo(right, bottom - scaledRadius);
  context.quadraticCurveTo(right, bottom, right - scaledRadius, bottom);
  context.lineTo(left + scaledRadius, bottom);
  context.quadraticCurveTo(left, bottom, left, bottom - scaledRadius);
  context.lineTo(left, top + scaledRadius);
  context.quadraticCurveTo(left, top, left + scaledRadius, top);
  context.closePath();
}

function drawPanel(context, x, y, width, height) {
  roundedRectPath(context, x, y, width, height, 8);
  context.fillStyle = COLORS.surface;
  context.fill();
  context.lineWidth = px(1);
  context.strokeStyle = COLORS.border;
  context.stroke();
}

function drawRectanglePanel(context, x, y, width, height) {
  fillRect(context, x, y, width, height, COLORS.surface);
  context.lineWidth = px(1);
  context.strokeStyle = COLORS.border;
  context.strokeRect(px(x), px(y), px(width), px(height));
}

function drawText(context, value, x, y, weight, size, color) {
  const text = cardText(value);
  context.fillStyle = color;
  setFont(context, weight, size);
  context.fillText(text, px(x), px(y));
}

function drawRightAlignedText(context, value, rightX, y, weight, size, color) {
  const text = cardText(value);
  setFont(context, weight, size);
  const logicalWidth = context.measureText(text).width / RENDER_SCALE;
  drawText(context, text, rightX - logicalWidth, y, weight, size, color);
}

function drawMetric(context, x, width, label, value, options = {}) {
  drawText(context, label, x + 26, 404, 600, 19, COLORS.muted);

  const displayValue = value === null || value === undefined || value === "" ? "-" : cardText(value);
  const preferredSize = Number(options.preferredSize) || 44;
  const size = fittedFontSize(context, displayValue, 700, preferredSize, 28, width - 52);
  drawText(context, displayValue, x + 26, 447, 700, size, COLORS.text);
}

function drawSummaryStrip(context, metadata) {
  const x = 70;
  const y = 374;
  const width = 1060;
  const height = 168;
  const columnWidths = [210, 210, 210, 430];

  drawRectanglePanel(context, x, y, width, height);
  fillRect(context, x, y, width, 3, COLORS.primary);

  let cursor = x;
  columnWidths.slice(0, -1).forEach((columnWidth) => {
    cursor += columnWidth;
    fillRect(context, cursor, y + 28, 1, height - 56, COLORS.border);
  });

  drawMetric(context, x, columnWidths[0], "Overall", metadata.overall);
  drawMetric(context, x + columnWidths[0], columnWidths[1], "Position", metadata.position || "-");
  drawMetric(context, x + columnWidths[0] + columnWidths[1], columnWidths[2], "Age", metadata.age);
  drawMetric(
    context,
    x + columnWidths[0] + columnWidths[1] + columnWidths[2],
    columnWidths[3],
    "Value",
    formatEvaluationPreviewCurrency(metadata.presentValue) || "-",
    { preferredSize: 44 },
  );
}

async function imageToPngBuffer(image) {
  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await PImage.encodePNGToStream(image, output);
  return Buffer.concat(chunks);
}

async function renderEvaluationPreviewPng(metadata = {}) {
  registerPreviewFonts();

  const image = PImage.make(WIDTH, HEIGHT);
  const context = image.getContext("2d");
  context.textBaseline = "top";

  fillRect(context, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, COLORS.pageBg);
  fillRect(context, 0, 0, LOGICAL_WIDTH, 96, COLORS.surface);
  fillRect(context, 0, 95, LOGICAL_WIDTH, 1, COLORS.border);

  drawText(context, "MFL Front Office", 70, 24, 700, 38, COLORS.text);
  drawRightAlignedText(
    context,
    metadata.isShared ? "Shared Evaluation" : "Evaluation Preview",
    1130,
    34,
    600,
    24,
    metadata.isShared ? COLORS.primary : COLORS.muted,
  );

  if (metadata.isShared && metadata.playerId) {
    const playerName = cardText(metadata.playerName);
    const playerLabel = playerName || `Player ${cardText(metadata.playerId)}`;
    const playerSize = fittedFontSize(context, playerLabel, 700, 72, 44, 1060);
    drawText(context, playerLabel, 70, 145, 700, playerSize, COLORS.text);
    drawText(context, `Player #${cardText(metadata.playerId)}`, 72, 246, 400, 29, COLORS.soft);
    drawSummaryStrip(context, metadata);
  } else {
    drawText(context, "Player Evaluation", 70, 153, 700, 70, COLORS.text);
    drawText(
      context,
      "Open a valid shared Evaluation to view its player summary.",
      72,
      253,
      400,
      30,
      COLORS.muted,
    );
    drawPanel(context, 70, 374, 1060, 168);
    fillRect(context, 70, 374, 1060, 3, COLORS.borderStrong);
    drawText(context, "MFL Front Office", 96, 411, 600, 21, COLORS.muted);
    drawText(context, "Shared player Evaluation preview", 96, 455, 600, 34, COLORS.text);
  }

  fillRect(context, 70, 578, 1060, 1, COLORS.borderStrong);
  drawText(context, "MFL Front Office", 70, 592, 400, 20, COLORS.soft);

  return imageToPngBuffer(image);
}

module.exports = {
  WIDTH,
  HEIGHT,
  FONT_FAMILY,
  renderEvaluationPreviewPng,
};
