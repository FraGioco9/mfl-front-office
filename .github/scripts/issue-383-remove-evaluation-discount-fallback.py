from pathlib import Path
import re

core_path = Path("site/modules/app-core.js")
core = core_path.read_text()
legacy = re.compile(
    r'const evaluationConversions = \{\n.*?\n\};\n\nfunction evaluationDiscountRateValue\(currentSeason = 15, seasonsToAverage = 5\) \{\n.*?\n\}\n\nfunction formatEvaluationRate',
    re.S,
)
replacement = '''function evaluationDiscountRateValue() {
  const liveRate = window.__mflSupabaseDiscountRateFunction?.();
  return Number.isFinite(liveRate) ? liveRate : null;
}

function formatEvaluationRate'''
core, count = legacy.subn(replacement, core, count=1)
if count != 1:
    raise SystemExit("legacy Evaluation discount-rate calculation anchor mismatch")
core_path.write_text(core)

splitter_path = Path("site/modules/app-core-evaluation-chunk.js")
splitter = splitter_path.read_text()
old = '''  let extracted = extractRequiredSection(
    core,
    "const evaluationConversions = {",
    "function evaluationDiscountRateValue(",
    "Evaluation discount-rate conversion data",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  const routeOnlyHelpers = extractRequiredFunctions('''
new = '''  const routeOnlyHelpers = extractRequiredFunctions('''
if splitter.count(old) != 1:
    raise SystemExit("Evaluation conversion splitter anchor mismatch")
splitter = splitter.replace(old, new, 1)
old = '''  extracted = extractRequiredSection(
    core,
    "function formatAdvancedPlayerTableValue(value) {",'''
new = '''  let extracted = extractRequiredSection(
    core,
    "function formatAdvancedPlayerTableValue(value) {",'''
if splitter.count(old) != 1:
    raise SystemExit("Evaluation splitter declaration anchor mismatch")
splitter_path.write_text(splitter.replace(old, new, 1))

route_validator_path = Path("site/validate-evaluation-route-ownership.mjs")
route_validator = route_validator_path.read_text()
old = '''invariant(
  evaluation.includes("const evaluationConversions = {"),
  "Evaluation route core must own discount-rate conversion data.",
);'''
new = '''invariant(
  !evaluation.includes("const evaluationConversions = {"),
  "Evaluation route core must not retain legacy hard-coded discount-rate conversion data.",
);'''
if route_validator.count(old) != 1:
    raise SystemExit("Evaluation route ownership validator anchor mismatch")
route_validator_path.write_text(route_validator.replace(old, new, 1))

derived_validator_path = Path("site/validate-evaluation-discount-derived-loading.mjs")
derived = derived_validator_path.read_text()
old = '''const [appCore, rateRuntime] = await Promise.all([
  read("./modules/app-core.js"),
  read("./evaluation-discount-rate-runtime.js"),
]);'''
new = '''const [appCore, rateRuntime, indexHtml] = await Promise.all([
  read("./modules/app-core.js"),
  read("./evaluation-discount-rate-runtime.js"),
  read("./index.html"),
]);'''
if derived.count(old) != 1:
    raise SystemExit("Evaluation discount validator read anchor mismatch")
derived = derived.replace(old, new, 1)
anchor = '''invariant(
  appCore.includes("const discountDerivedValuesReady = Number.isFinite(discountRate);")'''
addition = '''invariant(
  !appCore.includes("const evaluationConversions = {")
    && !appCore.includes("currentSeason = 15, seasonsToAverage = 5")
    && appCore.includes("function evaluationDiscountRateValue() {\\n  const liveRate = window.__mflSupabaseDiscountRateFunction?.();\\n  return Number.isFinite(liveRate) ? liveRate : null;\\n}")
    && !indexHtml.includes("last five completed seasons"),
  "Evaluation Discount Rate must have no legacy static conversion fallback or stale first-paint tooltip; unresolved state must wait for the live authority.",
);

'''
if derived.count(anchor) != 1:
    raise SystemExit("Evaluation discount validator insertion anchor mismatch")
derived_validator_path.write_text(derived.replace(anchor, addition + anchor, 1))

index_path = Path("site/index.html")
index_html = index_path.read_text()
old = '<section class="evaluationMetric evaluationDiscountRate" aria-label="Discount rate" tabindex="0" data-tooltip="Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 15, so it uses seasons 10-14.">'
new = '<section class="evaluationMetric evaluationDiscountRate" aria-label="Discount rate" tabindex="0">'
if index_html.count(old) != 1:
    raise SystemExit("Evaluation static discount tooltip anchor mismatch")
index_path.write_text(index_html.replace(old, new, 1))
