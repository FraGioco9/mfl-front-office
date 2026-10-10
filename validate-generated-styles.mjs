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
  fragmentWriter, stylesBuilder, releaseSource,
] = await Promise.all([
  read("./styles-runtime.css"),
  read("./index.html"),
  read("./responsive.css"),
  read("./package.json"),
  read("./.vercelignore"),
  read("./build-fragments.mjs"),
  read("./build-styles.mjs"),
  read("./release.json"),
]);

const scripts = JSON.parse(packageSource).scripts;
const steps = (command) => String(command || "").split(/\s*&&\s*/).map((step) => step.trim());

function assertBuildPipeline(scriptMap, fragmentSource, stylesSource) {
  assert.deepEqual(steps(scriptMap["build:legacy"]), [
    "npm run build:html", "npm run build:core", "npm run build:styles",
  ], "HTML must precede core/release projections, then CSS bundling; do not assemble responsive twice.");
  assert.deepEqual(steps(scriptMap.build), [
    "npm run build:legacy", "npm run build:public", "next build --webpack",
  ], "The full build must project generated outputs before Next.");
  for (const [name, command] of [
    ["build:html", "node build-fragments.mjs html"],
    ["build:responsive", "node build-fragments.mjs responsive"],
    ["build:core", "node build-app-core.mjs"],
    ["build:styles", "node build-styles.mjs"],
  ]) {
    assert.equal(scriptMap[name], command, `Preserve standalone ${name} CLI ownership.`);
  }
  assert.ok(fragmentSource.includes("export async function writeHtml()")
    && fragmentSource.includes('new URL("./index.html", import.meta.url)')
    && fragmentSource.includes('new URL("./html-sources/", import.meta.url)')
    && fragmentSource.includes('".html"'), "Keep standalone HTML writer and output path.");
  assert.ok(fragmentSource.includes("export async function writeResponsive()")
    && fragmentSource.includes('new URL("./responsive.css", import.meta.url)')
    && fragmentSource.includes('new URL("./responsive-sources/", import.meta.url)')
    && fragmentSource.includes('".css.inc"'), "Keep standalone responsive writer and output path.");
  assert.ok(fragmentSource.includes('if (invokedPath === import.meta.url)')
    && fragmentSource.includes('pathToFileURL(resolve(process.argv[1])).href')
    && fragmentSource.includes('else throw new Error("Usage: node build-fragments.mjs <html|responsive>")'),
  "The fragment CLI must reject invalid modes without side effects on ESM imports.");
  assert.ok(stylesSource.includes('import { writeResponsive } from "./build-fragments.mjs";')
    && stylesSource.includes("await writeResponsive();")
    && stylesSource.indexOf("await writeResponsive();") < stylesSource.indexOf("createStyleBundle(read)"),
    "The styles builder must await responsive generation before bundling.");
}

// Keep both positive and negative contract coverage: order, standalone commands,
// CSS refresh, source ownership, import guard and unknown CLI mode.
assertBuildPipeline(scripts, fragmentWriter, stylesBuilder);
assert.throws(() => assertBuildPipeline({
  ...scripts,
  "build:legacy": "npm run build:html && npm run build:responsive && npm run build:core && npm run build:styles",
}, fragmentWriter, stylesBuilder), /HTML must precede core/);
assert.throws(() => assertBuildPipeline({
  ...scripts,
  "build:legacy": "npm run build:core && npm run build:html && npm run build:styles",
}, fragmentWriter, stylesBuilder), /HTML must precede core/);
assert.throws(() => assertBuildPipeline({
  ...scripts, "build:responsive": "",
}, fragmentWriter, stylesBuilder), /Preserve standalone build:responsive/);
assert.throws(() => assertBuildPipeline(
  scripts, fragmentWriter, stylesBuilder.replace("await writeResponsive();", ""),
), /must await responsive generation/);
assert.throws(() => assertBuildPipeline(
  scripts, fragmentWriter.replace("export async function writeResponsive()", "async function writeResponsive()"), stylesBuilder,
), /Keep standalone responsive writer/);
assert.throws(() => assertBuildPipeline(
  scripts, fragmentWriter.replace('if (invokedPath === import.meta.url)', 'if (true)'), stylesBuilder,
), /without side effects on ESM imports/);
assert.throws(() => assertBuildPipeline(
  scripts, fragmentWriter.replace('else throw new Error("Usage: node build-fragments.mjs <html|responsive>")', 'else return;'), stylesBuilder,
), /reject invalid modes/);

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
