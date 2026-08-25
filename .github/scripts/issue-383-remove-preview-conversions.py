from pathlib import Path

preview_path = Path("site/api/_evaluation-preview-value.js")
preview = preview_path.read_text()
old = '''const EVALUATION_CONVERSIONS = Object.freeze({
  1: 300,
  2: 333,
  3: 333,
  4: 300,
  5: 225,
  6: 250,
  7: 333,
  8: 400,
  9: 450,
  10: 500,
  11: 475,
  12: 450,
  13: 450,
  14: 400,
});

'''
if preview.count(old) != 1:
    raise SystemExit("preview legacy conversion table anchor mismatch")
preview = preview.replace(old, "", 1)
old_export = '''module.exports = {
  EVALUATION_CONVERSIONS,
  evaluationContractValue,'''
new_export = '''module.exports = {
  evaluationContractValue,'''
if preview.count(old_export) != 1:
    raise SystemExit("preview legacy conversion export anchor mismatch")
preview_path.write_text(preview.replace(old_export, new_export, 1))

validator_path = Path("site/validate-evaluation-share-preview.mjs")
validator = validator_path.read_text()
old_import = '''const {
  EVALUATION_CONVERSIONS,
  evaluationContractValue,'''
new_import = '''const {
  evaluationContractValue,'''
if validator.count(old_import) != 1:
    raise SystemExit("preview validator legacy conversion import anchor mismatch")
validator = validator.replace(old_import, new_import, 1)
old_check = '''const conversionsMatch = evaluationRuntime.match(/const evaluationConversions = \\{([\\s\\S]*?)\\};/);
assert(conversionsMatch, "Generated Evaluation runtime must expose canonical discount-rate conversions.");
const canonicalConversions = Object.fromEntries(
  [...conversionsMatch[1].matchAll(/(\\d+):\\s*([\\d.]+)/g)].map((match) => [match[1], Number(match[2])]),
);
assert(
  JSON.stringify(canonicalConversions) === JSON.stringify(EVALUATION_CONVERSIONS),
  "Preview valuation discount-rate conversions must match the canonical Evaluation runtime.",
);
'''
new_check = '''assert(
  !evaluationRuntime.includes("const evaluationConversions = {")
    && !previewValue.includes("EVALUATION_CONVERSIONS")
    && !previewValue.includes("const evaluationConversions = {")
    && previewValue.includes("evaluationDiscountRateValueFromRatios(ratioRows, mflPerUsd)"),
  "Evaluation preview valuation must use supplied live season-ratio data and must not retain a legacy hard-coded discount-rate conversion table.",
);
'''
if validator.count(old_check) != 1:
    raise SystemExit("preview validator legacy conversion parity block anchor mismatch")
validator_path.write_text(validator.replace(old_check, new_check, 1))
