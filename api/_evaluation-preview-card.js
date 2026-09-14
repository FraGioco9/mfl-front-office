const { PassThrough, Readable } = require("node:stream");
const PImage = require("pureimage");
const { formatEvaluationPreviewCurrency } = require("./_evaluation-preview-value");
const { loadPlayerPortraitBitmap } = require("./_player-portrait");
const { createPortraitCloseUp } = require("./_portrait-close-up");
const {
  portraitSilhouetteMetrics,
  portraitGlowTopOffsetPx,
  portraitGlowRightOffsetPx,
  drawPortraitSilhouetteGlow,
} = require("./_portrait-silhouette-glow");

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
const PREVIEW_HEADER_BOTTOM_Y = 96;
const PLAYER_PORTRAIT_GLOW_GAP = 8;
const PLAYER_PORTRAIT_BOUNDS = Object.freeze({ width: 600, right: 1130, bottom: 374 });
const PLAYER_TEXT_MAX_WIDTH = 1060;
const FOOTER_SEPARATOR_Y = 578;
const FOOTER_LABEL_CENTER_Y = ((FOOTER_SEPARATOR_Y + 1) + LOGICAL_HEIGHT) / 2;

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

const FLAG_CODE_BY_NATIONALITY = Object.freeze({
  ALBANIA: "AL", ALGERIA: "DZ", ARGENTINA: "AR", AUSTRALIA: "AU", AUSTRIA: "AT",
  BELGIUM: "BE", BOSNIA_AND_HERZEGOVINA: "BA", BRAZIL: "BR", CAMEROON: "CM",
  CANADA: "CA", CAPE_VERDE_ISLANDS: "CV", CHILE: "CL", COLOMBIA: "CO", CONGO_DR: "CD",
  COSTA_RICA: "CR", COTE_D_IVOIRE: "CI", CROATIA: "HR", CURACAO: "CW", CZECH_REPUBLIC: "CZ",
  CZECHIA: "CZ", DENMARK: "DK", ECUADOR: "EC", EGYPT: "EG",
  ENGLAND: "1f3f4-e0067-e0062-e0065-e006e-e0067-e007f", FINLAND: "FI", FRANCE: "FR",
  GEORGIA: "GE", GERMANY: "DE", GHANA: "GH", HAITI: "HT", HUNGARY: "HU", IRAN: "IR",
  IRAQ: "IQ", ITALY: "IT", IVORY_COAST: "CI", JAPAN: "JP", JORDAN: "JO",
  KOREA_REPUBLIC: "KR", MEXICO: "MX", MOROCCO: "MA", NETHERLANDS: "NL", NEW_ZEALAND: "NZ",
  NIGERIA: "NG", NORWAY: "NO", PANAMA: "PA", PARAGUAY: "PY", PERU: "PE", POLAND: "PL",
  PORTUGAL: "PT", QATAR: "QA", REPUBLIC_OF_IRELAND: "IE", ROMANIA: "RO", RUSSIA: "RU",
  SAUDI_ARABIA: "SA", SCOTLAND: "1f3f4-e0067-e0062-e0073-e0063-e0074-e007f", SENEGAL: "SN",
  SERBIA: "RS", SLOVAKIA: "SK", SLOVENIA: "SI", SOUTH_AFRICA: "ZA", SOUTH_KOREA: "KR",
  SPAIN: "ES", SWEDEN: "SE", SWITZERLAND: "CH", TUNISIA: "TN", TURKEY: "TR", UKRAINE: "UA",
  UNITED_KINGDOM: "GB", UNITED_STATES: "US", UNITED_STATES_OF_AMERICA: "US", URUGUAY: "UY",
  USA: "US", UZBEKISTAN: "UZ", WALES: "1f3f4-e0067-e0062-e0077-e006c-e0073-e0074-e007f",
});

const FONT_PATHS = Object.freeze([
  [400, require.resolve("@expo-google-fonts/titillium-web/400Regular/TitilliumWeb_400Regular.ttf")],
  [600, require.resolve("@expo-google-fonts/titillium-web/600SemiBold/TitilliumWeb_600SemiBold.ttf")],
  [700, require.resolve("@expo-google-fonts/titillium-web/700Bold/TitilliumWeb_700Bold.ttf")],
]);

let fontsRegistered = false;
const nationalityFlagPromises = new Map();

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
  return [...String(value ?? "")]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function rarityColorForOverall(overall) {
  const value = Number(overall || 0);

  if (value >= 95) return "#00ffe9";
  if (value >= 85) return "#fa53ff";
  if (value >= 75) return "#0077ff";
  if (value >= 65) return "#71ff30";
  if (value >= 55) return "#ecd17f";
  return "#bebebe";
}

function twemojiCodepointsForNationality(nationality) {
  const key = cardText(nationality)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const code = FLAG_CODE_BY_NATIONALITY[key] || "";
  if (!code) return "";
  return code.includes("-")
    ? code
    : code
      .toUpperCase()
      .split("")
      .map((character) => (127397 + character.charCodeAt(0)).toString(16))
      .join("-");
}

