import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import { assembleFragments } from "./build-fragments.mjs";
import { normalizeIndexDocument } from "./sync-release-projections.mjs";
import { invariant } from "./validation/assertions.mjs";
import { createStyleBundle } from "./style-bundle.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const [
  runtimeStyles, index, responsive, packageSource, vercelIgnore,
  htmlBuilder, responsiveBuilder, stylesBuilder, releaseSource,
] = await Promise.all([
  read("./styles-runtime.css"),
  read("./index.html"),
  read("./responsive.css"),
  read("./package.json"),
  read("./.vercelignore"),
  read("./build-html.mjs"),
  read("./build-responsive.mjs"),
  read("./build-styles.mjs"),
  read("./release.json"),
]);

const scripts = JSON.parse(packageSource).scripts;
const steps = (command) => String(command || "").split(/\s*&&\s*/).map((step) => step.trim());

function assertBuildPipeline(scriptMap, htmlSource, responsiveSource, stylesSource) {
  // Validate the actual dependency ordering rather than an obsolete JSON text literal.
  assert.deepEqual(steps(scriptMap["build:legacy"]), [
    "npm run build:html", "npm run build:core", "npm run build:styles",
  ], "HTML must precede core/release projections, then CSS bundling; do not assemble responsive twice.");
  assert.deepEqual(steps(scriptMap.build), [
    "npm run build:legacy", "npm run build:public", "next build --webpack",
  ], "The full build must project the generated outputs before Next.");
  for (const [name, command] of [
    ["build:html", "node build-html.mjs"],
    ["build:responsive", "node build-responsive.mjs"],
    ["build:core", "node build-app-core.mjs"],
    ["build:styles", "node build-styles.mjs"],
  ]) {
    assert.equal(scriptMap[name], command, `Preserve standalone ${name} CLI ownership.`);
  }
  assert.match(htmlSource, /writeGeneratedFragmentFile\(new URL\("\.\/index\.html"/,
    "Keep the standalone HTML writer and its output path.");
  assert.match(responsiveSource, /writeGeneratedFragmentFile\(new URL\("\.\/responsive\.css"/,
    "Keep the standalone responsive writer and its output path.");
  assert.match(stylesSource, /^import "\.\/build-responsive\.mjs";$/m,
    "The styles builder must run responsive generation before bundling.");
  assert.match(stylesSource, /createStyleBundle\(read\)/,
    "The styles builder must continue flattening the CSS dependency graph.");
}

// The positive contract and negative mutations catch duplicated or reordered
// assembly, a removed standalone command, and a removed CSS builder import.
assertBuildPipeline(scripts, htmlBuilder, responsiveBuilder, stylesBuilder);
assert.throws(() => assertBuildPipeline({
  ...scripts,
  "build:legacy": "npm run build:html && npm run build:responsive && npm run build:core && npm run build:styles",
}, htmlBuilder, responsiveBuilder, stylesBuilder), /HTML must precede core/);
assert.throws(() => assertBuildPipeline({
  ...scripts,
  "build:legacy": "npm run build:core && npm run build:html && npm run build:styles",
}, htmlBuilder, responsiveBuilder, stylesBuilder), /HTML must precede core/);
assert.throws(() => assertBuildPipeline({
  ...scripts, "build:responsive": "",
}, htmlBuilder, responsiveBuilder, stylesBuilder), /Preserve standalone build:responsive/);
assert.throws(() => assertBuildPipeline(
  scripts, htmlBuilder, responsiveBuilder, stylesBuilder.replace('import "./build-responsive.mjs";', ""),
), /must run responsive generation/);

// Compare the complete generated UTF-8 bytes with canonical manifest-order
// outputs, including post-build release/first-paint and flattened CSS content.
const [htmlFragments, responsiveFragments] = await Promise.all([
  assembleFragments(new URL("./html-sources/", import.meta.url), ".html"),
  assembleFragments(new URL("./responsive-sources/", import.meta.url), ".css.inc"),
]);
const release = JSON.parse(releaseSource);
const expectedHtml = normalizeIndexDocument(htmlFragments, release.version);
const expectedStyles = await createStyleBundle((name) => read(`./${name}`));
for (const [name, actual, expected] of [
  ["index.html", index, expectedHtml],
  ["responsive.css", responsive, responsiveFragments],
  ["styles-runtime.css", runtimeStyles, expectedStyles],
]) {
  assert.equal(Buffer.compare(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8")), 0,
    `${name} generated UTF-8 bytes must match canonical inputs exactly.`);
}

invariant(!/@import\s/i.test(runtimeStyles),
  "Production styles-runtime.css must contain zero @import rules and require no nested stylesheet requests.");
invariant(
  index.includes('<link rel="stylesheet" href="/styles-runtime.css" data-mfl-responsive-layout="true">')
    && !index.includes('<link rel="stylesheet" href="/styles.css">'),
  "Production HTML must serve the bundled primary stylesheet instead of the @import source entrypoint.",
);
invariant(
  String(scripts["verify:generated"] || "").includes("styles-runtime.css table-width-runtime.js")
    && String(scripts["verify:generated"] || "").includes("index.html")
    && String(scripts["verify:generated"] || "").includes("responsive.css"),
  "The normal build and generated verification paths must own styles-runtime.css, index.html and responsive.css.",
);
invariant(
  !vercelIgnore.includes("build-styles.mjs") && !vercelIgnore.includes("style-bundle.mjs"),
  "The stylesheet compiler and recursive bundling helper must remain available to the Vercel Next build.",
);

console.log("Generated production stylesheet, build order and byte-for-byte HTML/responsive/CSS parity passed.");
