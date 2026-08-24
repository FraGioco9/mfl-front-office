import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const readText = (path) => readFileSync(resolve(siteRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { renderEvaluationPreviewPng } = require("./api/_evaluation-preview-card.js");
const {
  EVALUATION_CONVERSIONS,
  evaluationContractValue,
  evaluationExpectedSeasonsFromPlayer,
  evaluationPresentValueTotalFromSharePayload,
  formatEvaluationPreviewCurrency,
} = require("./api/_evaluation-preview-value.js");
const { evaluationSharePreviewFromContext } = require("./api/_evaluation-share-preview.js");
const {
  evaluationCanonicalUrl,
  evaluationPreviewImageUrl,
} = require("./api/evaluation-preview.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngChunkCrc(chunk) {
  let crc = 0xffffffff;
  for (const byte of chunk) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(image, label) {
  assert(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${label} must be a PNG.`);
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  const bitDepth = image[24];
  const colorType = image[25];
  assert(width === 2400 && height === 1260, `${label} must be rendered at 2400x1260 for 2x preview sharpness.`);
  assert([2, 6].includes(colorType) && bitDepth === 8, `${label} must use browser-safe 8-bit RGB/RGBA PNG encoding.`);
  assert(image[26] === 0 && image[27] === 0 && image[28] === 0, `${label} must use standard PNG compression, filtering, and non-interlaced encoding.`);

  const idatChunks = [];
  let offset = 8;
  let sawIend = false;
  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert(dataEnd + 4 <= image.length, `${label} contains a truncated chunk.`);
    const type = image.toString("ascii", typeStart, dataStart);
    const storedCrc = image.readUInt32BE(dataEnd);
    const calculatedCrc = pngChunkCrc(image.subarray(typeStart, dataEnd));
    assert(storedCrc === calculatedCrc, `${label} ${type} chunk has an invalid CRC.`);
    if (type === "IDAT") idatChunks.push(image.subarray(dataStart, dataEnd));
    offset = dataEnd + 4;
    if (type === "IEND") {
      assert(length === 0, `${label} IEND chunk must be empty.`);
      sawIend = true;
      break;
    }
  }

  assert(idatChunks.length > 0, `${label} must contain image data.`);
  assert(sawIend && offset === image.length, `${label} must end with a complete IEND chunk.`);

  let decoded;
  try {
    decoded = inflateSync(Buffer.concat(idatChunks));
  } catch (error) {
    throw new Error(`${label} image data must decode successfully: ${error.message}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  assert(decoded.length === height * (rowBytes + 1), `${label} decoded data must match its declared dimensions.`);
  for (let row = 0; row < height; row += 1) {
    assert(decoded[row * (rowBytes + 1)] <= 4, `${label} row ${row} uses an invalid filter type.`);
  }
}

const indexHtml = readText("index.html");
const previewApi = readText("api/evaluation-preview.js");
const previewImageApi = readText("api/evaluation-preview-image.js");
const previewCard = readText("api/_evaluation-preview-card.js");
const previewValue = readText("api/_evaluation-preview-value.js");
const previewOwner = readText("api/_evaluation-share-preview.js");
const shareApi = readText("api/evaluation-share.js");
const evaluationRuntime = readText("modules/app-core-evaluation-runtime.js");
const siteStyles = readText("styles-base.css");
const persistenceDoc = readText("../SUPABASE_PERSISTENCE.md");
const packageJson = JSON.parse(readText("package.json"));
const configs = ["vercel.json", "vercel.production.json"].map((path) => [path, JSON.parse(readText(path))]);

for (const [path, config] of configs) {
  const previewIncludeFiles = String(config.functions?.["api/evaluation-preview.js"]?.includeFiles || "");
  const imageIncludeFiles = String(config.functions?.["api/evaluation-preview-image.js"]?.includeFiles || "");
  assert(
    previewIncludeFiles.includes("index.html") && previewIncludeFiles.includes("api/data-files/mfl_database.db"),
    `${path} must bundle index.html and the public player database with the Evaluation preview function.`,
  );
  assert(
    imageIncludeFiles.includes("api/data-files/mfl_database.db")
      && imageIncludeFiles.includes("node_modules/@expo-google-fonts/titillium-web")
      && imageIncludeFiles.includes(".ttf"),
    `${path} must bundle the public player database and Titillium Web TTF assets with the Evaluation preview-image function.`,
  );

  const previewRewriteIndex = config.rewrites?.findIndex((rewrite) => (
    rewrite.source === "/evaluation"
    && rewrite.destination === "/api/evaluation-preview"
  ));
  const catchAllIndex = config.rewrites?.findIndex((rewrite) => rewrite.source === "/(.*)");
  assert(previewRewriteIndex >= 0, `${path} must route direct Evaluation URLs through the preview-aware SPA endpoint.`);
  assert(catchAllIndex < 0 || previewRewriteIndex < catchAllIndex, `${path} must resolve the Evaluation preview route before the SPA catch-all.`);
}

assert(
  previewOwner.includes("select=id,player_id,payload,expires_at"),
  "Evaluation preview lookup must select only public share fields.",
);
assert(
  !previewOwner.includes("select=id,player_id,payload,expires_at,wallet_address")
    && !previewOwner.includes("select=wallet_address"),
  "Evaluation preview lookup must not select the creator wallet.",
);
assert(previewOwner.includes("expires_at=gt."), "Evaluation preview lookup must reject expired shares at the query owner.");
assert(previewOwner.includes("evaluationSharePreview"), "One helper must own shared Evaluation metadata derivation.");
assert(
  previewOwner.includes("SELECT name, age, retirement_years FROM players WHERE player_id = ? LIMIT 1")
    && previewOwner.includes("queryOne"),
  "Active shared previews must resolve current public player identity and compatibility context from the packaged player database.",
);
assert(
  previewOwner.includes("evaluationPresentValueTotalFromSharePayload(payload, {")
    && previewOwner.includes("Value"),
  "Shared preview metadata must expose the same Value represented by the Evaluation summary table.",
);
assert(shareApi.includes("readActiveEvaluationShare"), "Evaluation share hydration must reuse the active-share lookup owner.");
assert(
  shareApi.includes("includeSummaryMetrics: true"),
  "New public Evaluation shares must retain summary metrics used by the dynamic preview card.",
);

for (const requiredMeta of [
  'property="og:title"',
  'property="og:description"',
  'property="og:url"',
  'property="og:image"',
  'property="og:image:type" content="image/png"',
  'property="og:image:width" content="2400"',
  'property="og:image:height" content="1260"',
  'name="twitter:card" content="summary_large_image"',
  'name="twitter:title"',
  'name="twitter:description"',
  'name="twitter:image"',
]) {
  assert(previewApi.includes(requiredMeta), `Evaluation preview HTML must include ${requiredMeta}.`);
}
assert((indexHtml.match(/<th>Value<\/th>/g) || []).length === 2, "Both Evaluation tables must label the discounted result as Value.");
assert(!indexHtml.includes("<th>Present Value</th>"), "Evaluation tables must not expose the old Present Value label.");
assert(previewOwner.includes("`Value ${formatEvaluationPreviewCurrency(presentValue)}`"), "Shared-link metadata must label the metric as Value.");
assert(!previewOwner.includes("`Present Value ${formatEvaluationPreviewCurrency(presentValue)}`"), "Shared-link metadata must not expose the old Present Value label.");
assert(previewApi.includes("htmlEscape"), "Evaluation preview metadata must be HTML-escaped before injection.");
assert(previewApi.includes("GENERIC_PREVIEW"), "Plain, invalid, or unavailable Evaluations must use generic metadata.");
assert(previewApi.includes("if (shareId && supabaseConfig())"), "Only shared Evaluation URLs may query Supabase for preview metadata.");
assert(previewApi.includes("noindex,nofollow,noarchive"), "Evaluation preview pages must opt out of indexing.");
assert(previewApi.includes("/api/evaluation-preview-image"), "Shared Evaluation metadata must reference the dynamic preview-image endpoint.");
assert(!previewApi.includes("evaluation-share-preview.png"), "Shared Evaluation metadata must not depend on one static preview image.");

const canonicalUrl = evaluationCanonicalUrl("http://localhost:4000", "abcd1234", "12345");
const imageUrl = evaluationPreviewImageUrl("http://localhost:4000", "abcd1234", "12345");
assert(
  canonicalUrl === "http://localhost:4000/evaluation?player=12345&share=abcd1234",
  "Evaluation canonical share URLs must put player before share.",
);
assert(
  imageUrl === "http://localhost:4000/api/evaluation-preview-image?player=12345&share=abcd1234",
  "Evaluation preview-image URLs must put player before share.",
);

assert(previewImageApi.includes("readActiveEvaluationShare"), "Dynamic preview images must reuse the canonical active-share lookup.");
assert(previewImageApi.includes("evaluationSharePreview"), "Dynamic preview images must reuse canonical public share metadata.");
assert(previewImageApi.includes("await renderEvaluationPreviewPng"), "Dynamic preview images must await the portable PNG renderer.");
assert(previewImageApi.includes('"Content-Type", "image/png"'), "Dynamic preview endpoint must return PNG content.");

assert(packageJson.dependencies?.["@expo-google-fonts/titillium-web"] === "0.4.1", "Preview rendering must pin portable Titillium Web TTF assets.");
assert(packageJson.dependencies?.pureimage === "0.4.20", "Preview rendering must pin the pure-JavaScript Canvas renderer.");
assert(!packageJson.dependencies?.["@napi-rs/canvas"], "Preview rendering must not depend on a native Canvas binary.");
assert(!packageJson.dependencies?.["@fontsource/titillium-web"], "Preview rendering must not retain the obsolete WOFF-only font package.");
assert(siteStyles.includes('font-family: "Titillium Web"'), "The site must continue to use Titillium Web as its canonical font.");
assert(previewCard.includes('const FONT_FAMILY = "Titillium Web"'), "Dynamic Evaluation preview cards must use the same Titillium Web font as the site.");
assert(
  previewCard.includes('require("pureimage")')
    && previewCard.includes("@expo-google-fonts/titillium-web")
    && previewCard.includes("TitilliumWeb_400Regular.ttf")
    && previewCard.includes("TitilliumWeb_600SemiBold.ttf")
    && previewCard.includes("TitilliumWeb_700Bold.ttf"),
  "Dynamic cards must render the actual Titillium Web 400/600/700 TTFs without native binaries.",
);
assert(!previewCard.includes("@napi-rs/canvas"), "Dynamic preview card source must remain native-binary free.");
assert(previewCard.includes("const RENDER_SCALE = 2"), "Dynamic cards must render at 2x density for sharper social previews.");
assert(previewCard.includes("drawSummaryStrip"), "Dynamic cards must use one unified Summary strip rather than detached metric boxes.");
assert(!previewCard.includes("24 HOUR PUBLIC SHARE"), "Dynamic cards must not show the redundant 24-hour public-share badge.");
assert(previewCard.includes('"Shared Evaluation"'), "Dynamic cards may retain one concise shared-Evaluation context label.");
assert(previewCard.includes("metadata.playerName"), "Dynamic Evaluation preview card must render the current public player name.");
assert(previewCard.includes("Player #${"), "Dynamic Evaluation preview card must retain the player identifier as secondary context.");
for (const field of ["Overall", "Position", "Age", "Value"]) {
  assert(previewCard.includes(`"${field}"`), `Dynamic Evaluation preview card must render ${field}.`);
}
assert(!previewCard.includes('"TOTAL VALUE"'), "Dynamic Evaluation preview card must not label the summary metric as Total Value.");
assert(previewCard.includes("formatEvaluationPreviewCurrency"), "Dynamic Evaluation preview card must use the Evaluation currency format for Value.");

for (const [cssToken, rendererToken] of [
  ["--page-bg: #101418", 'pageBg: "#101418"'],
  ["--surface: #171d22", 'surface: "#171d22"'],
  ["--surface-muted: #1d252c", 'surfaceMuted: "#1d252c"'],
  ["--border: #303b44", 'border: "#303b44"'],
  ["--text: #e8eef3", 'text: "#e8eef3"'],
  ["--text-muted: #a9b4bd", 'muted: "#a9b4bd"'],
  ["--primary: #4aa3df", 'primary: "#4aa3df"'],
]) {
  assert(siteStyles.includes(cssToken), `Site styles must retain ${cssToken}.`);
  assert(previewCard.includes(rendererToken), `Evaluation preview card must mirror site token ${cssToken}.`);
}

assert(
  !previewValue.includes("_supabase")
    && !previewValue.includes("wallet_address")
    && !previewValue.includes("evaluation_saves"),
  "Preview valuation must derive only from the validated public share payload and must not query private persistence.",
);
assert(
  previewValue.includes("const rawExpectedSeasons = overallValues.length || evaluationExpectedSeasonsFromPlayer(playerContext);"),
  "Preview Present Value must prefer the exact Expected Seasons horizon already encoded by the shared Evaluation snapshot.",
);

const tableMatch = evaluationRuntime.match(/const advancedPlayerTableTsv = `([\s\S]*?)`;/);
assert(tableMatch, "Generated Evaluation runtime must expose the canonical Advanced Player valuation table.");
const tableRows = tableMatch[1].trim().split("\n").map((line) => line.split("\t"));
const tableHeaders = tableRows.shift();
for (const row of tableRows) {
  const overall = Number(row[0]);
  tableHeaders.slice(1).forEach((position, index) => {
    const canonicalValue = Number(row[index + 1]) || 0;
    const previewContractValue = evaluationContractValue(overall, position);
    assert(
      Math.abs(previewContractValue - canonicalValue) < 1e-9,
      `Preview valuation must match the canonical contract table for ${overall} ${position}.`,
    );
  });
}

const conversionsMatch = evaluationRuntime.match(/const evaluationConversions = \{([\s\S]*?)\};/);
assert(conversionsMatch, "Generated Evaluation runtime must expose canonical discount-rate conversions.");
const canonicalConversions = Object.fromEntries(
  [...conversionsMatch[1].matchAll(/(\d+):\s*([\d.]+)/g)].map((match) => [match[1], Number(match[2])]),
);
assert(
  JSON.stringify(canonicalConversions) === JSON.stringify(EVALUATION_CONVERSIONS),
  "Preview valuation discount-rate conversions must match the canonical Evaluation runtime.",
);

const publicPlayer = { playerId: 80000, age: 34, retirementYears: 0 };
assert(evaluationExpectedSeasonsFromPlayer(publicPlayer) === 4, "Compatibility expected-season fallback must match the Evaluation page's minimum four-season rule.");
assert(evaluationExpectedSeasonsFromPlayer({ playerId: 80000, age: 34, retirementYears: 2 }) === 2, "Compatibility retirement fallback must honor announced retirement years.");

const summaryPayload = {
  overallValues: [82, 82, 82, 82],
  summaryPosition: "ST",
  mflPerUsd: 400,
  ignoreDiscountRate: true,
  ignoreFirstSeason: false,
  lateSeasonRewardRates: [100, 100, 100],
};
const summaryPresentValue = evaluationPresentValueTotalFromSharePayload(summaryPayload, publicPlayer);
assert(Math.abs(summaryPresentValue - 24) < 1e-9, "Preview Present Value must sum exactly the four Present Value rows saved by the Evaluation summary table.");

const ignoredFirstSeasonValue = evaluationPresentValueTotalFromSharePayload(
  { ...summaryPayload, ignoreFirstSeason: true },
  publicPlayer,
);
assert(Math.abs(ignoredFirstSeasonValue - 18) < 1e-9, "Preview Present Value must use the same first-season offset as the Evaluation summary table.");

const retirementPresentValue = evaluationPresentValueTotalFromSharePayload(
  { ...summaryPayload, overallValues: [82, 82] },
  { ...publicPlayer, retirementYears: 2 },
);
assert(Math.abs(retirementPresentValue - 12) < 1e-9, "A shared two-season retirement horizon must produce exactly the two rows saved by Evaluation.");

const savedLongHorizonValue = evaluationPresentValueTotalFromSharePayload(
  { ...summaryPayload, overallValues: [82, 82, 82, 82, 82, 82, 82, 82] },
  publicPlayer,
);
assert(
  Math.abs(savedLongHorizonValue - 48) < 1e-9,
  "Preview Present Value must preserve the share's saved horizon even when separate public-player context would currently infer fewer seasons.",
);
assert(formatEvaluationPreviewCurrency(12345.67) === "$12,345.67", "Preview Present Value must use canonical USD formatting.");

const contextualPreview = evaluationSharePreviewFromContext({
  id: "abcd1234",
  playerId: "80000",
  payload: {
    ...summaryPayload,
    summaryOverall: 82,
    summaryAge: 99,
  },
}, {
  playerId: "80000",
  playerName: "Mario Rossi",
  age: 34,
  retirementYears: 0,
});
assert(contextualPreview.playerName === "Mario Rossi", "Shared preview metadata must use the current public player name.");
assert(contextualPreview.age === 34, "Shared preview metadata must use the current public player age instead of a projected payload age.");
assert(contextualPreview.presentValue === summaryPresentValue, "Shared preview metadata Present Value must equal the Evaluation summary-table Present Value.");
assert(contextualPreview.title === "Mario Rossi Evaluation - MFL Front Office", "Shared preview title must identify the player by name.");
assert(
  contextualPreview.description.includes("Age 34")
    && contextualPreview.description.includes("Present Value $24.00")
    && !contextualPreview.description.includes("Age 99"),
  "Shared preview description must expose current age and canonical Present Value only.",
);

assert(
  persistenceDoc.includes("site/api/_evaluation-share-preview.js")
    && persistenceDoc.includes("never exposes or selects the creator wallet")
    && persistenceDoc.includes("saved `overallValues` array")
    && persistenceDoc.includes("2400x1260")
    && persistenceDoc.includes("Present Value"),
  "Supabase persistence documentation must describe the saved-horizon Present Value boundary and high-resolution card.",
);

const genericImage = await renderEvaluationPreviewPng({
  isShared: false,
  playerId: "",
  playerName: "",
  overall: null,
  position: "",
  age: null,
  presentValue: null,
});
const playerImageInput = {
  isShared: true,
  playerId: "80000",
  playerName: "Mario Rossi",
  overall: 82,
  position: "ST",
  age: 34,
  presentValue: 24,
};
const playerImage = await renderEvaluationPreviewPng(playerImageInput);
const refreshedPlayerImage = await renderEvaluationPreviewPng(playerImageInput);

validatePng(genericImage, "Generic Evaluation preview image");
validatePng(playerImage, "Player-specific Evaluation preview image");
validatePng(refreshedPlayerImage, "Refreshed player-specific Evaluation preview image");
assert(!genericImage.equals(playerImage), "Player-specific Evaluation preview image must differ from the generic card.");
assert(playerImage.equals(refreshedPlayerImage), "Repeated preview renders must remain deterministic and refresh-safe in one serverless process.");

console.log("Evaluation share preview validation passed with 2x Titillium Web cards, unified Summary layout, and saved-horizon Present Value parity.");
