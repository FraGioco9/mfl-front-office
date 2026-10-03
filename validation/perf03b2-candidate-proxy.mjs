// PERF-03B2: opt-in isolated, same-runner two-variant source-byte proxy.
// Both sides use ONE production Next build and ONE immutable SQLite fixture.
// No canonical source, generated asset or production deployment is altered.
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from '@typescript/typescript6';

const read = (path) => readFile(resolve(path), 'utf8');
const original = (await read('modules/core-sources/shared-global-search.js')).replace(/\r\n?/g, '\n').replace(/\s*$/, '');
const universal = await read('modules/app-core-runtime.js');
const searchRuntime = await read('global-search-runtime.js');
const syntax = ts.createSourceFile('shared-global-search.js', original, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
assert.equal(syntax.parseDiagnostics.length, 0);
const moveNames = new Set([
  'playerSearchResult','clubSearchResult','bestSearchResults','agentSearchResultByWallet',
  'recentSearchRows','rememberSearchResult','rememberAgentSearchResult','navigateFromSearch',
]);
const nodes = syntax.statements.filter(n => ts.isFunctionDeclaration(n) && moveNames.has(n.name?.text));
assert.equal(nodes.length, 8, 'All eight candidate functions must exist.');
const moved = nodes.map(n => original.slice(n.getStart(syntax), n.end)).join('\n\n');
let remaining = original;
for (const n of [...nodes].reverse()) remaining = remaining.slice(0, n.getStart(syntax)) + remaining.slice(n.end);
const index = universal.indexOf(original);
assert.ok(index >= 0 && universal.indexOf(original, index + 1) < 0,
  'Generated Shared must match exactly one original canonical fragment.');
const candidateCore = universal.slice(0, index) + remaining + universal.slice(index + original.length);
const candidateSearch = searchRuntime.replace(/\s*$/, '') + '\n\n// PERF-03B2 measurement-only lazy helpers\n' + moved + '\n';
for (const symbol of ['openSearch', 'closeSearch', 'searchMatchScore', 'renderSearchResultsNow', 'renderSearchResults']) {
  assert.ok(remaining.includes('function ' + symbol + '('), symbol + ' must remain universally available.');
}
assert.ok(!candidateCore.includes('function bestSearchResults('));
assert.ok(candidateSearch.includes('function bestSearchResults('));
const payloads = {
  control: { '/modules/app-core-runtime.js': universal, '/global-search-runtime.js': searchRuntime },
  candidate: { '/modules/app-core-runtime.js': candidateCore, '/global-search-runtime.js': candidateSearch },
};
const sizes = {
  control: { core: Buffer.byteLength(universal), search: Buffer.byteLength(searchRuntime) },
  candidate: { core: Buffer.byteLength(candidateCore), search: Buffer.byteLength(candidateSearch) },
  extracted: Buffer.byteLength(moved),
};
await writeFile('perf03b2-payload-sizes.json', JSON.stringify(sizes, null, 2) + '\n');
for (const [variant, port] of [['control', 4001], ['candidate', 4002]]) {
  const server = createServer((incoming, response) => {
    const url = new URL(incoming.url || '/', 'http://127.0.0.1').pathname;
    const replacement = payloads[variant][url];
    const upstream = httpRequest({
      hostname: '127.0.0.1', port: 4000, path: incoming.url, method: incoming.method,
      headers: { ...incoming.headers, host: '127.0.0.1:4000', 'accept-encoding': 'identity' },
    }, (served) => {
      const headers = { ...served.headers };
      delete headers.connection;
      delete headers['transfer-encoding'];
      delete headers['content-encoding'];
      if (replacement !== undefined && served.statusCode === 200) {
        const bytes = Buffer.from(replacement);
        delete headers.etag;
        delete headers['last-modified'];
        headers['cache-control'] = 'no-store';
        headers['content-length'] = String(bytes.length);
        served.resume();
        response.writeHead(200, headers);
        response.end(bytes);
      } else {
        response.writeHead(served.statusCode || 502, headers);
        served.pipe(response);
      }
    });
    upstream.on('error', (error) => {
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
      response.end(String(error.message));
    });
    incoming.pipe(upstream);
  });
  await new Promise((done, fail) => server.once('error', fail).listen(port, '127.0.0.1', done));
  console.log(variant + ' proxy ready on port ' + port);
}
console.log(JSON.stringify(sizes));
