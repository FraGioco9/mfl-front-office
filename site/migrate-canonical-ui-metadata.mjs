import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("./", import.meta.url));

function replaceLiteralExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replacePatternExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${label} expected exactly one match, found ${matches.length}.`);
  return source.replace(pattern, replacement);
}

async function migrate(relativePath, transform) {
  const path = resolve(siteRoot, relativePath);
  const current = await readFile(path, "utf8");
  const next = transform(current);
  if (next === current) {
    console.log(`Unchanged ${relativePath}`);
    return;
  }
  await writeFile(path, next, "utf8");
  console.log(`Migrated ${relativePath}`);
}

const uiDefinitions = `export const MFL_STATS_OVERALL_FILTERS = Object.freeze([
  Object.freeze({ id: "all", label: "All", min: null, max: null }),
  Object.freeze({ id: "90-94", label: "90-94", min: 90, max: 94 }),
  Object.freeze({ id: "legendary", label: "Legendary", min: 85, max: 94 }),
  Object.freeze({ id: "85-89", label: "85-89", min: 85, max: 89 }),
  Object.freeze({ id: "80-84", label: "80-84", min: 80, max: 84 }),
  Object.freeze({ id: "rare", label: "Rare", min: 75, max: 84 }),
  Object.freeze({ id: "75-79", label: "75-79", min: 75, max: 79 }),
  Object.freeze({ id: "70-74", label: "70-74", min: 70, max: 74 }),
  Object.freeze({ id: "uncommon", label: "Uncommon", min: 65, max: 74 }),
  Object.freeze({ id: "65-69", label: "65-69", min: 65, max: 69 }),
  Object.freeze({ id: "60-64", label: "60-64", min: 60, max: 64 }),
  Object.freeze({ id: "limited", label: "Limited", min: 55, max: 64 }),
  Object.freeze({ id: "55-59", label: "55-59", min: 55, max: 59 }),
  Object.freeze({ id: "50-54", label: "50-54", min: 50, max: 54 }),
  Object.freeze({ id: "common", label: "Common", min: null, max: 54 }),
]);

export const SETTINGS_DATE_FORMAT_OPTIONS = Object.freeze([
  Object.freeze({ value: "DMY", label: "DD/MM/YYYY" }),
  Object.freeze({ value: "MDY", label: "MM/DD/YYYY" }),
]);

export const SETTINGS_TIME_FORMAT_OPTIONS = Object.freeze([
  Object.freeze({ value: "24h", label: "24h" }),
  Object.freeze({ value: "12h", label: "12h" }),
]);`;

await migrate("modules/app-config.js", (source) => {
  if (source.includes("export const MFL_STATS_OVERALL_FILTERS")) return source;

  let next = replaceLiteralExactlyOnce(
    source,
    'export const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";',
    `export const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";\n\n${uiDefinitions}`,
    "app-config UI metadata insertion point",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `    columnClasses: TABLE_COLUMN_CLASSES,\n  }),\n});`,
    `    columnClasses: TABLE_COLUMN_CLASSES,\n  }),\n  ui: Object.freeze({\n    mflStatsOverallFilters: MFL_STATS_OVERALL_FILTERS,\n    settingsDateFormats: SETTINGS_DATE_FORMAT_OPTIONS,\n    settingsTimeFormats: SETTINGS_TIME_FORMAT_OPTIONS,\n  }),\n});`,
    "app-config browser UI data",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `    table: BROWSER_DATA.table,\n  });`,
    `    table: BROWSER_DATA.table,\n    ui: BROWSER_DATA.ui,\n  });`,
    "app-config browser runtime UI projection",
  );
  next = replaceLiteralExactlyOnce(
    next,
    "  const appConfig = Object.freeze({ release: data.release, routes, table });",
    "  const appConfig = Object.freeze({ release: data.release, routes, table, ui: data.ui });",
    "app-config runtime facade",
  );
  return next;
});

