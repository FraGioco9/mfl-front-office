import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteRoot, "..");
const file = (name) => resolve(siteRoot, name);
const read = async (name) => String(await readFile(file(name), "utf8")).replace(/\r\n?/g, "\n");
const write = (name, content) => writeFile(file(name), content, "utf8");

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeRule(source, selector, label) {
  const pattern = new RegExp(`\\n?${escapeRegex(selector)}\\s*\\{[^{}]*\\}\\n?`, "m");
  const matches = source.match(pattern);
  if (!matches) throw new Error(`${label}: rule not found: ${selector}`);
  return source.replace(pattern, "\n");
}

let stylesBase = await read("styles-base.css");
for (const [selector, label] of [
  [".evaluationSummaryPositionSelect", "Evaluation Position legacy trigger"],
  [".evaluationSummaryPositionSelect:focus", "Evaluation Position legacy focus"],
  [".evaluationSummaryPositionSelect option", "Evaluation Position legacy option"],
  [".evaluationSummaryTable td:nth-child(2):has(.evaluationSummaryPositionSelect)::after", "Evaluation Position legacy chevron"],
]) {
  stylesBase = removeRule(stylesBase, selector, label);
}
await write("styles-base.css", stylesBase);

let responsive = await read("responsive.css");
responsive = removeRule(
  responsive,
  "#evaluationPage .evaluationSummaryTable td:nth-child(2):has(.evaluationSummaryPositionSelect)::after",
  "Evaluation Position mobile legacy chevron",
);
responsive = replaceOnce(
  responsive,
  `#evaluationPage .evaluationSummaryPositionSelect {\n    width: 100%;\n    min-height: 28px;\n    padding: 0 8px 0 1px;\n    font-size: inherit;\n  }`,
  `#evaluationPage .evaluationSummaryPositionSelect {\n    width: 100%;\n    min-height: 28px;\n    padding: 0 2px;\n    font-size: inherit;\n  }`,
  "Evaluation Position mobile compact geometry",
);
await write("responsive.css", responsive);

let dropdowns = await read("dropdowns.css");
dropdowns = replaceOnce(
  dropdowns,
  `  --mfl-dropdown-chevron-inset: 10px;\n  --mfl-dropdown-transition-duration: 150ms;`,
  `  --mfl-dropdown-chevron-inset: 10px;\n  --mfl-dropdown-chevron-gap: auto;\n  --mfl-dropdown-transition-duration: 150ms;`,
  "Canonical dropdown chevron gap variable",
);
dropdowns = replaceOnce(
  dropdowns,
  `select[data-mfl-dropdown-enhanced="true"] {\n  box-sizing: border-box;\n  cursor: pointer;\n}\n`,
  `select[data-mfl-dropdown-enhanced="true"] {\n  box-sizing: border-box;\n  cursor: pointer;\n}\n\n.evaluationSummaryPositionSelect[data-mfl-dropdown-enhanced="true"] {\n  --mfl-dropdown-chevron-gap: 3px;\n  display: inline-flex;\n  align-items: center;\n  width: 52px;\n  min-width: 0;\n  height: auto;\n  margin: 0;\n  padding: 1px 4px 1px 6px;\n  font: inherit;\n  font-weight: 800;\n  line-height: inherit;\n  text-align: left;\n  vertical-align: middle;\n  user-select: none;\n}\n`,
  "Canonical compact Evaluation Position trigger",
);
dropdowns = replaceOnce(
  dropdowns,
  `    margin: 0 0 0 auto;\n    border: 0;`,
  `    margin: 0 0 0 var(--mfl-dropdown-chevron-gap);\n    border: 0;`,
  "Canonical dropdown picker icon gap",
);
await write("dropdowns.css", dropdowns);

let runtime = await read("dropdowns-runtime.js");
runtime = replaceOnce(
  runtime,
  `    return select instanceof HTMLSelectElement\n      && !select.classList.contains("evaluationSummaryPositionSelect")\n      && select.isConnected`,
  `    return select instanceof HTMLSelectElement\n      && select.isConnected`,
  "Evaluation Position dropdown enhancer exclusion",
);
await write("dropdowns-runtime.js", runtime);

let shared = await read("modules/core-sources/shared.js");
shared = replaceOnce(
  shared,
  `<select class="evaluationSummaryPositionSelect" data-evaluation-summary-position>`,
  `<select class="evaluationSummaryPositionSelect" data-mfl-dropdown-enhanced="true" data-evaluation-summary-position>`,
  "Evaluation Position first-render enhanced markup",
);
await write("modules/core-sources/shared.js", shared);

