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
  TABLE_VIEW_COLUMNS,
  VIEW_BY_SLUG,
} from "./modules/app-config.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

function initializer(source, name) {
  const normalizedSource = String(source || "").replace(/\r\n?/g, "\n");
  const marker = `const ${name} = `;
  const start = normalizedSource.indexOf(marker);
  invariant(start >= 0, `Could not find ${name}.`);
  const valueStart = start + marker.length;
  const end = normalizedSource.indexOf(";\n", valueStart);
  invariant(end >= 0, `Could not find the end of ${name}.`);
  return normalizedSource.slice(valueStart, end);
}

function evaluateInitializer(source, name, context = {}) {
  return vm.runInNewContext(initializer(source, name), { Object, Set, String, ...context });
}

function plain(value) {
  if (Object.prototype.toString.call(value) === "[object Set]") {
    return Array.from(value, plain);
  }
  if (Array.isArray(value)) return Array.from(value, plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, plain(entry)]),
    );
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
const runtimeSandbox = {
  window: {},
  location: { pathname: "/", origin: "https://example.test" },
  Object,
  Set,
  encodeURIComponent,
};
vm.runInNewContext(tableWidthSource, runtimeSandbox);
const runtimeConfig = runtimeSandbox.window.__mflAppConfig;
invariant(runtimeConfig, "Pre-bootstrap runtime must expose the canonical app configuration.");
same(runtimeConfig.release, release, "pre-bootstrap release config");
same(runtimeConfig.routes.tableViews, TABLE_VIEW_CONFIG, "pre-bootstrap route views");
same(runtimeConfig.routes.viewBySlug, VIEW_BY_SLUG, "pre-bootstrap view slug map");
same(runtimeConfig.table.baseColumns, TABLE_BASE_COLUMNS, "pre-bootstrap base columns");
same(runtimeConfig.table.statColumns, TABLE_STAT_COLUMNS, "pre-bootstrap stat columns");
same(runtimeConfig.table.contractColumns, TABLE_CONTRACT_COLUMNS, "pre-bootstrap contract columns");
same(runtimeConfig.table.viewColumns, TABLE_VIEW_COLUMNS, "pre-bootstrap table view columns");
same(runtimeConfig.table.joinedAgencyPages, TABLE_JOINED_AGENCY_PAGES, "pre-bootstrap joined-agency pages");
same(runtimeConfig.table.sortableColumns, TABLE_SORTABLE_COLUMNS, "pre-bootstrap sortable columns");
same(runtimeConfig.table.columnLabels, TABLE_COLUMN_LABELS, "pre-bootstrap column labels");
same(runtimeConfig.table.columnClasses, TABLE_COLUMN_CLASSES, "pre-bootstrap column classes");
same(runtimeSandbox.window.__mflRelease, release, "pre-bootstrap release facade");
invariant(runtimeSandbox.window.__mflReleaseVersion === release.version, "Pre-bootstrap release version facade must come from release.json.");
invariant(runtimeSandbox.window.__mflTableViewConfig === runtimeConfig.routes.tableViews, "Legacy table-view facade must point to canonical config.");
invariant(runtimeSandbox.window.__mflUniformWidth?.name === "Uniform Width", "Uniform Width marker must remain available before bootstrap.");

same(evaluateInitializer(indexSource, "TABLE_VIEW_CONFIG"), TABLE_VIEW_CONFIG, "index first-paint view config");
same(evaluateInitializer(indexSource, "VIEW_BY_SLUG"), VIEW_BY_SLUG, "index first-paint view slug map");

const bootstrapWindow = {
  __mflAppConfig: { release },
  __mflReleaseVersion: "stale-fallback",
};
const bootstrapRelease = evaluateInitializer(bootstrapSource, "STATIC_RELEASE_VERSION", { window: bootstrapWindow });
invariant(
  String(bootstrapRelease) === String(release.version),
  "bootstrap first-paint release projection must resolve from the canonical app configuration.",
);
const bootstrapViewBySlug = plain(evaluateInitializer(bootstrapSource, "TABLE_VIEW_BY_SLUG"));
same(bootstrapViewBySlug, VIEW_BY_SLUG, "bootstrap first-paint view slug projection");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_BASE_COLUMNS"), TABLE_BASE_COLUMNS, "bootstrap base columns");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_STAT_COLUMNS"), TABLE_STAT_COLUMNS, "bootstrap stat columns");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_CONTRACT_COLUMNS"), TABLE_CONTRACT_COLUMNS, "bootstrap contract columns");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_AGENT_PAGES"), TABLE_JOINED_AGENCY_PAGES, "bootstrap joined-agency pages");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_COLUMN_CLASSES"), TABLE_COLUMN_CLASSES, "bootstrap column classes");
same(evaluateInitializer(bootstrapSource, "FIRST_PAINT_COLUMN_LABELS"), TABLE_COLUMN_LABELS, "bootstrap column labels");

same(evaluateInitializer(staticUiSource, "VIEW_BY_SLUG"), VIEW_BY_SLUG, "static UI view slug projection");
invariant(
  staticUiSource.includes("const configured = window.__mflTableViewConfig;"),
  "Static UI must consume the canonical table-view configuration facade.",
);
[
  "STATIC_TABLE_BASE_COLUMNS",
  "STATIC_TABLE_STAT_COLUMNS",
  "STATIC_TABLE_CONTRACT_COLUMNS",
  "STATIC_JOINED_AGENCY_PAGES",
  "STATIC_TABLE_SORTABLE_COLUMNS",
  "STATIC_TABLE_COLUMN_LABELS",
  "STATIC_TABLE_COLUMN_CLASSES",
].forEach((retiredOwner) => {
  invariant(!staticUiSource.includes(retiredOwner), `Static UI must not restore duplicate config owner: ${retiredOwner}.`);
});

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

console.log("Canonical app configuration and release facade validation passed.");
