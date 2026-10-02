import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(root, path), "utf8");
const foundations = read("ui-foundations.css");
const table = read("styles.css");
const planner = read("planner.css");
const docs = read("docs/ui-typography-1034.md");
assert.match(foundations, /--mfl-page-title-font-size: 20px;/);
assert.match(foundations, /--mfl-page-title-font-weight: 700;/);
const rule = (css, selector) => {
  const pos = css.indexOf(selector);
  assert.ok(pos >= 0, "Missing selector " + selector);
  const open = css.indexOf("{", pos + selector.length);
  const close = css.indexOf("}", open + 1);
  assert.ok(open > pos && close > open, "Unterminated rule " + selector);
  return css.slice(open + 1, close);
};
const heading = rule(table, ".tablePageTitle {");
for (const part of ["font-size: var(--mfl-page-title-font-size);", "font-weight: var(--mfl-page-title-font-weight);", "line-height: var(--mfl-page-title-line-height);", "min-height: var(--mfl-page-title-min-height);"]) {
  assert.ok(heading.includes(part), "Shared page title missing " + part);
}
for (const selector of [".plannerRosterHeader h3{", ".plannerPitchPanel h3{", ".plannerSummaryHeading{"]) {
  const section = rule(planner, selector);
  for (const part of ["font-size:var(--mfl-section-title-font-size)", "font-weight:var(--mfl-section-title-font-weight)", "line-height:var(--mfl-section-title-line-height)"]) {
    assert.ok(section.includes(part), selector + " missing " + part);
  }
  assert.doesNotMatch(section, /font-weight:800/);
}
for (const path of ["html-sources/tables.html", "html-sources/mfl-stats.html", "html-sources/database-stats.html", "html-sources/evaluation.html", "html-sources/my-clubs.html", "html-sources/planner.html", "html-sources/settings.html"]) {
  assert.match(read(path), /<h2[^>]*class="tablePageTitle"[^>]*>/, path + " must consume shared heading class.");
}
assert.match(read("responsive-sources/tables-phone.css.inc"), /--mfl-page-title-font-size: 18px;/);
assert.match(read("responsive-sources/compact.css.inc"), /--mfl-page-title-font-size: 17px;/);
for (const marker of ["1280px", "900px", "390px", "Player hero", "final single-release visual gate"]) {
  assert.ok(docs.includes(marker), "Missing audit/release note: " + marker);
}
console.log("UI-01 canonical page-title and Planner heading typography checks passed.");