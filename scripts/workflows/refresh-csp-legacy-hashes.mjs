import { readFileSync, writeFileSync } from "node:fs";
import { cspLegacyScriptHashes } from "../../csp-legacy-script-hashes.mjs";

// Review new parser-time inline scripts before invoking this generator.
// The source scanner deliberately stops the build if the approved count changes.
const path = new URL("../../csp-legacy-hash-snapshot.mjs", import.meta.url);
const result = [
  "// SEC-04: build-reviewed snapshot for the Next proxy bundle.",
  "// Keep this in sync with index.html via the validator; the proxy must NOT import",
  "// the filesystem-dependent hash calculator in an edge/middleware bundle.",
  "export const cspLegacyScriptHashSnapshot = Object.freeze([",
  ...cspLegacyScriptHashes.map(hash => `  ${JSON.stringify(hash)},`),
  "]);",
  "",
].join("\n");
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== result) {
    throw new Error("Proxy-safe CSP hash snapshot differs from generated inline legacy scripts.");
  }
  console.log("Proxy-safe CSP hash snapshot matches canonical HTML.");
} else {
  writeFileSync(path, result, "utf8");
  console.log("Updated CSP hash snapshot; review changes and include them in the PR.");
}
