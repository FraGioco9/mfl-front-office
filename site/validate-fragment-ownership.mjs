import assert from "node:assert/strict";
import { assembleFragments } from "./build-fragments.mjs";
import { normalizeIndexDocument } from "./sync-release-projections.mjs";
import { readValidationText as read } from "./validation-text.mjs";

const html = await assembleFragments(new URL("./html-sources/", import.meta.url), ".html");
const responsive = await assembleFragments(new URL("./responsive-sources/", import.meta.url), ".css.inc");
const release = JSON.parse(await read("./release.json"));
assert.equal(await read("./index.html"), normalizeIndexDocument(html, release.version), "index.html must match its canonical fragments and inline projections; edit html-sources.");
assert.equal(await read("./responsive.css"), responsive, "responsive.css must match its ordered canonical fragments; edit responsive-sources.");
assert.equal(await assembleFragments(new URL("./html-sources/", import.meta.url), ".html"), html, "HTML generation must be deterministic.");
assert.equal(await assembleFragments(new URL("./responsive-sources/", import.meta.url), ".css.inc"), responsive, "Responsive generation must be deterministic.");
console.log("Canonical HTML and responsive fragment ownership, completeness, equivalence, and determinism passed.");
