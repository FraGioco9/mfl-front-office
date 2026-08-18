import { readFile } from "node:fs/promises";
import vm from "node:vm";

import {
  TABLE_BASE_COLUMNS,
  TABLE_COLUMN_CLASSES,
  TABLE_COLUMN_LABELS,
  TABLE_CONTRACT_COLUMNS,
  TABLE_JOINED_AGENCY_PAGES,
  TABLE_SORTABLE_COLUMNS,
  TABLE_STAT_COLUMNS,
  TABLE_VIEW_CONFIG,
  VIEW_BY_SLUG,
  browserConfigRuntimeSource,
} from "./modules/app-config.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

function initializer(source, name) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  invariant(start >= 0, `Could not find ${name}.`);
  const valueStart = start + marker.length;
  const end = source.indexOf(";\n", valueStart);
  invariant(end >= 0, `Could not find the end of ${name}.`);
  return source.slice(valueStart, end);
}

function evaluateInitializer(source, name) {
  return vm.runInNewContext(initializer(source, name), { Object, Set });
}

function plain(value) {
  if (Object.prototype.toString.call(value) === "[object Set]") {
    return Array.from(value, plain);
  }
  if (Array.isArray(value)) return Array.from(value, plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
  }
  return value;
}

function same(actual, expected, label) {
  invariant(
    JSON.stringify(plain(actual)) === JSON.stringify(plain(expected)),
    `${label} must match modules/app-config.js.`,
  );
}

const [
  releaseSource,
  indexSource,
  bootstrapSource,
  staticUiSource,
  routeCoreSource,
  tableWidthSource,
] = await Promise.all([
  read("./release.json"),
  read("./index.html"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./route-core-loader-runtime.js"),
  read("./table-width-runtime.js"),
]);

const release = JSON.parse(releaseSource);
const expectedPreBootstrapRuntime = `${browserConfigRuntimeSource(release).replace(/\s*$/, "")}\nwindow.__mflUniformWidth = Object.freeze({\n  name: "Uniform Width",\n  source: "styles.css",\n  unit: "%",\n});\n`;
invariant(
  tableWidthSource === expectedPreBootstrapRuntime,
  "table-width-runtime.js must be generated only from release.json and modules/app-config.js.",
);

same(evaluateInitializer(indexSource, "TABLE_VIEW_CONFIG"), TABLE_VIEW_CONFIG, "index first-paint view config");
same(evaluateInitializer(indexSource, "VIEW_BY_SLUG"), VIEW_BY_SLUG, "index first-paint view slug map");

const bootstrapRelease = evaluateInitializer(bootstrapSource, "STATIC_RELEASE_VERSION");
invariant(
  String(bootstrapRelease) === String(release.version),
  "bootstrap first-paint release projection must match release.json.",
);
const bootstrapViewBySlug = plain(evaluateInitializer(bootstrapSource, "TABLE_VIEW_BY_SLUG"));
const canonicalBootstrapViewBySlug = { ...VIEW_BY_SLUG };
delete canonicalBootstrapViewBySlug.squad;
same(bootstrapViewBySlug, canonicalBootstrapViewBySlug, "bootstrap first-paint view slug projection");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_BASE_COLUMNS"), TABLE_BASE_COLUMNS, "bootstrap base columns");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_STAT_COLUMNS"), TABLE_STAT_COLUMNS, "bootstrap stat columns");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_CONTRACT_COLUMNS"), TABLE_CONTRACT_COLUMNS, "bootstrap contract columns");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_AGENT_PAGES"), TABLE_JOINED_AGENCY_PAGES, "bootstrap joined-agency pages");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_COLUMN_CLASSES"), TABLE_COLUMN_CLASSES, "bootstrap column classes");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_COLUMN_LABELS"), TABLE_COLUMN_LABELS, "bootstrap column labels");

same(evaluateInitializer(staticUiSource, "VIEW_BY_SLUG"), VIEW_BY_SLUG, "static UI view slug projection");
same(evaluateInitializer(staticUiSource, "STATIC_TABLE_BASE_COLUMNS"), TABLE_BASE_COLUMNS, "static UI base columns");
same(evaluateInitializer(staticUiSource, "STATIC_TABLE_STAT_COLUMNS"), TABLE_STAT_COLUMNS, "static UI stat columns");
same(evaluateInitializer(staticUiSource, "STATIC_TABLE_CONTRACT_COLUMNS"), TABLE_CONTRACT_COLUMNS, "static UI contract columns");
same(evaluateInitializer(staticUiSource, "STATIC_JOINED_AGENCY_PAGES"), TABLE_JOINED_AGENCY_PAGES, "static UI joined-agency pages");
same(evaluateInitializer(staticUiSource, "STATIC_TABLE_SORTABLE_COLUMNS"), TABLE_SORTABLE_COLUMNS, "static UI sortable columns");
same(evaluateInitializer(staticUiSource, "STATIC_TABLE_COLUMN_LABELS"), TABLE_COLUMN_LABELS, "static UI column labels");
same(evaluateInitializer(staticUiSource, "STATIC_TABLE_COLUMN_CLASSES"), TABLE_COLUMN_CLASSES, "static UI column classes");

invariant(
  routeCoreSource.includes("const routeConfig = runtimeWindow.__mflAppConfig?.routes;"),
  "Route core must consume the canonical route configuration.",
);
[
  "const ROUTE_CORE_PATHS = Object.freeze(",
  "const TABLE_INFRASTRUCTURE_PAGES = new Set(",
  "const VIEW_BY_SLUG = Object.freeze(",
].forEach((legacyOwner) => {
  invariant(!routeCoreSource.includes(legacyOwner), `Route core must not retain duplicate config owner: ${legacyOwner}`);
});

console.log("Canonical app configuration validation passed.");