let dropdownValidator = await read("validate-dropdown-style-ownership.mjs");
dropdownValidator = replaceOnce(
  dropdownValidator,
  `const [stylesBase, styles, dropdowns, runtime] = await Promise.all([\n  read("./styles-base.css"),\n  read("./styles.css"),\n  read("./dropdowns.css"),\n  read("./dropdowns-runtime.js"),\n]);`,
  `const [stylesBase, styles, dropdowns, runtime, shared] = await Promise.all([\n  read("./styles-base.css"),\n  read("./styles.css"),\n  read("./dropdowns.css"),\n  read("./dropdowns-runtime.js"),\n  read("./modules/core-sources/shared.js"),\n]);`,
  "Dropdown validator source list",
);
dropdownValidator = replaceOnce(
  dropdownValidator,
  `invariant(\n  runtime.includes('!select.classList.contains("evaluationSummaryPositionSelect")'),\n  "Evaluation summary position selects must remain table-owned instead of receiving global dropdown enhancement.",\n);`,
  `invariant(\n  !runtime.includes('!select.classList.contains("evaluationSummaryPositionSelect")'),\n  "Evaluation Position must participate in the canonical dropdown enhancer instead of being special-cased out.",\n);\ninvariant(\n  shared.includes('class="evaluationSummaryPositionSelect" data-mfl-dropdown-enhanced="true" data-evaluation-summary-position'),\n  "Evaluation Position must render with canonical dropdown ownership on its first rendered frame.",\n);\ninvariant(\n  dropdowns.includes('--mfl-dropdown-chevron-gap: auto;')\n    && dropdowns.includes('.evaluationSummaryPositionSelect[data-mfl-dropdown-enhanced="true"] {')\n    && dropdowns.includes('--mfl-dropdown-chevron-gap: 3px;')\n    && dropdowns.includes('margin: 0 0 0 var(--mfl-dropdown-chevron-gap);'),\n  "Evaluation Position must use the canonical dropdown trigger/menu styling with a compact text-to-chevron gap.",\n);\ninvariant(\n  !stylesBase.includes('.evaluationSummaryTable td:nth-child(2):has(.evaluationSummaryPositionSelect)::after')\n    && !stylesBase.includes('.evaluationSummaryPositionSelect {'),\n  "Evaluation Position must not retain its legacy custom trigger or pseudo-element chevron owner.",\n);`,
  "Evaluation Position dropdown ownership validator",
);
await write("validate-dropdown-style-ownership.mjs", dropdownValidator);

let responsiveValidator = await read("validate-responsive-layout.mjs");
responsiveValidator = replaceOnce(
  responsiveValidator,
  `includes(responsive, "#evaluationPage .evaluationSummaryPositionSelect {\\n    width: 100%;", "The Evaluation position selector must fit its scaled summary column.");`,
  `includes(responsive, "#evaluationPage .evaluationSummaryPositionSelect {\\n    width: 100%;\\n    min-height: 28px;\\n    padding: 0 2px;", "The Evaluation position selector must fit its scaled summary column while keeping the canonical chevron close to its value.");\nexcludes(responsive, "#evaluationPage .evaluationSummaryTable td:nth-child(2):has(.evaluationSummaryPositionSelect)::after", "Responsive Evaluation must not recreate a custom Position chevron.");`,
  "Evaluation Position responsive validator",
);
await write("validate-responsive-layout.mjs", responsiveValidator);

const packagePath = file("package.json");
const pkg = JSON.parse(await readFile(packagePath, "utf8"));
if (pkg.scripts?.postinstall !== "node temp-fix-597.mjs") {
  throw new Error("Unexpected package postinstall while cleaning issue 597 helper");
}
delete pkg.scripts.postinstall;
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
await unlink(file("temp-fix-597.mjs"));

execFileSync("git", ["add", "site/styles-base.css", "site/responsive.css", "site/dropdowns.css", "site/dropdowns-runtime.js", "site/modules/core-sources/shared.js", "site/validate-dropdown-style-ownership.mjs", "site/validate-responsive-layout.mjs", "site/package.json", "site/temp-fix-597.mjs"], { cwd: repoRoot, stdio: "inherit" });
execFileSync("git", ["commit", "-m", "Restore default Evaluation Position dropdown (#597)"], { cwd: repoRoot, stdio: "inherit" });
execFileSync("git", ["push", "origin", "HEAD:fix/597-evaluation-position-dropdown"], { cwd: repoRoot, stdio: "inherit" });
