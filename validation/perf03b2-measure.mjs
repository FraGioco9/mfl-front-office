// PERF-03B2: extend PERF-03A CDP profiling with first-use interactions.
// All changes are to disposable instrumented scripts in GitHub Actions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

let wrapper = await readFile('validation/perf03-js-audit.mjs', 'utf8');
const probe = await readFile('validation/perf03b2-first-use-snippet.txt', 'utf8');
const edits = [
  [
    'async function runJourney(executable, profile, journey) {',
    probe + '\nasync function runJourney(executable, profile, journey) {',
    'first-use helper',
  ],
  [
    '    const refresh = await runMeasuredPhase(',
    "    const perf03b2ColdSearch = await perf03b2SearchProbe(cdp, network, 'cold');\n\n    const refresh = await runMeasuredPhase(",
    'cold first-use',
  ],
  [
    '    const perf03CachedTimingDelta = {};',
    "    const perf03b2CachedSearch = await perf03b2SearchProbe(cdp, network, 'cached');\n    const perf03CachedTimingDelta = {};",
    'cached SPA reentry first-use',
  ],
  [
    '      cold: { ...cold, perf03Js: perf03Cold },',
    '      cold: { ...cold, perf03Js: perf03Cold, perf03b2Search: perf03b2ColdSearch },',
    'cold interaction output',
  ],
  [
    'const executable = browserExecutable();',
    "async function perf03b2RunWithTransportRetry(executable, profile, journey) {\n  let lastError = null;\n  for (let attempt = 1; attempt <= 3; attempt++) {\n    try {\n      return await runJourney(executable, profile, journey);\n    } catch (error) {\n      lastError = error;\n      const message = String(error?.message || error);\n      // Retry *only* Chrome/CDP transport interruptions, never assertions about\n      // app behavior, request topology, keyboard/focus, or canonical routes.\n      if (!/Inspected target navigated or closed|Target closed|WebSocket.*closed|Session closed/i.test(message)\n        || attempt === 3) throw error;\n      console.warn('PERF-03B2 transient CDP transport restart ' + attempt\n        + '/2: ' + profile.id + '/' + journey.id + ': ' + message.slice(0, 160));\n    }\n  }\n  throw lastError;\n}\n\nconst executable = browserExecutable();",
    'bounded CDP-transport-only retry owner',
  ],
  [
    'const result = await runJourney(executable, profile, journey);',
    'const result = await perf03b2RunWithTransportRetry(executable, profile, journey);',
    'bounded CDP-transport-only retry call',
  ],
  [
    '      cached: { ...cached, perf03Js: { ...perf03Cached, performanceMetrics: perf03CachedTimingDelta } },',
    '      cached: { ...cached, perf03Js: { ...perf03Cached, performanceMetrics: perf03CachedTimingDelta }, perf03b2Search: perf03b2CachedSearch },',
    'cached interaction output',
  ],
];
const extendedHooks = edits.map(([before, after, label]) =>
  'insertOnce(' + JSON.stringify(before) + ', ' + JSON.stringify(after)
  + ', ' + JSON.stringify('PERF-03B2 ' + label) + ');').join('\n');
const anchor = 'await writeFile(temporary, instrumented, "utf8");';
assert.ok(wrapper.includes(anchor), 'PERF-03A runner write hook missing');
wrapper = wrapper.replace(anchor, extendedHooks + '\n\n' + anchor);
const temporary = resolve('validation/.perf03b2-ab-wrapper.tmp.mjs');
await writeFile(temporary, wrapper);
try {
  const code = await new Promise((ok, fail) => {
    const child = spawn(process.execPath, [temporary], { stdio: 'inherit', env: process.env });
    child.on('error', fail);
    child.on('exit', (status, signal) => ok(status ?? (signal ? 1 : 0)));
  });
  assert.equal(code, 0, 'PERF-03B2 A/B first-use capture failed');
} finally {
  await rm(temporary, { force: true });
}
