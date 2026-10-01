import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { cspLegacyScriptHashes, inlineLegacyScripts, scriptHash, scriptHashesFromHtml } from "./csp-legacy-script-hashes.mjs";
import { cspReportOnly, cspScriptSources, securityHeaders, createNextHeaders } from "./next.config.mjs";

const require = createRequire(import.meta.url);
const parse = require("html-react-parser");
const source = await readFile(new URL("./index.html", import.meta.url), "utf8");
const scripts = inlineLegacyScripts(source);

assert.equal(scripts.length, 12, "Every parser-timed inline script must be inventoried.");
assert.equal(cspLegacyScriptHashes.length, scripts.length);
assert.ok(cspLegacyScriptHashes.every(value => /^'sha256-[A-Za-z0-9+/]{43}='$/.test(value)));
assert.deepEqual(cspLegacyScriptHashes, scriptHashesFromHtml(source));
assert.equal(new Set(cspLegacyScriptHashes).size, scripts.length);
assert.deepEqual(cspScriptSources.slice(0, 2), ["'self'", "https://esm.sh"]);
assert.deepEqual(cspScriptSources.slice(2), cspLegacyScriptHashes);

for (const body of scripts) {
  const sha = createHash("sha256").update(body, "utf8").digest("base64");
  assert.ok(cspReportOnly.includes(`'sha256-${sha}'`));
  assert.equal(scriptHash(body), `'sha256-${sha}'`);
  const rendered = renderToStaticMarkup(parse(`<script>${body}</script>`));
  const renderedScripts = inlineLegacyScripts(rendered);
  assert.equal(renderedScripts.length, 1, "HTML parser + React must preserve executable script tags.");
  assert.equal(renderedScripts[0], body, "React must serialize inline script bytes exactly as hashed.");
}
assert.notEqual(scriptHash("console.log('a');"), scriptHash("console.log('b');"));
assert.deepEqual(inlineLegacyScripts("<script src='/a.js'></script><script>1+1</script><script>1+1</script>"), ["1+1", "1+1"]);
assert.deepEqual(scriptHashesFromHtml("<script>1+1</script><script>1+1</script>"), [scriptHash("1+1")]);

// Verify both directives protect inline scripts through a narrow hash allowlist;
// do not broaden to unsafe-inline/eval while preparing nonces for Next.
for (const directive of ["script-src", "script-src-elem"]) {
  const setting = cspReportOnly.split("; ").find(x => x.startsWith(`${directive} `));
  assert.ok(setting);
  assert.equal(setting, `${directive} ${cspScriptSources.join(" ")}`);
  assert.ok(!setting.includes("'unsafe-inline'"));
  assert.ok(!setting.includes("'unsafe-eval'"));
}
const enforced = securityHeaders.find(x => x.key === "Content-Security-Policy")?.value;
assert.equal(enforced, "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
for (const production of [true, false]) {
  const global = createNextHeaders({ production }).find(x => x.source === "/:path*");
  const values = new Map(global.headers.map(x => [x.key, x.value]));
  assert.equal(values.get("Content-Security-Policy"), enforced, "Hash migration must never add enforcement.");
  assert.equal(values.has("Content-Security-Policy-Report-Only"), production);
}

console.log("CSP legacy hash validation passed: 12 parser-timed scripts, exact React serialization, SHA-256 integrity, no enforcement changes.");
