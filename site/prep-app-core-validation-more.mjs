import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./validate-database-stats-lazy-runtime.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const importMarker = 'import { readFile } from "node:fs/promises";\n';
const canonicalImport = `${importMarker}import vm from "node:vm";\n\nimport { browserConfigRuntimeSource } from "./modules/app-config.js";\n`;
if (!source.includes(importMarker)) throw new Error("Database Stats validator import marker was not found.");
source = source.replace(importMarker, canonicalImport);

const legacyRouteChecks = [
  "includes(",
  "  routeCoreLoader,",
  '  \'if (pageSegment === "database") return { pageName: "database", options: viewOptionsFromSegments(segments) };\',',
  '  "The central startup classifier must preserve Database view slugs through the generic view parser.",',
  ");",
  'includes(routeCoreLoader, \'stats: "stats"\', "The central startup view parser must preserve the Database Stats slug.");',
].join("\n");
const canonicalRouteChecks = [
  'includes(routeCoreLoader, "const routeConfig = runtimeWindow.__mflAppConfig?.routes;", "Route-core loading must consume canonical route configuration.");',
  'const configWindow = {};',
  'vm.runInNewContext(browserConfigRuntimeSource({ version: "1.0.0", description: "validation" }), { window: configWindow, location: { pathname: "/database/stats" } });',
  'const databaseStatsRoute = configWindow.__mflAppConfig.routes.initialRequest("/database/stats");',
  'invariant(databaseStatsRoute.pageName === "database", "Canonical startup routing must classify /database/stats as Database.");',
  'invariant(databaseStatsRoute.options?.view === "stats", "Canonical startup routing must preserve the Database Stats view slug.");',
].join("\n");
if (!source.includes(legacyRouteChecks)) throw new Error("Legacy Database Stats route-parser checks were not found.");
source = source.replace(legacyRouteChecks, canonicalRouteChecks);

await writeFile(path, source, "utf8");
