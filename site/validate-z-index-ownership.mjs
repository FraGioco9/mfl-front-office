import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const siteRoot = dirname(fileURLToPath(import.meta.url));

async function collectFiles(directory, extension) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...await collectFiles(absolute, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      found.push(absolute);
    }
  }
  return found;
}

const cssFiles = await collectFiles(siteRoot, ".css");
const cssEntries = await Promise.all(cssFiles.map(async (absolute) => [
  relative(siteRoot, absolute).replaceAll("\\", "/"),
  await readFile(absolute, "utf8"),
]));
const css = new Map(cssEntries);

const stacking = css.get("stacking.css") || "";
const base = css.get("styles-base.css") || "";
const styles = css.get("styles.css") || "";
const dropdowns = css.get("dropdowns.css") || "";
const responsive = css.get("responsive.css") || "";
const loading = css.get("loading.css") || "";
const canonicalCore = await readFile(join(siteRoot, "modules/app-core.js"), "utf8");
const generatedCore = await readFile(join(siteRoot, "modules/app-core-runtime.js"), "utf8");

const tokenOrder = [
  "content",
  "navigation",
  "navigation-mobile",
  "dropdown",
  "chrome",
  "floating-tooltip",
  "selection",
  "busy-shield",
  "topmost",
  "modal",
  "critical-modal",
  "toast",
];

const expectedValues = new Map([
  ["content", 0],
  ["navigation", 300],
  ["navigation-mobile", 310],
  ["dropdown", 400],
  ["chrome", 500],
  ["floating-tooltip", 600],
  ["selection", 700],
  ["busy-shield", 740],
  ["topmost", 780],
  ["modal", 900],
  ["critical-modal", 1000],
  ["toast", 1100],
]);

const tokenValue = (name) => {
  const match = stacking.match(new RegExp(`--mfl-z-${name}:\\s*(-?\\d+);`));
  return match ? Number(match[1]) : NaN;
};

for (const [name, expected] of expectedValues) {
  invariant(
    tokenValue(name) === expected,
    `Global stacking contract must define --mfl-z-${name}: ${expected};`,
  );
}

for (let index = 1; index < tokenOrder.length; index += 1) {
  const lower = tokenOrder[index - 1];
  const upper = tokenOrder[index];
  invariant(
    tokenValue(lower) < tokenValue(upper),
    `Global stacking order must keep ${lower} below ${upper}.`,
  );
}

invariant(
  stacking.includes("page content is contained inside one isolated root stacking context"),
  "Canonical stacking owner must document the isolated page-content root.",
);
invariant(
  stacking.includes("ordinary player-table headers, rows, and cells do not create independent"),
  "Canonical stacking owner must document ordinary-table stacking simplification.",
);
invariant(
  stacking.includes("component-local z-index values stay below 300"),
  "Canonical stacking owner must document the local/global stacking boundary.",
);
invariant(
  stacking.includes("toasts are the")
    && stacking.includes("final site-owned layer")
    && stacking.includes("above every popup/modal layer"),
  "Canonical stacking owner must document toast precedence over popup layers.",
);

const appShellStart = stacking.indexOf(".appShell {");
const appShellEnd = stacking.indexOf("}", appShellStart);
const appShellRule = appShellStart >= 0 ? stacking.slice(appShellStart, appShellEnd + 1) : "";
for (const required of [
  "position: relative;",
  "z-index: var(--mfl-z-content);",
  "isolation: isolate;",
]) invariant(appShellRule.includes(required), `Page-content stacking root must retain ${required}`);

invariant(
  !stacking.includes("translateZ(0)") && !stacking.includes("backface-visibility:"),
  "Modal stacking must not rely on compositor-promotion hacks.",
);

const genericHeaderStart = base.indexOf("\nth {\n");
const genericHeaderEnd = base.indexOf("}\n", genericHeaderStart);
const genericHeaderRule = genericHeaderStart >= 0 ? base.slice(genericHeaderStart, genericHeaderEnd + 2) : "";
invariant(genericHeaderStart >= 0, "Base styles must retain the generic table-header presentation rule.");
for (const forbidden of ["position: sticky;", "top: 0;", "z-index:"]) {
  invariant(
    !genericHeaderRule.includes(forbidden),
    `Ordinary table headers must not own ${forbidden} and create an independent stacking layer.`,
  );
}

