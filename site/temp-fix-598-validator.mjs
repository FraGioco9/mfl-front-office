import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteRoot, "..");
const branch = "fix/598-mobile-evaluation-popups";
const validatorPath = resolve(siteRoot, "validate-responsive-layout.mjs");
const packagePath = resolve(siteRoot, "package.json");

let source = readFileSync(validatorPath, "utf8");
const oldCheck = `includes(responsive, "#evaluationLoadModal .evaluationLoadDialog {\\n    width: min(100%, 420px);\\n    max-width: 420px;\\n    height: min(420px, calc(100dvh - 16px));", "The Load Evaluation popup must scale to a compact small-phone surface.");`;
const newChecks = `includes(responsive, "#advancedSettingsModal .advancedSettingsDialog,\\n  #evaluationLoadModal .evaluationLoadDialog {\\n    width: min(100%, 420px);\\n    max-width: 420px;\\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));", "Load Evaluation and Advanced Settings must share the compact safe-area-aware small-phone surface.");
includes(responsive, "#advancedSettingsModal .advancedSettingsFooter {\\n    display: grid;\\n    grid-template-columns: repeat(3, minmax(0, 1fr));\\n    gap: 6px;\\n    padding: 6px 8px;", "Advanced Settings must keep Reset, Discard, and Apply on one compact phone footer row.");`;

const first = source.indexOf(oldCheck);
if (first < 0) throw new Error("Missing old Load Evaluation responsive validator.");
if (source.indexOf(oldCheck, first + oldCheck.length) >= 0) throw new Error("Ambiguous old Load Evaluation responsive validator.");
source = `${source.slice(0, first)}${newChecks}${source.slice(first + oldCheck.length)}`;
writeFileSync(validatorPath, source);

const cleanPackage = execFileSync("git", ["show", "origin/main:site/package.json"], { cwd: repoRoot, encoding: "utf8" });
writeFileSync(packagePath, cleanPackage);
unlinkSync(resolve(siteRoot, "temp-fix-598-validator.mjs"));

execFileSync("git", ["config", "user.name", "FraGioco9"], { cwd: repoRoot });
execFileSync("git", ["config", "user.email", "giocolifrancesco@gmail.com"], { cwd: repoRoot });
execFileSync("git", ["add", "site/validate-responsive-layout.mjs", "site/package.json", "site/temp-fix-598-validator.mjs"], { cwd: repoRoot });
execFileSync("git", ["commit", "-m", "Update responsive popup regression coverage (#598)"], { cwd: repoRoot, stdio: "inherit" });
execFileSync("git", ["push", "origin", `HEAD:${branch}`], { cwd: repoRoot, stdio: "inherit" });
