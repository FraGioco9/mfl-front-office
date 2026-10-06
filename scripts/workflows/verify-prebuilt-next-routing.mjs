import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

export function verifyPrebuiltNextRouting({ vercelConfig, builds, functionDirs }) {
  assert.equal(
    vercelConfig?.framework,
    "nextjs",
    "vercel.json must pin framework=nextjs before building production output.",
  );

  const detectedStatus = String(builds?.detectedFramework?.status || "").trim().toLowerCase();
  assert.ok(detectedStatus, "Vercel builds.json is missing detectedFramework.status.");
  assert.notEqual(
    detectedStatus,
    "skipped",
    "Vercel skipped framework detection; Next SSR routes would not be packaged.",
  );

  const normalizedFunctions = (functionDirs || []).map(normalizePath);
  const frontendFunctions = normalizedFunctions.filter((path) =>
    path.endsWith(".func") && !path.startsWith("api/")
  );
  assert.ok(
    frontendFunctions.length > 0,
    "Prebuilt output contains no non-API Vercel Function; Next page routing is missing.",
  );

  return Object.freeze({
    detectedStatus,
    frontendFunctions: Object.freeze(frontendFunctions),
  });
}

function listFunctionDirectories(root, relative = "") {
  const current = resolve(root, relative);
  const directories = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.name.endsWith(".func")) {
      directories.push(child);
      continue;
    }
    directories.push(...listFunctionDirectories(root, child));
  }
  return directories;
}

if (process.argv[1]?.endsWith("verify-prebuilt-next-routing.mjs")) {
  const projectRoot = process.cwd();
  const outputRoot = resolve(projectRoot, ".vercel/output");
  const vercelConfig = JSON.parse(readFileSync(resolve(projectRoot, "vercel.json"), "utf8"));
  const builds = JSON.parse(readFileSync(resolve(outputRoot, "builds.json"), "utf8"));
  const functionDirs = listFunctionDirectories(resolve(outputRoot, "functions"));
  const result = verifyPrebuiltNextRouting({ vercelConfig, builds, functionDirs });
  console.log(
    `Verified Vercel Next packaging: framework status ${result.detectedStatus}; ` +
    `${result.frontendFunctions.length} non-API function(s): ${result.frontendFunctions.join(", ")}.`,
  );
}
