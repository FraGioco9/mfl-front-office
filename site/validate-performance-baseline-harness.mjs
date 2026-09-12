import { includes, invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const [packageJson, harness, performanceDocs, siteQuality] = await Promise.all([
  readValidationText("./package.json", import.meta.url),
  readValidationText("./validation/performance-baseline.mjs", import.meta.url),
  readValidationText("../docs/performance-923.md", import.meta.url),
  readValidationText("../.github/workflows/site-quality.yml", import.meta.url),
]);

includes(
  packageJson,
  '"performance:baseline": "node validation/performance-baseline.mjs"',
  "site/package.json must expose the canonical opt-in performance baseline command.",
);

for (const token of [
  "const DEFAULT_RUNS = 5;",
  '"desktop"',
  '"mobile-slow"',
  'id: "database"',
  'id: "player"',
  'id: "club"',
  'id: "my-clubs"',
  'expectedPath: "/my-clubs/opted-out"',
  'const expectedPath = journey.expectedPath || journey.path;',
  'id: "evaluation"',
  'id: "stats"',
  'path: "/database/attributes"',
  'path: "/mfl/stats"',
  '"cold"',
  '"refresh"',
  '"cached"',
  'window.__mflClientPerformance?.snapshot?.()',
  'new PerformanceObserver',
  'type: "longtask"',
  'type: "layout-shift"',
  'Network.requestWillBeSent',
  'Network.responseReceived',
  'Network.loadingFinished',
  'server-timing',
  "function median(values)",
  'process.env.MFL_BASELINE_OUTPUT',
  'process.env["PROGRAMFILES(X86)"]',
  'join(root, "Google", "Chrome", "Application", "chrome.exe")',
  'join(root, "Microsoft", "Edge", "Application", "msedge.exe")',
  'process.env.CHROME_PATH',
  'ready: document.documentElement?.dataset?.mflRouteReady === "true"',
  'loading: !document.body || document.body.classList.contains("loading")',
  '/execution context|cannot find context|context was destroyed/i',
]) {
  includes(harness, token, `Performance baseline harness contract is missing: ${token}`);
}

invariant(
  harness.includes('view: "contracts"')
    && harness.includes('{ column: "contract_status", operator: "is", value: "under_contract" }')
    && harness.includes('pageSize: "25"')
    && harness.includes('columns.indexOf("player_id")')
    && harness.includes('columns.indexOf("active_contract_club_id")'),
  "The baseline harness must discover representative Player/Club IDs before measured journeys rather than hard-coding dataset IDs.",
);

for (const token of [
  "five repetitions",
  "cold",
  "refresh",
  "cached SPA revisit",
  "desktop",
  "mobile-slow",
  "Server-Timing",
  "long-task",
  "cumulative layout shift",
  "opt-in",
  "must never be described as production latency",
]) {
  includes(performanceDocs, token, `Performance baseline methodology documentation is missing: ${token}`);
}

invariant(
  !siteQuality.includes("performance:baseline"),
  "The wall-clock performance baseline must remain opt-in instead of slowing every Site Quality run.",
);

console.log("Repeatable browser/runtime performance baseline ownership, journeys, metrics, profiles, and opt-in CI contract are canonical.");
