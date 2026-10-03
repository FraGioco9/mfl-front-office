import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-routing-responsive-shell.tmp.mjs");
const source = await readFile(sourcePath, "utf8");

const compactShellContract = 'if (viewportWidth <= 1366 && selector.startsWith(".stats")) {';
assert.equal(
  source.split(compactShellContract).length - 1,
  1,
  "Broad routing regression must consume exactly one canonical compact-shell breakpoint contract.",
);

// TEST-04B: the broad routing job takes ~213-219s, including ~12 Player
// journeys at ~16.7s each. Instrument only the temporary *browser fixture*,
// preserving the canonical suite, viewport matrix, waits and assertions.
// Every anchor must occur exactly once: fail closed on upstream fixture drift.
const checkpoints = [
  [
    "async function navigateBackToScenario(setPage, timeline) {",
    String.raw`const __test04BTimeStart = performance.now();
  const __test04BTimeMarks = [];
  const __test04BMark = (label) => {
    if (scenario === "player") __test04BTimeMarks.push({
      phase: label,
      elapsedMs: Math.round(performance.now() - __test04BTimeStart),
    });
  };

  async function navigateBackToScenario(setPage, timeline) {`,
  ],
  [
    "const evaluationNavigation = setPage(\"evaluation\", true, { plain: true });",
    "__test04BMark(\"evaluation-start\");\n      const evaluationNavigation = setPage(\"evaluation\", true, { plain: true });",
  ],
  [
    "      await evaluationNavigation;\n      window.__mflEnsureRouteCore = originalEnsureRouteCore;",
    "      await evaluationNavigation;\n      __test04BMark(\"evaluation-core-ready\");\n      window.__mflEnsureRouteCore = originalEnsureRouteCore;",
  ],
  [
    "      await setPage(\"evaluation\", true, { playerId: \"1\" });",
    "      __test04BMark(\"evaluation-player-open\");\n      await setPage(\"evaluation\", true, { playerId: \"1\" });\n      __test04BMark(\"evaluation-player-ready\");",
  ],
  [
    "      scrollbarSpacer.remove();\n      assertPageAccessibilityState();",
    "      scrollbarSpacer.remove();\n      __test04BMark(\"evaluation-controls-checked\");\n      assertPageAccessibilityState();",
  ],
  [
    "    await setPage(\"privacy\", true);\n    await waitFor(() => window.location.pathname === \"/privacy\", scenario + \" could not navigate to Privacy.\");",
    "    __test04BMark(\"privacy-navigation-start\");\n    await setPage(\"privacy\", true);\n    __test04BMark(\"privacy-navigation-resolved\");\n    await waitFor(() => window.location.pathname === \"/privacy\", scenario + \" could not navigate to Privacy.\");",
  ],
  [
    "      await setPage(\"player\", true, { playerId: \"1\" });",
    "      await setPage(\"player\", true, { playerId: \"1\" });\n      __test04BMark(\"player-cached-return-resolved\");",
  ],
  [
    "    await delay(100);\n    assertSpaTimingAfter(timeline, baselineSequence);",
    "    await delay(100);\n    __test04BMark(\"spa-timing-ready\");\n    assertSpaTimingAfter(timeline, baselineSequence);",
  ],
  [
    "  async function runRepresentativeRoute() {\n    const setPage = Reflect.get(window, \"setPage\");",
    "  async function runRepresentativeRoute() {\n    __test04BMark(\"route-start\");\n    const setPage = Reflect.get(window, \"setPage\");",
  ],
  [
    "    assertNav03Navigation(\"direct refresh\");",
    "    assertNav03Navigation(\"direct refresh\");\n    __test04BMark(\"direct-refresh-ready\");",
  ],
  [
    "    const directState = routeState();\n    assertRouteState(directState);",
    "    const directState = routeState();\n    assertRouteState(directState);\n    __test04BMark(\"direct-state-asserted\");",
  ],
  [
    "    if (scenario === \"database\" && innerWidth > 900) await runNav02HistoryMatrix(setPage);\n    await navigateBackToScenario(setPage, timeline);",
    "    if (scenario === \"database\" && innerWidth > 900) await runNav02HistoryMatrix(setPage);\n    __test04BMark(\"spa-navigation-start\");\n    await navigateBackToScenario(setPage, timeline);\n    __test04BMark(\"spa-navigation-resolved\");",
  ],
  [
    "    finish(\"passed\", scenario + \": direct refresh and SPA navigation converged with canonical timing and no runtime errors.\");",
    "    __test04BMark(\"all-assertions-complete\");\n    finish(\"passed\", scenario + \": direct refresh and SPA navigation converged with canonical timing and no runtime errors.\" + (scenario === \"player\" ? \" TEST04B_PHASES=\" + JSON.stringify(__test04BTimeMarks) : \"\"));",
  ],
];
let profiledSource = source;
for (const [before, after] of checkpoints) {
  assert.equal(profiledSource.split(before).length - 1, 1,
    "TEST-04B phase timing hook must have one canonical anchor: " + before.slice(0, 90));
  profiledSource = profiledSource.replace(before, after);
}

await writeFile(temporaryPath, profiledSource, "utf8");

try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
      env: {
        ...process.env,
        MFL_BROWSER_SCENARIOS: [
          "stale",
          "database",
          "database-tablet",
          "database-phone",
          "database-empty",
          "database-linked-state",
          "player",
          "player-1444",
          "player-1363",
          "player-1200",
          "player-1181",
          "player-1180",
          "player-1101",
          "player-1090",
          "player-1041",
          "player-1040",
          "player-980",
          "player-901",
          "watchlist",
          "watchlist-empty",
          "myclubs-out",
          "myclubs-in",
          "myclubs-competition-fail",
          "myclubs-stale",
          "mflstats",
        ].join(","),
      },
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "Broad browser routing regression failed with the 1366px shell contract.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Broad browser routing regression passed with the 1366px compact-shell contract.");
