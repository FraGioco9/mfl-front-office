import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const routeCases = [
  { route: "home", scenario: "database" },
  { route: "database", scenario: "database" },
  { route: "player", scenario: "player" },
  { route: "planner", scenario: "planner" },
  { route: "settings", scenario: "database" },
  { route: "database", scenario: "database", phone: true },
  { route: "planner", scenario: "planner", phone: true },
];
const plannerCases = ["database", "planner"].map(scenario => ({ scenario }));
const suites = {
  "01": {
    helper: "browser-a11y01-helper.mjs",
    audit: "auditAccessibility",
    cases: routeCases,
    summary: "A11Y-01 axe WCAG 2.1 AA and keyboard audits passed for Home, Database, Player, Planner and Settings.",
  },
  "02": {
    helper: "browser-a11y02-control-helper.mjs",
    audit: "auditControlSemantics",
    cases: ["database", "player", "planner", "watchlist"].map(scenario => ({ route: scenario, scenario })),
    summary: "A11Y-02 control-name/state matrix passed for Database, Player, Planner and Watchlist.",
  },
  "03": {
    helper: "browser-a11y03-contrast-helper.mjs",
    audit: "auditContrast",
    cases: routeCases,
    summary: "A11Y-03 seven route/viewport cases pass both light and dark color-contrast audits.",
  },
  "04": {
    helper: "browser-a11y04-live-helper.mjs",
    audit: "auditLiveAnnouncements",
    cases: plannerCases,
    summary: "A11Y-04 browser live-announcement matrix passed.",
  },
  "05": {
    helper: "browser-a11y05-reduced-helper.mjs",
    audit: "auditReducedMotion",
    cases: plannerCases,
    summary: "A11Y-05 reduced motion matrix passed for Database/Stats and Planner hydrated routes.",
  },
  "06": {
    helper: "browser-a11y06-landmarks-helper.mjs",
    audit: "auditLandmarks",
    cases: routeCases,
    summary: "A11Y-06 named landmarks and first-Tab skip matrix passed on seven route/viewport cases.",
  },
};

