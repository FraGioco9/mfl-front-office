import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { createRequire } from "node:module";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const occurrences = (source, value) => source.split(value).length - 1;

const paths = [
  "./api/_wallet-proof.js",
  "./api/_supabase.js",
  "./api/_request-body.js",
  "./api/_evaluation-payload.js",
  "./api/_data-auth.js",
  "./api/wallet-access.js",
  "./api/wallet-opt-ins.js",
  "./api/wallet-preferences.js",
  "./api/evaluation-save.js",
  "./api/evaluation-share.js",
  "./api/wallet-permissions-version.js",
  "./api/mfl-season-ratios-v2.js",
];
const sources = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await read(path)])));
const source = (path) => sources[path];
const combined = Object.values(sources).join("\n");

const walletProof = source("./api/_wallet-proof.js");
const supabase = source("./api/_supabase.js");
const requestBody = source("./api/_request-body.js");
const evaluationPayload = source("./api/_evaluation-payload.js");
const dataAuth = source("./api/_data-auth.js");
const walletAccess = source("./api/wallet-access.js");
const walletOptIns = source("./api/wallet-opt-ins.js");
const walletPreferences = source("./api/wallet-preferences.js");
const evaluationSave = source("./api/evaluation-save.js");
const evaluationShare = source("./api/evaluation-share.js");
const permissionsVersion = source("./api/wallet-permissions-version.js");
const seasonRatios = source("./api/mfl-season-ratios-v2.js");

includes(walletProof, "async function signedWalletFromRequest(request, options = {})", "Wallet proof verification must have one configurable canonical owner.");
includes(walletProof, "allowAccountProofFallback", "Wallet proof fallback behavior must be explicit rather than copied into endpoints.");
invariant(occurrences(combined, "function normalizeWalletAddress(") === 1, "API wallet-address normalization must have exactly one owner.");
invariant(occurrences(combined, "function signatureWalletAddresses(") === 1, "API signature-wallet extraction must have exactly one owner.");
invariant(occurrences(combined, "function walletAccessMessage(") === 1, "API wallet proof message logic must have exactly one owner.");
invariant(occurrences(combined, "function stringToHex(") === 1, "API wallet proof hex conversion must have exactly one owner.");

includes(supabase, "function supabaseConfig(options = {})", "Supabase environment parsing must have one configurable canonical owner.");
includes(supabase, "async function supabaseRequest(pathname, options = {}, configOptions = {})", "Supabase REST transport must have one canonical owner.");
invariant(occurrences(combined, "function supabaseConfig(") === 1, "API Supabase configuration must have exactly one owner.");
invariant(occurrences(combined, "function supabaseRequest(") === 1, "API Supabase REST transport must have exactly one owner.");
includes(seasonRatios, "supabaseConfig({ allowAnonKey: true })", "MFL season ratios must retain service-role/anon-key fallback through the shared Supabase owner.");

includes(requestBody, "async function readRequestBody(request)", "Request body streaming must have one canonical owner.");
includes(requestBody, "async function readJsonBody(request)", "JSON request parsing must have one canonical owner.");
invariant(occurrences(combined, "for await (const chunk of request)") === 1, "API request-body streaming must not be duplicated across endpoints.");

includes(evaluationPayload, "function normalizeEvaluationId(value)", "Evaluation IDs must have one canonical normalizer.");
includes(evaluationPayload, "function generateEvaluationId()", "Evaluation IDs must have one canonical generator.");
includes(evaluationPayload, "function normalizeLateSeasonRewardRates(value)", "Late-season reward rates must have one canonical normalizer.");
includes(evaluationPayload, "function normalizeEvaluationPayload(payload, options = {})", "Evaluation API payloads must have one canonical normalizer.");
invariant(occurrences(combined, "function normalizeEvaluationId(") === 1, "Evaluation ID normalization must not be duplicated.");
invariant(occurrences(combined, "function generateEvaluationId(") === 1, "Evaluation ID generation must not be duplicated.");
invariant(occurrences(combined, "function normalizeLateSeasonRewardRates(") === 1, "Evaluation reward-rate normalization must not be duplicated.");
invariant(occurrences(combined, "function normalizeEvaluationPayload(") === 1, "Evaluation payload normalization must not be duplicated.");

