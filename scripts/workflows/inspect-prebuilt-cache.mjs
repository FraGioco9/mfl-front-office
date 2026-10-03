// Inspect read-only Vercel Build Output API v3 routes, without deploying.
// This reports *declared* cache headers, not an effective CDN response:
// framework/static/function rules can take precedence at request time.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = Object.freeze([
  { label: "home-shell", url: "/" },
  { label: "static-shell", url: "/index.html" },
  { label: "deep-link", url: "/database/attributes" },
  { label: "release", url: "/release.json" },
  { label: "stable-css", url: "/styles-runtime.css" },
  { label: "unversioned-js", url: "/modules/app-core-runtime.js" },
  { label: "query-revision-js", url: "/modules/app-core-runtime.js?mfl_core=test" },
  { label: "private-api", url: "/api/operational-health" },
  { label: "identity-api", url: "/api/identity" },
]);

function matchesCondition(condition, url, intent) {
  if (!Array.isArray(condition)) return true;
  for (const entry of condition) {
    // A header/method/cookie condition cannot be determined from a URL alone.
    if (entry?.type !== "query") return false;
    const found = url.searchParams.has(entry.key);
    const matched = found && (entry.value === undefined || entry.value === url.searchParams.get(entry.key));
    if (intent === "has" && !matched) return false;
    if (intent === "missing" && matched) return false;
  }
  return true;
}
function matchingRule(route, url) {
  if (!route || typeof route.src !== "string" || !route.headers) return false;
  if (route.methods) return false;
  if (!matchesCondition(route.has, url, "has") || !matchesCondition(route.missing, url, "missing")) return false;
  let regexp;
  try { regexp = new RegExp(route.src); } catch { return false; }
  return regexp.test(url.pathname);
}
function cacheHeader(route) {
  return Object.entries(route.headers || {}).find(([key]) => key.toLowerCase() === "cache-control")?.[1] || null;
}
export function inspectPrebuiltCache(config) {
  assert.equal(config?.version, 3, "Expected a Vercel Build Output API v3 config.");
  assert.ok(Array.isArray(config.routes), "Missing Vercel prebuilt routes array.");
  const inspected = fixtures.map(({ label, url: source }) => {
    const url = new URL(source, "https://offline.invalid");
    const routes = config.routes.flatMap((route, index) => matchingRule(route, url)
      ? [{ index, source: route.src, continued: route.continue === true, cacheControl: cacheHeader(route) }]
      : []);
    return { label, url: source, matchedHeaderRules: routes };
  });
  const unsafe = [];
  for (const item of inspected) {
    for (const match of item.matchedHeaderRules) {
      const cache = String(match.cacheControl || "");
      if (/\bimmutable\b/i.test(cache) && item.label !== "query-revision-js") {
        unsafe.push(item.label + " matches unconditional immutable route #" + match.index);
      }
      if (item.label === "stable-css" && /\bmax-age\s*=\s*(?!0(?:\s|,|$))\d+/i.test(cache)) {
        unsafe.push("Stable CSS must not have a positive max-age: #" + match.index);
      }
      if (["private-api", "identity-api"].includes(item.label) &&
          /\bpublic\b.*\bmax-age\s*=\s*(?:[1-9]\d*)/i.test(cache)) {
        unsafe.push("Dynamic API received long-lived public cache: " + item.label + " #" + match.index);
      }
    }
  }
  assert.deepEqual(unsafe, [], "Unsafe explicit cache declarations: " + unsafe.join("; "));
  return {
    schemaVersion: config.version,
    routeCount: config.routes.length,
    inspections: inspected,
    queryRevisionCaveat: "A JS ?mfl_core value is not a content-addressed path; may need separately proven byte retention.",
    limit: "Route header candidates only: does not prove effective static asset or CDN/Function response headers.",
  };
}
const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const path = resolve(process.argv[2] || ".vercel/output/config.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  const result = inspectPrebuiltCache(config);
  process.stdout.write(JSON.stringify({ configPath: path, ...result }, null, 2) + "\n");
}
