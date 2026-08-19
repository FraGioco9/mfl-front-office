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

await writeFile(validationPath, source, "utf8");
