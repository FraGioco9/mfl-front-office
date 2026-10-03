// PERF-03B2 same-runner A/B evidence summarizer. No speculative speedup gate.
// The CDP sample is intrusive and CI timings are not production RUM.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const files = [
  ['control', 1, 'perf03b2-control-1.json'],
  ['candidate', 1, 'perf03b2-candidate-1.json'],
  ['candidate', 2, 'perf03b2-candidate-2.json'],
  ['control', 2, 'perf03b2-control-2.json'],
];
const runs = await Promise.all(files.map(async ([variant, repetition, file]) => {
  const report = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(report.metadata.complete, true, 'Incomplete A/B capture: ' + file);
  assert.equal(report.metadata.repetitions, 1, 'Each side must have one fresh-profile repeat per pass.');
  return { variant, repetition, report };
}));
const ids = runs.map(x => x.report.metadata.targetContext);
for (const id of ids.slice(1)) {
  for (const field of ['datasetGeneratedAt', 'datasetRowCount', 'datasetWalletCount', 'browserVersion', 'sourceCommit']) {
    assert.deepEqual(id[field], ids[0][field], 'A/B provenance mismatch: ' + field);
  }
}
const profiles = ['desktop', 'mobile-slow'];
const journeys = ['home', 'database', 'evaluation'];
const rows = [];
const metric = (row, phase, name) => {
  const value = row[phase].perf03Js.performanceMetrics[name];
  return Number.isFinite(value) ? value * 1000 : null;
};
const median = values => {
  const ordered = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!ordered.length) return null;
  return ordered.length % 2
    ? ordered[Math.floor(ordered.length / 2)]
    : (ordered[ordered.length/2 - 1] + ordered[ordered.length/2]) / 2;
};
function rounded(value) {
  return value === null ? 'n/a' : Number(value.toFixed(2));
}
for (const profile of profiles) {
  for (const journey of journeys) {
    const observations = {};
    for (const variant of ['control', 'candidate']) {
      observations[variant] = runs.filter(x => x.variant === variant).map(x => {
        const raw = x.report.raw?.[profile]?.[journey];
        assert.ok(raw?.cold?.length === 1 && raw?.refresh?.length === 1 && raw?.cached?.length === 1,
          'Missing A/B route/phase ' + variant + ' ' + profile + '/' + journey);
        const scripts = raw.cold[0].perf03Js.scripts
          .filter(x => /^http:\/\/127\.0\.0\.1:400[12]\//.test(x.url || ''))
          .map(x => new URL(x.url).pathname).sort();
        assert.ok(raw.cold[0].perf03b2Search && raw.cached[0].perf03b2Search,
          'First-use probe missing: ' + profile + '/' + journey);
        return { repetition: x.repetition, cold: raw.cold[0], refresh: raw.refresh[0],
          cached: raw.cached[0], scripts };
      });
    }
    assert.equal(observations.control.length, 2);
    assert.equal(observations.candidate.length, 2);
    for (const candidate of observations.candidate) {
      const control = observations.control.find(x => x.repetition === candidate.repetition);
      assert.deepEqual(candidate.scripts, control.scripts,
        'New/missing first-paint script URLs in candidate ' + profile + '/' + journey);
      assert.equal(candidate.cold.perf03b2Search.resultCount,
        control.cold.perf03b2Search.resultCount,
        'Search result count regression at cold first-use');
      assert.equal(candidate.cached.perf03b2Search.resultCount,
        control.cached.perf03b2Search.resultCount,
        'Search result count regression on cached reentry');
    }
    const summarize = variant => {
      const samples = observations[variant];
      return {
        coldScriptMs: median(samples.map(x => metric(x, 'cold', 'ScriptDuration'))),
        coldCompileMs: median(samples.map(x => metric(x, 'cold', 'V8CompileDuration'))),
        coldRequests: median(samples.map(x => x.cold.requestCount)),
        coldBytes: median(samples.map(x => x.cold.bytes)),
        refreshScriptMs: median(samples.map(x => metric(x, 'refresh', 'ScriptDuration'))),
        cachedScriptMs: median(samples.map(x => metric(x, 'cached', 'ScriptDuration'))),
        firstFocusMs: median(samples.map(x => x.cold.perf03b2Search.firstFocusMs)),
        firstUseRequests: median(samples.map(x => x.cold.perf03b2Search.requests)),
        cachedFocusMs: median(samples.map(x => x.cached.perf03b2Search.firstFocusMs)),
      };
    };
    rows.push({ profile, journey, control: summarize('control'),
      candidate: summarize('candidate'), paired: observations });
  }
}
const sizes = JSON.parse(await readFile('perf03b2-payload-sizes.json', 'utf8'));
const evidence = { capturedAt: new Date().toISOString(),
  provenance: {
    sourceCommit: ids[0].sourceCommit, datasetGeneratedAt: ids[0].datasetGeneratedAt,
    datasetRowCount: ids[0].datasetRowCount, datasetWalletCount: ids[0].datasetWalletCount,
    browserVersion: ids[0].browserVersion, profiles, journeys, repetitions: 2,
    note: 'ABBA on same runner/build/SQLite; precise coverage overhead; two samples not robust causal proof, never production RUM.',
  }, sizes, rows };
await writeFile('perf03b2-ab-report.json', JSON.stringify(evidence, null, 2) + '\n');
const lines = [
  '# PERF-03B2 search split — isolated A/B evidence',
  '',
  'Runner: Chrome ' + ids[0].browserVersion + '; source ' + ids[0].sourceCommit
    + '; pinned DB ' + ids[0].datasetGeneratedAt + ' / players ' + ids[0].datasetRowCount + ' / wallets ' + ids[0].datasetWalletCount + '.',
  'One Next build, two symmetric proxies, ABBA order, same runner, two fresh-profile repetitions per variant.',
  '',
  'Candidate Shared source: ' + sizes.control.core + ' -> ' + sizes.candidate.core
    + ' bytes (delta ' + (sizes.candidate.core - sizes.control.core)
    + '); already-lazy Search runtime: ' + sizes.control.search + ' -> ' + sizes.candidate.search
    + ' bytes. No new script URLs permitted on cold routes.',
  '',
  '| Profile / route | Cold JS script ms A→B | V8 compile ms A→B | Cold requests A→B | First focus ms A→B | Cached focus ms A→B |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
];
for (const {profile, journey, control: a, candidate: b} of rows) {
  lines.push('| ' + profile + ' / ' + journey + ' | ' + rounded(a.coldScriptMs) + ' → ' + rounded(b.coldScriptMs)
    + ' | ' + rounded(a.coldCompileMs) + ' → ' + rounded(b.coldCompileMs)
    + ' | ' + rounded(a.coldRequests) + ' → ' + rounded(b.coldRequests)
    + ' | ' + rounded(a.firstFocusMs) + ' → ' + rounded(b.firstFocusMs)
    + ' | ' + rounded(a.cachedFocusMs) + ' → ' + rounded(b.cachedFocusMs) + ' |');
}
lines.push('', '## Decision gate', '',
  'The experiment is **not a product implementation**. Do not ship based on any one delta.',
  'Check paired variability, visible/transfer-byte net benefit, first-use cost, direct Evaluation loads, and manual iPhone/Safari after the final issue deployment.',
  'No live wallet session was exercised; the search count and no-new-script-URL contracts are the automated guard. Do not assert wallet coverage.',
  'If gains are within noise or first-use degrades, record no change and close PERF-03B2 with evidence.',
  '');
await writeFile('perf03b2-ab-report.md', lines.join('\n'));
console.log(lines.join('\n'));
