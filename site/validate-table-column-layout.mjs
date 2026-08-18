import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, tableWidthRuntime, bootstrapCore] = await Promise.all([
  read("./styles.css"),
  read("./table-width-runtime.js"),
  read("./bootstrap-core.js"),
]);

function percentageVariable(name) {
  const match = styles.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([0-9.]+)%`));
  invariant(match, `Missing global table percentage ${name}.`);
  return Number(match[1]);
}

const shared = [
  "--mfl-table-col-select",
  "--mfl-table-col-id",
  "--mfl-table-col-flag",
  "--mfl-table-col-name",
  "--mfl-table-col-nationality",
  "--mfl-table-col-age",
  "--mfl-table-col-positions",
  "--mfl-table-col-seasons",
  "--mfl-table-col-overall",
  "--mfl-table-col-agent",
  "--mfl-table-col-link",
].reduce((sum, name) => sum + percentageVariable(name), 0);
const stats = percentageVariable("--mfl-table-col-stat") * 6;
const contracts = [
  "--mfl-table-col-contract-revenue",
  "--mfl-table-col-contract-club",
  "--mfl-table-col-contract-division",
].reduce((sum, name) => sum + percentageVariable(name), 0);

invariant(Math.abs(shared + stats - 100) < 0.0001, "Shared + Stats table columns must total 100%.");
invariant(Math.abs(shared + contracts - 100) < 0.0001, "Shared + Contracts table columns must total 100%.");
invariant(
  Math.abs(percentageVariable("--mfl-table-col-joined-agency") - percentageVariable("--mfl-table-col-agent")) < 0.0001
  && Math.abs(percentageVariable("--mfl-table-col-owned-since") - percentageVariable("--mfl-table-col-agent")) < 0.0001,
  "Agent identity columns must share one percentage.",
);

const evaluationSummary = [
  "--mfl-evaluation-summary-col-name",
  "--mfl-evaluation-summary-col-position",
  "--mfl-evaluation-summary-col-age",
  "--mfl-evaluation-summary-col-overall",
  "--mfl-evaluation-summary-col-seasons",
  "--mfl-evaluation-summary-col-return",
  "--mfl-evaluation-summary-col-value",
].reduce((sum, name) => sum + percentageVariable(name), 0);
const evaluationSeason = [
  "--mfl-evaluation-season-col-name",
  "--mfl-evaluation-season-col-season",
  "--mfl-evaluation-season-col-age",
  "--mfl-evaluation-season-col-overall",
  "--mfl-evaluation-season-col-mfl",
  "--mfl-evaluation-season-col-usd",
  "--mfl-evaluation-season-col-discount",
  "--mfl-evaluation-season-col-value",
].reduce((sum, name) => sum + percentageVariable(name), 0);
const advancedPlayer = percentageVariable("--mfl-advanced-player-col-label")
  + (16 * percentageVariable("--mfl-advanced-player-col-value"));

invariant(Math.abs(evaluationSummary - 100) < 0.0001, "Evaluation Summary columns must total 100%.");
invariant(Math.abs(evaluationSeason - 100) < 0.0001, "Evaluation season columns must total 100%.");
invariant(Math.abs(advancedPlayer - 100) < 0.0001, "Advanced player table columns must total 100%.");

invariant(
  tableWidthRuntime.includes('source: "styles.css"'),
  "Table width runtime must identify styles.css as the percentage source of truth.",
);
invariant(
  tableWidthRuntime.includes('["col-name", "--mfl-table-col-name"]'),
  "Table width runtime must resolve semantic columns from CSS variables rather than duplicate numeric widths.",
);
invariant(
  !tableWidthRuntime.includes('["col-name", 15]'),
  "Table width runtime must not duplicate canonical percentage values.",
);

const widthLoadIndex = bootstrapCore.indexOf("await ensureFirstPaintTableWidths();");
const appImportIndex = bootstrapCore.indexOf('await import(new URL("/modules/app-entry.js"');
invariant(
  widthLoadIndex >= 0 && appImportIndex > widthLoadIndex,
  "The global table width contract must load before the application core can render a table.",
);

console.log("Global table percentage and first-paint ownership validation passed.");
