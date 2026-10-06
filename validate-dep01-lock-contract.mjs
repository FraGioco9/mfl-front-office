import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const [packageText, lockText, docs] = await Promise.all([
  readValidationText("./package.json", import.meta.url),
  readValidationText("./package-lock.json", import.meta.url),
  readValidationText("./docs/dep01-dependency-audit.md", import.meta.url),
]);
const pkg = JSON.parse(packageText);
const lock = JSON.parse(lockText);
const root = lock.packages?.[""] || {};

invariant(lock.lockfileVersion === 3, "DEP-01 expects npm lockfileVersion 3.");
invariant(pkg.engines?.node === "22.x", "DEP-01 must retain the Node 22 runtime contract.");
function sameRecord(left = {}, right = {}) {
  const a = Object.entries(left).sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  const b = Object.entries(right).sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  return JSON.stringify(a) === JSON.stringify(b);
}
invariant(sameRecord(root.dependencies, pkg.dependencies), "package-lock root dependencies must match package.json.");
invariant(sameRecord(root.devDependencies, pkg.devDependencies), "package-lock root devDependencies must match package.json.");

function installed(name) {
  return lock.packages?.[`node_modules/${name}`] || null;
}
function versionTuple(value) {
  return String(value || "").split(".").map(part => Number.parseInt(part, 10) || 0);
}
function atLeast(actual, minimum) {
  const a = versionTuple(actual), b = versionTuple(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

for (const name of [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]) {
  const entry = installed(name);
  invariant(entry?.version, `Direct dependency ${name} must be present in package-lock.`);
  invariant(String(entry.license || "").trim(), `Direct dependency ${name} must expose lockfile license metadata.`);
}

invariant(installed("next")?.version === "16.3.6", "Next must remain on the reviewed 16.3.6 security baseline.");
invariant(installed("react")?.version === "19.3.0" && installed("react-dom")?.version === "19.3.0", "React and React DOM must stay aligned at 19.3.0.");
invariant(installed("react-dom")?.peerDependencies?.react === "^19.3.0", "React DOM peer dependency must accept the installed React line.");
invariant(installed("eslint")?.version === "10.11.0", "ESLint must remain on the reviewed 10.11.0 baseline.");
invariant(atLeast(installed("brace-expansion")?.version, "5.0.12"), "brace-expansion must remain at or above the reviewed 5.0.12 security floor.");
invariant(
  docs.includes("GHSA-vcvr-r3jv-pc5j")
    && docs.includes("brace-expansion 5.0.12")
    && docs.includes("NO CHANGE dependencies"),
  "DEP-01 documentation must retain the reviewed security rationale.",
);

console.log("DEP-01 package/lock consistency, license metadata, peer alignment and security-floor validation passed.");