async function auditConsumersAndNextTraces() {
  const { execFileSync } = await import("node:child_process");
  const { readdir } = await import("node:fs/promises");
  const tsModule = await import("@typescript/typescript6");
  const ts = tsModule.default ?? tsModule;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString("utf8").split("\0").filter(Boolean);
  const suffixes = ["route-audit", "control-semantics", "contrast-regression",
    "live-regression", "reduced-regression", "landmarks-regression"];
  const removed = suffixes.map((suffix, index) => "browser-a11y0" + (index + 1) + "-" + suffix + ".mjs");
  const matrixRemoved = ["recovery", "saved-actions", "filter-state", "narrow-reflow"]
    .map(name => "browser-" + name + "-regression.mjs");
  const removedRunners = [...removed, ...matrixRemoved];
  const nextTableCliNames = ["next-mobile-table-browser.mjs", "next-mobile-table-route-browser.mjs"];
  const nextTableAstConsumers = [];
  const cdpHelperConsumers = [];
  assert.deepEqual(tracked.filter(path => removedRunners.some(name => path.endsWith("/" + name))), [],
    "Removed A11Y/BROWSER-MATRIX CLI paths must not exist in the Git index.");
  const sourcePaths = tracked.filter(path => /\.(?:cjs|mjs|js|ts|tsx)$/.test(path));
  const references = [];
  let dynamicCalls = 0;
  for (const path of sourcePaths) {
    const content = await readFile(resolve(root, path), "utf8");
    const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : path.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const ast = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind);
    function visit(node) {
      if (ts.isStringLiteralLike(node) && removedRunners.some(name => node.text.includes(name))) {
        references.push(path + ":" + ast.getLineAndCharacterOfPosition(node.getStart(ast)).line);
      }
      if (path !== "validation/browser-a11y-runner.mjs" && ts.isStringLiteralLike(node)
        && nextTableCliNames.some(name => node.text.includes(name))) nextTableAstConsumers.push(path);
      if (ts.isStringLiteralLike(node) && node.text === "./next-browser-cdp.mjs") cdpHelperConsumers.push(path);
      if (ts.isCallExpression(node)) {
        const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
        if ((isImport || isRequire) && node.arguments.length && !ts.isStringLiteralLike(node.arguments[0])) {
          dynamicCalls += 1;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.deepEqual(references, [], "AST found removed runner path consumers: " + references.join(", "));
  const textPaths = tracked.filter(path => /\.(?:ya?ml|json|sh|py|md|html|css|inc|toml)$/.test(path));
  assert.deepEqual([...new Set(nextTableAstConsumers)].sort(), ["validation/next-mobile-table-route-browser.mjs"],
    "NEXT-TABLE-01 found unexpected in-repo AST consumers.");
  assert.deepEqual([...new Set(cdpHelperConsumers)].sort(),
    ["validation/next-mobile-table-browser.mjs", "validation/next-rendered-shell-browser.mjs"],
    "NEXT-CDP-02 helper must have exactly two runtime probe consumers.");
  const textReferences = [];
  const nextTableTextConsumers = [];
  for (const path of textPaths) {
    const content = await readFile(resolve(root, path), "utf8");
    if (matrixRemoved.some(name => content.includes(name))) textReferences.push(path);
    if (nextTableCliNames.some(name => content.includes(name))) nextTableTextConsumers.push(path);
  }
  assert.deepEqual(textReferences, [], "Removed BROWSER-MATRIX paths found in non-JS consumers.");
  assert.deepEqual(nextTableTextConsumers, [".github/workflows/site-quality.yml"],
    "NEXT-TABLE-01 historical CLI consumers changed in workflow/manifest/text sources.");
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  for (const [index, command] of ["test:a11y", "test:a11y:controls", "test:a11y:contrast",
    "test:a11y:announcements", "test:a11y:motion", "test:a11y:landmarks"].entries()) {
    assert.ok(packageJson.scripts[command].includes("node validation/browser-a11y-runner.mjs 0" + (index + 1)),
      "A11Y npm entrypoint drifted: " + command);
  }
  const nftFiles = [];
  async function scanNft(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await scanNft(path);
      else if (entry.isFile() && entry.name.endsWith(".nft.json")) nftFiles.push(path);
    }
  }
  try {
    await scanNft(resolve(root, ".next"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (process.env.CI) assert.ok(nftFiles.length > 0, "CI must produce Next NFT manifests before the A11Y audit.");
  const nftReferences = [];
  const nextTableNftReferences = [];
  const cdpHelperNftReferences = [];
  for (const path of nftFiles) {
    const trace = JSON.parse(await readFile(path, "utf8"));
    for (const included of trace.files || []) {
      if (removedRunners.some(name => included.endsWith("/" + name))
        || included.endsWith("/browser-a11y-runner.mjs")
        || included.endsWith("/browser-matrix-runner.mjs")) {
        nftReferences.push(path + " -> " + included);
      }
      if (nextTableCliNames.some(name => included.replaceAll("\\", "/").endsWith("/" + name)))
        nextTableNftReferences.push(path + " -> " + included);
      if (included.replaceAll("\\", "/").endsWith("/next-browser-cdp.mjs"))
        cdpHelperNftReferences.push(path + " -> " + included);
    }
  }
  assert.deepEqual(nftReferences, [], "Test-only A11Y modules appeared in Next production NFT traces.");
  assert.deepEqual(nextTableNftReferences, [], "NEXT-TABLE-01 test-only CLI entered production Next NFT traces.");
  assert.deepEqual(cdpHelperNftReferences, [], "NEXT-CDP-02 test-only helper entered production Next NFT traces.");
  console.log("NEXT-CDP-02 AST/NFT audit: 2 helper consumers / " + nftFiles.length + " Next NFT manifests / 0 helper production traces.");
  console.log("NEXT-TABLE-01 AST/NFT audit: 2 historical CLIs / 1 internal import consumer / 1 workflow consumer / "
    + nftFiles.length + " Next NFT manifests / 0 Next Table production traces.");
  console.log("A11Y AST audit: " + tracked.length + " tracked paths / " + sourcePaths.length
    + " parsed source files / 0 removed-path imports; " + dynamicCalls + " calculated import/require calls (not individually resolved).");
  console.log("BROWSER-MATRIX AST/NFT audit: " + sourcePaths.length + " JS/TS sources / "
    + textPaths.length + " auxiliary texts / 0 removed runner paths; " + nftFiles.length
    + " Next NFT manifests / 0 browser-matrix traces.");
  console.log("A11Y Next NFT audit: " + nftFiles.length + " manifests / 0 test runner references"
    + (nftFiles.length ? "." : "; no production build available."));
}

if (process.argv[2] === "--audit" && process.argv.length === 3) {
  await auditConsumersAndNextTraces();
  await import("./next-mobile-table-negative-regression.mjs");
} else {
const suiteId = process.argv[2];
assert.ok(Object.hasOwn(suites, suiteId) && process.argv.length === 3, "Specify exactly one A11Y suite: 01, 02, 03, 04, 05, or 06.");
const suite = suites[suiteId];
const directory = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(directory, "browser-routing-regression.mjs"), "utf8");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.equal(source.split(marker).length, 2, "A11Y-" + suiteId + " requires exactly one canonical Chromium CDP hook.");
const injected = source.replace(marker,
  '    await cdp.send("Runtime.enable");\n'
  + '    const baseline = await waitForBrowserRegression(cdp);\n'
  + '    return await (await import("./' + suite.helper + '")).' + suite.audit + '(cdp, url, baseline);\n'
);
const temporary = resolve(directory, ".browser-a11y" + suiteId + "-" + process.pid + "-" + randomUUID() + ".tmp.mjs");
const failures = [];

function failureMessage(item) {
  if (suiteId === "01") return "A11Y-01 audit failed: " + item.route + (item.phone ? " phone" : " desktop");
  if (suiteId === "02") return "A11Y-02 browser audit failed: " + item.route;
  if (suiteId === "04") return "A11Y-04 failed hydrated browser scenario: " + item.scenario;
  if (suiteId === "05") return "A11Y-05 reduced-motion browser case failed: " + item.scenario;
  return "A11Y-06 landmarks/keyboard failed: " + item.route + (item.phone ? " phone" : " desktop");
}

try {
  for (const item of suite.cases) {
    let content = injected;
    if (item.phone && item.scenario === "database") {
      const desktopFixture = '["database", "/database/attributes"],';
      assert.ok(content.includes(desktopFixture), "A11Y-" + suiteId + " phone database fixture is missing.");
      content = content.replace(desktopFixture, '["database", "/database/attributes", 390, 844],');
    }
    await writeFile(temporary, content, "utf8");
    const env = {
      ...process.env,
      MFL_BROWSER_SCENARIOS: item.scenario,
      MFL_PLANNER_BROWSER_FOCUSED: item.scenario === "planner" ? "1" : "0",
      MFL_PLANNER_BROWSER_PHASE: "shell",
    };
    if (suiteId === "01" || suiteId === "03" || suiteId === "06") {
      env.MFL_A11Y01_ROUTE = item.route;
      env.MFL_UX03_BROWSER_VIEWPORT = item.phone && item.scenario === "planner" ? "phone" : "desktop";
    }
    if (suiteId === "02") env.MFL_A11Y02_ROUTE = item.route;
    if (suiteId === "03") env.MFL_A11Y03_ROUTE = item.route;
    if (suiteId === "06") env.MFL_A11Y06_ROUTE = item.route;

    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [temporary], {
        cwd: resolve(directory, ".."),
        stdio: "inherit",
        env,
      });
      child.once("error", reject);
      child.once("close", done);
    });
    if (suiteId === "03") {
      if (code !== 0) {
        const label = item.route + (item.phone ? " phone" : " desktop");
        failures.push(label);
        console.error("A11Y-03 contrast audit failed on " + label);
      }
    } else {
      assert.equal(code, 0, failureMessage(item));
    }
  }
} finally {
  await rm(temporary, { force: true });
}
if (suiteId === "03") {
  assert.deepEqual(failures, [], "A11Y-03 contrast failures across route/viewport cases: " + failures.join(", "));
}
console.log(suite.summary);
}