await migrate("bootstrap.js", (source) => {
  if (source.includes("APP_CONFIG.ui.mflStatsOverallFilters")) return source;

  let next = replaceLiteralExactlyOnce(
    source,
    `  if (!APP_CONFIG?.routes || !APP_CONFIG?.table) {`,
    `  if (!APP_CONFIG?.routes || !APP_CONFIG?.table || !APP_CONFIG?.ui) {`,
    "Bootstrap canonical config guard",
  );
  next = replacePatternExactlyOnce(
    next,
    /^  const MFL_STATS_FILTER_LABELS = Object\.freeze\(\[[\s\S]*?^  const SETTINGS_TIME_FORMAT_LABELS = Object\.freeze\(\[[\s\S]*?^  \]\);$/gm,
    `  const MFL_STATS_FILTER_LABELS = Object.freeze(\n    APP_CONFIG.ui.mflStatsOverallFilters.map(({ id, label }) => Object.freeze([id, label])),\n  );\n  const SETTINGS_DATE_FORMAT_LABELS = Object.freeze(\n    APP_CONFIG.ui.settingsDateFormats.map(({ value, label }) => Object.freeze([value, label])),\n  );\n  const SETTINGS_TIME_FORMAT_LABELS = Object.freeze(\n    APP_CONFIG.ui.settingsTimeFormats.map(({ value, label }) => Object.freeze([value, label])),\n  );`,
    "Bootstrap duplicated UI metadata",
  );
  return next;
});

await migrate("modules/app-core.js", (source) => {
  if (source.includes("const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];")) return source;

  let next = replacePatternExactlyOnce(
    source,
    /const mflStatsOverallFilterOptions = \[[\s\S]*?\n\];\n\nfunction mflStatsFilterById/,
    `const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];\n\nfunction mflStatsFilterById`,
    "MFL Stats runtime filter metadata",
  );
  next = replacePatternExactlyOnce(
    next,
    /    \[\n      \["DMY", "DD\/MM\/YYYY"\],\n      \["MDY", "MM\/DD\/YYYY"\],\n    \]\.forEach\(\(\[value, label\]\) => \{/,
    `    (window.__mflAppConfig?.ui?.settingsDateFormats || []).forEach(({ value, label }) => {`,
    "Settings date-format metadata",
  );
  next = replacePatternExactlyOnce(
    next,
    /    \[\n      \["24h", "24h"\],\n      \["12h", "12h"\],\n    \]\.forEach\(\(\[value, label\]\) => \{/,
    `    (window.__mflAppConfig?.ui?.settingsTimeFormats || []).forEach(({ value, label }) => {`,
    "Settings time-format metadata",
  );
  return next;
});

await migrate("validate-app-config.mjs", (source) => {
  if (source.includes("pre-bootstrap MFL Stats filter config")) return source;

  let next = replaceLiteralExactlyOnce(
    source,
    `import {\n  TABLE_BASE_COLUMNS,`,
    `import {\n  MFL_STATS_OVERALL_FILTERS,\n  SETTINGS_DATE_FORMAT_OPTIONS,\n  SETTINGS_TIME_FORMAT_OPTIONS,\n  TABLE_BASE_COLUMNS,`,
    "validate-app-config canonical imports",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `  firstPaintRouteConfigProjectionSource,\n  normalizeIndexFirstPaintConfigProjection,`,
    `  firstPaintRouteConfigProjectionSource,\n  mflStatsFilterButtonsProjectionSource,\n  normalizeIndexFirstPaintConfigProjection,\n  normalizeIndexMflStatsFiltersProjection,`,
    "validate-app-config projection imports",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `  tableWidthSource,\n] = await Promise.all([`,
    `  tableWidthSource,\n  appCoreSource,\n] = await Promise.all([`,
    "validate-app-config source list",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `  read("./table-width-runtime.js"),\n]);`,
    `  read("./table-width-runtime.js"),\n  read("./modules/app-core.js"),\n]);`,
    "validate-app-config source reads",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `same(runtimeConfig.table.columnClasses, TABLE_COLUMN_CLASSES, "pre-bootstrap column classes");`,
    `same(runtimeConfig.table.columnClasses, TABLE_COLUMN_CLASSES, "pre-bootstrap column classes");\nsame(runtimeConfig.ui.mflStatsOverallFilters, MFL_STATS_OVERALL_FILTERS, "pre-bootstrap MFL Stats filter config");\nsame(runtimeConfig.ui.settingsDateFormats, SETTINGS_DATE_FORMAT_OPTIONS, "pre-bootstrap Settings date-format config");\nsame(runtimeConfig.ui.settingsTimeFormats, SETTINGS_TIME_FORMAT_OPTIONS, "pre-bootstrap Settings time-format config");`,
    "validate-app-config UI comparisons",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `invariant(\n  normalizeIndexFirstPaintConfigProjection(indexSource) === indexSource,\n  "index first-paint route/view config projection must already be synchronized.",\n);`,
    `invariant(\n  normalizeIndexFirstPaintConfigProjection(indexSource) === indexSource,\n  "index first-paint route/view config projection must already be synchronized.",\n);\nconst generatedMflStatsFilters = mflStatsFilterButtonsProjectionSource();\ninvariant(\n  indexSource.includes(generatedMflStatsFilters),\n  "index MFL Stats filters must be the generated projection of modules/app-config.js.",\n);\ninvariant(\n  normalizeIndexMflStatsFiltersProjection(indexSource) === indexSource,\n  "index MFL Stats filter projection must already be synchronized.",\n);`,
    "validate-app-config static filter projection checks",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `  "const FIRST_PAINT_COLUMN_LABELS = APP_CONFIG.table.columnLabels;",\n  "return APP_CONFIG.routes.tableViews;",`,
    `  "const FIRST_PAINT_COLUMN_LABELS = APP_CONFIG.table.columnLabels;",\n  "APP_CONFIG.ui.mflStatsOverallFilters.map(({ id, label }) => Object.freeze([id, label]))",\n  "APP_CONFIG.ui.settingsDateFormats.map(({ value, label }) => Object.freeze([value, label]))",\n  "APP_CONFIG.ui.settingsTimeFormats.map(({ value, label }) => Object.freeze([value, label]))",\n  "return APP_CONFIG.routes.tableViews;",`,
    "validate-app-config Bootstrap UI aliases",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `  'Reflect.get(window, "__mflTableViewConfig")',\n]) {`,
    `  'Reflect.get(window, "__mflTableViewConfig")',\n  "const MFL_STATS_FILTER_LABELS = Object.freeze([",\n  "const SETTINGS_DATE_FORMAT_LABELS = Object.freeze([",\n  "const SETTINGS_TIME_FORMAT_LABELS = Object.freeze([",\n]) {`,
    "validate-app-config retired Bootstrap UI owners",
  );
  next = replaceLiteralExactlyOnce(
    next,
    `same(evaluateInitializer(staticUiSource, "VIEW_BY_SLUG"), VIEW_BY_SLUG, "static UI view slug projection");`,
    `invariant(\n  appCoreSource.includes("const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];"),\n  "MFL Stats runtime source must consume canonical filter metadata.",\n);\ninvariant(\n  appCoreSource.includes("(window.__mflAppConfig?.ui?.settingsDateFormats || []).forEach(({ value, label }) => {")\n    && appCoreSource.includes("(window.__mflAppConfig?.ui?.settingsTimeFormats || []).forEach(({ value, label }) => {"),\n  "Settings runtime source must consume canonical format metadata.",\n);\nfor (const retiredRuntimeOwner of [\n  "const mflStatsOverallFilterOptions = [",\n  '["DMY", "DD/MM/YYYY"]',\n  '["24h", "24h"]',\n]) {\n  invariant(!appCoreSource.includes(retiredRuntimeOwner), \`Application core must not restore duplicate UI metadata owner: \${retiredRuntimeOwner}\`);\n}\n\nsame(evaluateInitializer(staticUiSource, "VIEW_BY_SLUG"), VIEW_BY_SLUG, "static UI view slug projection");`,
    "validate-app-config runtime UI ownership checks",
  );
  next = next.replace(
    "Canonical app configuration and generated first-paint/release facade validation passed.",
    "Canonical app configuration and generated first-paint/UI/release facade validation passed.",
  );
  return next;
});

await migrate("validate-mfl-stats-first-paint.mjs", (source) => {
  if (source.includes("MFL_STATS_OVERALL_FILTERS.map")) return source;

  let next = replaceLiteralExactlyOnce(
    source,
    `import { readFile } from "node:fs/promises";`,
    `import { readFile } from "node:fs/promises";\n\nimport { MFL_STATS_OVERALL_FILTERS } from "./modules/app-config.js";`,
    "MFL Stats validator canonical import",
  );
  next = replacePatternExactlyOnce(
    next,
    /const expectedFilters = \[[\s\S]*?\n\];\nlet previousIndex/,
    `const expectedFilters = MFL_STATS_OVERALL_FILTERS.map(({ id, label }) => [id, label]);\nlet previousIndex`,
    "MFL Stats validator duplicated filter list",
  );
  return next;
});

await migrate("validate-route-runtime.mjs", (source) => {
  if (source.includes('includes(mflStatsCore, "const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];"')) return source;
  return replaceLiteralExactlyOnce(
    source,
    `includes(mflStatsCore, "const mflStatsOverallFilterOptions = [", "The MFL Stats chunk must own its filter definitions.");`,
    `includes(mflStatsCore, "const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];", "The MFL Stats chunk must consume canonical filter definitions.");`,
    "route-runtime MFL Stats ownership assertion",
  );
});