async function loadNationalityFlag(nationality) {
  const codepoints = twemojiCodepointsForNationality(nationality);
  if (!codepoints) return null;
  if (nationalityFlagPromises.has(codepoints)) return nationalityFlagPromises.get(codepoints);

  const pending = (async () => {
    try {
      const response = await fetch(
        `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`,
        { headers: { Accept: "image/png" } },
      );
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      return await PImage.decodePNGFromStream(Readable.from([bytes]));
    } catch {
      return null;
    }
  })();
  nationalityFlagPromises.set(codepoints, pending);
  return pending;
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
  fillRect(context, x, y, width, 3, rarityColorForOverall(metadata.overall));

  let cursor = x;
  columnWidths.slice(0, -1).forEach((columnWidth) => {
    cursor += columnWidth;
    fillRect(context, cursor, y + 28, 1, height - 56, COLORS.border);
  });

  drawMetric(context, x, columnWidths[0], "Position", metadata.position || "-");
  drawMetric(context, x + columnWidths[0], columnWidths[1], "Overall", metadata.overall);
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

async function drawNationalityLine(context, metadata) {
  const nationality = cardText(metadata.nationality);
  if (!nationality) return;
  const centerY = 291;
  const flagSize = 30;
  const textX = 111;
  const previousBaseline = context.textBaseline;
  const flag = await loadNationalityFlag(nationality);
  if (flag) {
    context.drawImage(
      flag,
      px(72),
      px(centerY - flagSize / 2),
      px(flagSize),
      px(flagSize),
    );
    context.textBaseline = "middle";
    context.fillStyle = COLORS.soft;
    setFont(context, 400, 26);
    context.fillText(cardText(`- ${nationality}`), px(textX), px(centerY));
    context.textBaseline = previousBaseline;
    return;
  }
  context.textBaseline = "middle";
  context.fillStyle = COLORS.soft;
  setFont(context, 400, 26);
  context.fillText(nationality, px(72), px(centerY));
  context.textBaseline = previousBaseline;
}

function fitPortraitDrawGeometry(source, bounds = PLAYER_PORTRAIT_BOUNDS, glowColor = "") {
  const sourceWidth = Number(source?.width);
  const sourceHeight = Number(source?.height);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) return null;

  const silhouetteMetrics = glowColor ? portraitSilhouetteMetrics(source) : null;
  const minimumGlowTop = px(PREVIEW_HEADER_BOTTOM_Y + PLAYER_PORTRAIT_GLOW_GAP);
  const targetGlowRight = px(bounds.right - PLAYER_PORTRAIT_GLOW_GAP);
  const maximumScale = bounds.width / sourceWidth;

  function glowTopForScale(scale) {
    const height = sourceHeight * scale;
    const y = bounds.bottom - height;
    const glowTopOffset = glowColor
      ? portraitGlowTopOffsetPx(source, px(height), silhouetteMetrics)
      : 0;
    return px(y) + glowTopOffset;
  }

  let scale = maximumScale;
  if (glowTopForScale(scale) < minimumGlowTop) {
    let low = 0;
    let high = maximumScale;
    for (let iteration = 0; iteration < 16; iteration += 1) {
      const candidate = (low + high) / 2;
      if (glowTopForScale(candidate) >= minimumGlowTop) low = candidate;
      else high = candidate;
    }
    scale = low;
  }

  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const rightGlowOffset = glowColor
    ? portraitGlowRightOffsetPx(source, px(width), silhouetteMetrics)
    : px(width);
  const x = (targetGlowRight - rightGlowOffset) / RENDER_SCALE;
  const y = bounds.bottom - height;
  return {
    x,
    y,
    width,
    height,
    naturalGlowTop: glowTopForScale(scale) / RENDER_SCALE,
    naturalGlowRight: (px(x) + rightGlowOffset) / RENDER_SCALE,
  };
}

function drawContainedImage(context, source, bounds, glowColor = "") {
  const portrait = createPortraitCloseUp(source) || source;
  const geometry = fitPortraitDrawGeometry(portrait, bounds, glowColor);
  if (!geometry) return;

  const { x, y, width, height } = geometry;
  if (glowColor) {
    drawPortraitSilhouetteGlow(
      context,
      portrait,
      px(x),
      px(y),
      px(width),
      px(height),
      glowColor,
    );
  }
  context.drawImage(portrait, px(x), px(y), px(width), px(height));
}

async function resolvePlayerPortrait(metadata, options = {}) {
  if (!metadata.isShared || !metadata.portraitUrl) return null;
  const portraitLoader = typeof options.portraitLoader === "function"
    ? options.portraitLoader
    : loadPlayerPortraitBitmap;
  try {
    return await portraitLoader(metadata.portraitUrl);
  } catch {
    return null;
  }
}

async function imageToPngBuffer(image) {
  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await PImage.encodePNGToStream(image, output);
  return Buffer.concat(chunks);
}

async function renderEvaluationPreviewPng(metadata = {}, options = {}) {
  registerPreviewFonts();
  const portrait = await resolvePlayerPortrait(metadata, options);

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
    const playerSize = fittedFontSize(context, playerLabel, 700, 72, 44, PLAYER_TEXT_MAX_WIDTH);
    if (portrait) {
      drawContainedImage(
        context,
        portrait,
        PLAYER_PORTRAIT_BOUNDS,
        rarityColorForOverall(metadata.overall),
      );
    }
    drawText(context, playerLabel, 70, 130, 700, playerSize, COLORS.text);
    drawText(context, `Player #${cardText(metadata.playerId)}`, 72, 224, 400, 29, COLORS.soft);
    await drawNationalityLine(context, metadata);
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

  fillRect(context, 70, FOOTER_SEPARATOR_Y, 1060, 1, COLORS.borderStrong);
  const previousBaseline = context.textBaseline;
  context.textBaseline = "middle";
  drawText(context, "MFL Front Office", 70, FOOTER_LABEL_CENTER_Y, 400, 20, COLORS.soft);
  context.textBaseline = previousBaseline;

  return imageToPngBuffer(image);
}

module.exports = {
  WIDTH,
  HEIGHT,
  FONT_FAMILY,
  PREVIEW_HEADER_BOTTOM_Y,
  PLAYER_PORTRAIT_GLOW_GAP,
  PLAYER_PORTRAIT_BOUNDS,
  fitPortraitDrawGeometry,
  rarityColorForOverall,
  renderEvaluationPreviewPng,
};