for (const match of base.matchAll(/(?:^|\n)td\.col-id\s*\{([^}]*)\}/g)) {
  invariant(
    !/\bposition\s*:|\bz-index\s*:/.test(match[1]),
    "Ordinary player ID cells must not create a positioned z-index layer.",
  );
}
for (const match of base.matchAll(/#tableBody tr\s*\{([^}]*)\}/g)) {
  invariant(
    !/\bisolation\s*:\s*isolate\b/.test(match[1]),
    "Ordinary table body rows must not create isolated stacking contexts.",
  );
}

const evaluationTopBarStart = base.indexOf('html body[data-page="evaluation"] #evaluationPage .evaluationTopBar {');
const evaluationTopBarEnd = base.indexOf("}\n", evaluationTopBarStart);
const evaluationTopBarRule = evaluationTopBarStart >= 0 ? base.slice(evaluationTopBarStart, evaluationTopBarEnd + 2) : "";
invariant(evaluationTopBarStart >= 0, "Evaluation must retain its top-bar visibility rule.");
invariant(!evaluationTopBarRule.includes("z-index:") && !evaluationTopBarRule.includes("position: relative;"), "Evaluation top bar must stay in normal page paint order.");

const evaluationSearchStart = base.indexOf(".evaluationSearchResults {");
const evaluationSearchEnd = base.indexOf("}\n", evaluationSearchStart);
const evaluationSearchRule = evaluationSearchStart >= 0 ? base.slice(evaluationSearchStart, evaluationSearchEnd + 2) : "";
invariant(evaluationSearchStart >= 0 && evaluationSearchRule.includes("position: absolute;"), "Evaluation search results must remain anchored as an absolute dropdown.");
invariant(!evaluationSearchRule.includes("z-index:"), "Evaluation last-five results must not own a stacking level above popups.");
invariant(!base.includes('html body[data-page="evaluation"] #evaluationPage .evaluationSearchGroup,\nhtml body[data-page="evaluation"] #evaluationPage .evaluationSearch {\n  z-index:'), "Evaluation search controls must not own a page-level z-index.");
invariant(!base.includes('html body[data-page="evaluation"] #evaluationSearchResults:not([hidden]) {\n  position: absolute;\n  z-index:'), "Visible Evaluation results must not reintroduce their own z-index.");
invariant(!base.includes('html body[data-page="evaluation"] #evaluationPanel {\n  position: relative;\n  z-index:'), "Evaluation panel must not create a zero-level stacking context.");

for (const required of [
  ".advancedPlayerTable {",
  "isolation: isolate;",
  ".advancedPlayerTable thead {\n  position: sticky;",
  ".advancedPlayerTable thead th {\n  position: sticky;",
  ".advancedPlayerTable thead th:first-child,\n.advancedPlayerTable tbody th {\n  position: sticky;",
]) invariant(base.includes(required), `Advanced Settings must retain its scoped table stacking requirement: ${required}`);

const knownTokens = new Set(tokenOrder.map((name) => `--mfl-z-${name}`));
const localNumericLayers = [];
for (const [file, source] of css) {
  if (file === "stacking.css") continue;

  for (const match of source.matchAll(/z-index:\s*(-?\d+)\s*;/g)) {
    localNumericLayers.push({ file, value: Number(match[1]) });
  }

  for (const match of source.matchAll(/z-index:\s*var\((--mfl-z-[^)]+)\)\s*;/g)) {
    invariant(knownTokens.has(match[1]), `Unknown global stacking token ${match[1]} in ${file}.`);
  }
}

