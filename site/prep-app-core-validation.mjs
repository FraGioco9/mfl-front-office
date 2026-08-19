import { readFile, writeFile } from "node:fs/promises";

const validationPath = new URL("./validate.mjs", import.meta.url);
let source = await readFile(validationPath, "utf8");

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Validation migration pattern missing: ${label}`);
  source = source.replace(before, after);
}

replaceRequired(
  'includes(tableWidth, "canonical: true", "Table widths must remain globally single-owned.");',
  [
    'includes(tableWidth, "window.__mflUniformWidth = Object.freeze", "Table widths must expose one immutable ownership marker.");',
    'includes(tableWidth, \'source: "styles.css"\', "Static CSS must remain the canonical table-width geometry owner.");',
  ].join("\n"),
  "Uniform Width ownership",
);

replaceRequired(
  'includes(evaluationSearchState, "recentEvaluationRows.__mflSupabaseOnly", "Evaluation recents must stay Supabase-backed.");',
  [
    'includes(evaluationSearchState, "persistEvaluationRecentPlayerIds", "Evaluation recents must persist through the canonical Supabase-backed core contract.");',
    'includes(evaluationSearchState, "purgeLegacyLocalRecentState", "Evaluation recents must purge legacy local recent-ID persistence.");',
  ].join("\n"),
  "Evaluation recent persistence ownership",
);

replaceRequired(
  'includes(globalSearch, "__mflSurnameFirst", "Player search must preserve surname-first matching.");',
  [
    'includes(globalSearch, "coreContracts()?.installSearchMatching", "Global Search must install canonical matching through the application-core contract.");',
    'includes(globalSearch, "coreContracts()?.applySearchPayload", "Global Search must apply authoritative payloads through the application-core contract.");',
  ].join("\n"),
  "Global Search matching ownership",
);

replaceRequired(
  'invariant(localJsRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Local JavaScript must use the no-store cache policy.");',
  'invariant(localJsRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=0, must-revalidate"), "Local JavaScript must use the cacheable revalidation policy.");',
  "local JavaScript cache policy",
);

replaceRequired(
  'invariant(productionJsNoStoreRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"), "Production unversioned JavaScript must retain the no-store cache policy.");',
  'invariant(productionJsNoStoreRule?.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=0, must-revalidate"), "Production unversioned JavaScript must use mandatory revalidation.");',
  "production JavaScript cache policy",
);

await writeFile(validationPath, source, "utf8");

const appConfigValidationPath = new URL("./validate-app-config.mjs", import.meta.url);
let appConfigValidation = await readFile(appConfigValidationPath, "utf8");
const oldSame = `function same(actual, expected, label) {
  invariant(
    JSON.stringify(plain(actual)) === JSON.stringify(plain(expected)),
    \`${"${label}"} must match modules/app-config.js.\`,
  );
}`;
const newSame = `function canonical(value) {
  const normalized = plain(value);
  if (Array.isArray(normalized)) return normalized.map(canonical);
  if (normalized && typeof normalized === "object") {
    return Object.fromEntries(
      Object.entries(normalized)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return normalized;
}

function same(actual, expected, label) {
  invariant(
    JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)),
    \`${"${label}"} must match modules/app-config.js.\`,
  );
}`;
if (!appConfigValidation.includes(oldSame)) throw new Error("Order-sensitive app-config comparison helper was not found.");
appConfigValidation = appConfigValidation.replace(oldSame, newSame);
await writeFile(appConfigValidationPath, appConfigValidation, "utf8");