includes(dataAuth, 'require("./_wallet-proof")', "Data auth must reuse the canonical wallet-proof owner.");
includes(dataAuth, 'require("./_supabase")', "Data auth must reuse the canonical Supabase owner.");
includes(walletAccess, 'require("./_data-auth")', "Wallet access must reuse shared signed-wallet and permission ownership.");
includes(walletOptIns, 'require("./_wallet-proof")', "Wallet opt-ins must reuse canonical wallet proof verification.");
includes(walletOptIns, "allowAccountProofFallback: true", "Wallet opt-ins must preserve their account-proof fallback explicitly.");
includes(walletPreferences, 'require("./_request-body")', "Wallet preferences must reuse canonical request-body parsing.");
includes(walletPreferences, 'require("./_evaluation-payload")', "Wallet preferences must reuse canonical Evaluation reward-rate normalization.");
includes(evaluationSave, 'require("./_evaluation-payload")', "Saved Evaluations must reuse canonical Evaluation payload normalization.");
includes(evaluationSave, "includeSummaryMetrics: true", "Saved Evaluations must explicitly retain summary metrics.");
includes(evaluationShare, 'require("./_evaluation-payload")', "Shared Evaluations must reuse canonical Evaluation payload normalization.");
includes(permissionsVersion, 'require("./_supabase")', "Wallet permission metadata must reuse canonical Supabase ownership.");

for (const [path, endpoint] of [
  ["wallet-access", walletAccess],
  ["wallet-opt-ins", walletOptIns],
  ["wallet-preferences", walletPreferences],
  ["evaluation-save", evaluationSave],
  ["evaluation-share", evaluationShare],
]) {
  for (const duplicate of [
    "function normalizeWalletAddress(",
    "function signatureWalletAddresses(",
    "function walletAccessMessage(",
    "function stringToHex(",
    "async function verifyWalletProof(",
  ]) {
    excludes(endpoint, duplicate, `${path} must not reintroduce copied wallet-proof logic via ${duplicate}`);
  }
}

for (const [path, endpoint] of [
  ["data-auth", dataAuth],
  ["wallet-access", walletAccess],
  ["wallet-opt-ins", walletOptIns],
  ["wallet-preferences", walletPreferences],
  ["evaluation-save", evaluationSave],
  ["evaluation-share", evaluationShare],
  ["wallet-permissions-version", permissionsVersion],
  ["mfl-season-ratios-v2", seasonRatios],
]) {
  excludes(endpoint, "function supabaseConfig(", `${path} must not reintroduce a local Supabase config owner.`);
}

const require = createRequire(import.meta.url);
const {
  normalizeEvaluationPayload,
  normalizeLateSeasonRewardRates,
} = require("./api/_evaluation-payload.js");
const { normalizeWalletAddress } = require("./api/_wallet-proof.js");

invariant(normalizeWalletAddress(" FF8D2BBED8164DB0 ") === "0xff8d2bbed8164db0", "Shared wallet normalization must preserve the existing address contract.");
invariant(JSON.stringify(normalizeLateSeasonRewardRates([90, "invalid", 0])) === JSON.stringify([90, 80, 0]), "Shared reward-rate normalization must preserve defaults and valid zero rates.");

const sharePayload = normalizeEvaluationPayload({ playerId: "42", summaryOverall: 88.4, summaryAge: 23.2 });
const savePayload = normalizeEvaluationPayload(
  { playerId: "42", summaryOverall: 88.4, summaryAge: 23.2 },
  { includeSummaryMetrics: true },
);
invariant(sharePayload && !("summaryOverall" in sharePayload) && !("summaryAge" in sharePayload), "Shared Evaluation payloads must keep their existing summary-metric omission.");
invariant(savePayload?.summaryOverall === 88 && savePayload?.summaryAge === 23, "Saved Evaluation payloads must keep their existing rounded summary metrics.");

console.log("Shared API logic validation passed: wallet proof, Supabase access, request parsing, and Evaluation normalization each have one canonical owner.");