const highestLocalLayer = localNumericLayers.reduce(
  (highest, layer) => Math.max(highest, layer.value),
  Number.NEGATIVE_INFINITY,
);
invariant(
  highestLocalLayer < tokenValue("navigation"),
  `Component-local z-index values must remain below the global plane (${tokenValue("navigation")}); found ${highestLocalLayer}.`,
);
invariant(
  tokenValue("modal") > Math.max(
    tokenValue("topmost"),
    tokenValue("busy-shield"),
    tokenValue("selection"),
    tokenValue("floating-tooltip"),
    tokenValue("chrome"),
    tokenValue("dropdown"),
    tokenValue("navigation-mobile"),
    tokenValue("navigation"),
    tokenValue("content"),
    highestLocalLayer,
  ),
  "Standard popup layers must render above every ordinary global and component-local z-index layer.",
);
invariant(
  tokenValue("critical-modal") > tokenValue("modal"),
  "Critical popup layers must render above standard popup layers.",
);
invariant(
  tokenValue("toast") > Math.max(
    tokenValue("critical-modal"),
    tokenValue("modal"),
    tokenValue("topmost"),
    tokenValue("busy-shield"),
    tokenValue("selection"),
    tokenValue("floating-tooltip"),
    tokenValue("chrome"),
    tokenValue("dropdown"),
    tokenValue("navigation-mobile"),
    tokenValue("navigation"),
    tokenValue("content"),
    highestLocalLayer,
  ),
  "Toasts must render above every popup, overlay, and application layer.",
);

invariant(base.startsWith('@import url("/stacking.css");'), "Base styles must load the canonical stacking contract before site layers consume it.");
for (const required of [
  "z-index: var(--mfl-z-chrome);",
  "z-index: var(--mfl-z-navigation);",
  "z-index: var(--mfl-z-modal);",
  "z-index: var(--mfl-z-selection);",
  "z-index: var(--mfl-z-floating-tooltip);",
  "z-index: var(--mfl-z-critical-modal);",
  "z-index: var(--mfl-z-topmost);",
]) invariant(base.includes(required), `Base stacking consumer is missing ${required}`);

invariant(styles.includes("z-index: var(--mfl-z-topmost);"), "Global tooltip must consume the highest ordinary non-popup stacking level.");
invariant(styles.includes("z-index: var(--mfl-z-chrome);"), "Database Stats popover must consume the shared chrome stacking level.");
invariant(dropdowns.match(/z-index: var\(--mfl-z-dropdown\);/g)?.length === 3, "Account, Watchlist, and Player table action dropdowns must share one global dropdown level.");
invariant(responsive.includes("z-index: var(--mfl-z-navigation-mobile);"), "Mobile navigation must consume the mobile navigation level.");
invariant(!loading.includes("z-index: var(--mfl-z-busy-shield);"), "The retired interaction shield must not consume a global stacking level.");
invariant(loading.includes("z-index: var(--mfl-z-toast);"), "Normal toasts must consume the global toast level.");
invariant(
  generatedCore.includes("document.body.appendChild(toast)"),
  "Toasts must be attached to body so their global layer can outrank isolated page and popup layers.",
);

const modalStart = base.indexOf(".modalBackdrop {");
const modalEnd = base.indexOf("}", modalStart);
const modalRule = modalStart >= 0 ? base.slice(modalStart, modalEnd + 1) : "";
for (const required of [
  "position: fixed;",
  "inset: 0;",
  "z-index: var(--mfl-z-modal);",
  "background: rgba(0, 0, 0, 0.45);",
]) invariant(modalRule.includes(required), `Original modal backdrop rendering must retain ${required}`);

for (const source of [stacking, canonicalCore, generatedCore]) {
  invariant(
    !source.includes("showPopover")
      && !source.includes("hidePopover")
      && !source.includes('setAttribute("popover"')
      && !source.includes("[popover]"),
    "Popup layering must not use the browser Popover/top-layer API.",
  );
}

const toastStart = base.indexOf(".toastMessage {");
const toastEnd = base.indexOf("}", toastStart);
const baseToast = base.slice(toastStart, toastEnd);
invariant(toastStart >= 0 && !baseToast.includes("z-index:"), "Base toast styling must not duplicate the effective toast stacking owner in loading.css.");

console.log(`Global stacking validation passed: page content is isolated at ${tokenValue("content")}, ordinary table headers/rows/cells stay in normal page paint order, Advanced Settings retains scoped sticky table layers, ${localNumericLayers.length} component-local z-index declarations stay below ${tokenValue("navigation")}, modal ${tokenValue("modal")} / critical modal ${tokenValue("critical-modal")} stay above ordinary layers, and toast ${tokenValue("toast")} stays above every popup and overlay without compositor-promotion hacks.`);
