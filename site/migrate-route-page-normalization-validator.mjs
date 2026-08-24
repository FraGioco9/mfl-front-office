// Temporary one-shot route-page validator ownership migration; removed before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-route-page-normalization.mjs");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const start = source.indexOf('const entryNormalizeStart = entry.indexOf("function normalizeRoutePageName(pageName) {");');
const end = source.indexOf('const entryClubPathStart = entry.indexOf("function clubRoutePath(clubId, view) {");', start);
if (start < 0 || end <= start) throw new Error("Missing app-entry route facade validation block.");
const replacement = `const entryNormalizeStart = entry.indexOf("function normalizeRoutePageName(pageName) {");
const entryNormalizeEnd = entry.indexOf("function routeDependencyPlan(pageName, options = {})", entryNormalizeStart);
invariant(entryNormalizeStart >= 0 && entryNormalizeEnd > entryNormalizeStart, "app-entry must retain a stable route page-name facade.");
const entryNormalizeSection = entry.slice(entryNormalizeStart, entryNormalizeEnd);
includes(entryNormalizeSection, "return String(routeConfig().normalizePageName(pageName) || \\\"home\\\");", "app-entry must delegate page-name normalization to canonical route config.");

const entryPlanStart = entry.indexOf("function routeDependencyPlan(pageName, options = {})");
const entryPlanEnd = entry.indexOf("function uniqueScripts(paths) {", entryPlanStart);
invariant(entryPlanStart >= 0 && entryPlanEnd > entryPlanStart, "app-entry must retain a stable route dependency facade.");
const entryPlanSection = entry.slice(entryPlanStart, entryPlanEnd);
includes(entryPlanSection, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry must delegate route view/dependency classification to canonical route config.");

const entryInitialStart = entry.indexOf("function initialRouteRuntimeRequest() {");
const entryInitialEnd = entry.indexOf("const initialRouteRuntime =", entryInitialStart);
invariant(entryInitialStart >= 0 && entryInitialEnd > entryInitialStart, "app-entry must retain a stable initial-route facade.");
const entryInitialSection = entry.slice(entryInitialStart, entryInitialEnd);
includes(entryInitialSection, "const request = routeConfig().initialRequest(initialPathname);", "app-entry must delegate initial-route classification to canonical route config.");

`;
source = source.slice(0, start) + replacement + source.slice(end);
await writeFile(path, source, "utf8");
console.log("Updated app-entry route-page normalization ownership validation.");
