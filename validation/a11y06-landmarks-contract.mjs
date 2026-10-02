import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [chrome, index, styles, generated, footerValidator, sidebarValidator, nextDocument] = await Promise.all([
  read("../html-sources/chrome.html"),
  read("../index.html"),
  read("../styles-base.css"),
  read("../styles-runtime.css"),
  read("../validate-footer-route-coverage.mjs"),
  read("../validate-sidebar-lifecycle-ownership.mjs"),
  read("../pages/_document.js"),
]);
for (const [name,source] of [["canonical chrome",chrome],["generated HTML",index]]) {
  const firstBody = source.indexOf('<body data-page="home" class="pinnedSidebarVisible">');
  const skip = source.indexOf('<a class="mflSkipLink" href="#mflMainContent">Skip to main content</a>');
  const header = source.indexOf('<header class="topbar">');
  const main = source.indexOf('<main id="mflMainContent" tabindex="-1">');
  assert.ok(firstBody >= 0 && skip > firstBody && header > skip && main > header, name+" must put skip navigation before the header.");
  assert.equal((source.match(/<main\b/g)||[]).length, 1, name+" must contain exactly one main landmark.");
  assert.equal((source.match(/id="mflMainContent"/g)||[]).length, 1, name+" must expose one main target.");
  assert.equal((source.match(/<nav id="sidebar" class="sidebar" aria-label="Main navigation">/g)||[]).length, 1,
    name+" must use one named native primary nav landmark.");
  assert.ok(!source.includes('<aside id="sidebar"'), name+" must not keep the obsolete sidebar-as-aside markup.");
  assert.ok(source.includes('<nav class="pager" aria-label="Pagination"'), name+" should preserve separately named pager navigation.");
}
for (const [name,css] of [["canonical CSS",styles],["generated CSS",generated]]) {
  assert.match(css,/\.mflSkipLink \{[\s\S]*?z-index: var\(--mfl-z-toast\);[\s\S]*?transform: translateY\(calc\(-100% - 24px\)\);\s*\}/,
    name+" skip link must be offscreen until focused and above fixed navigation.");
  assert.match(css,/\.mflSkipLink:focus \{\s*transform: none;[\s\S]*?outline: var\(--mfl-focus-ring-width\) solid var\(--mfl-focus-ring-color\);/,
    name+" focus must expose visible high-contrast skip link.");
}
assert.ok(footerValidator.includes("html.indexOf('<main id=\"mflMainContent\" tabindex=\"-1\">')"),
  "Footer validation must follow the exact one canonical main region.");
assert.ok(sidebarValidator.includes('<nav id=\"sidebar\" class=\"sidebar\" aria-label=\"Main navigation\">'),
  "Sidebar navigation contract must be owned by the native named nav element.");
assert.ok(nextDocument.includes("bodyChildren: parse(body[2])"), "Next document must continue projecting canonical body children.");
console.log("A11Y-06 skip, main, primary/pagination navigation, CSS focus and Next projection contracts passed.");
