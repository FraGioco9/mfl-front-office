// Regression for iPhone Safari's focus/blur ordering during Evaluation result taps.
// Execute the actual canonical search-state handlers in a minimal DOM harness.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../evaluation-search-state-runtime.js", import.meta.url), "utf8");

function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, "Missing canonical Evaluation handler: " + start);
  return source.slice(from, to);
}

const handlers = [
  section("  function shouldShowTypedResults(field = input()) {", "  function syncClearButton("),
  section("  function onPointerDown(event) {", "  function onFocus(event) {"),
  section("  function onBlur(event) {", "  function onKeyUp(event) {"),
  section("  function onClick(event) {", "  function onReady() {"),
].join("\n");

assert.match(source, /document\.addEventListener\("pointercancel", onPointerCancel, true\);/);
assert.match(source, /document\.removeEventListener\("pointercancel", onPointerCancel, true\);/);

function createFixture(query = "Test player") {
  class Element {
    constructor(result = null) { this.result = result; }
    closest(selector) {
      if (selector === "#evaluationSearchResults .evaluationSearchResult") return this.result;
      return null;
    }
  }
  class HTMLButtonElement extends Element {
    constructor() { super(); this.result = this; this.disabled = false; }
  }
  class HTMLInputElement extends Element {
    constructor() { super(); this.value = query; }
  }

  const field = new HTMLInputElement();
  const result = new HTMLButtonElement();
  const child = new Element(result);
  const outside = new Element();
  const results = new Element();
  results.hidden = false;
  const document = {
    activeElement: field,
    getElementById: (id) => id === "evaluationSearchResults" ? results : null,
  };
  let recordedLabels = 0;
  const scope = {
    Element,
    HTMLElement: Element,
    HTMLButtonElement,
    HTMLInputElement,
    document,
    input: () => field,
    active: () => true,
    syncSelectedPlayerLabel: () => {},
    syncClearButton: () => {},
    storePlayerLabel: () => { recordedLabels += 1; },
    resultId: () => "42",
    resultName: () => "Test player",
    queueMicrotask,
  };
  const events = runInNewContext([
    "let resultPointerDown = false;",
    "let resultPointerTarget = null;",
    handlers,
    "({ onPointerDown, onPointerUp, onPointerCancel, onBlur, onClick, shouldShowTypedResults })",
  ].join("\n"), scope);

  function blur() {
    document.activeElement = null;
    events.onBlur({ target: field });
  }
  function clickResult() {
    assert.equal(results.hidden, false, "The result must still exist when click is dispatched.");
    events.onClick({ target: child });
    assert.equal(results.hidden, false, "Capture click must not hide the result before its bubble handler.");
    // Simulate the existing Evaluation button click handler committing once.
    assert.equal(recordedLabels, 1, "Exactly one delegated click capture must run.");
  }
  return { field, result, child, outside, results, document, events, blur, clickResult, getRecordedLabels: () => recordedLabels };
}

// Safari can send pointerup before input blur; the result must survive both.
{
  const f = createFixture();
  f.events.onPointerDown({ target: f.child });
  f.events.onPointerUp({ target: f.child });
  f.blur();
  assert.equal(f.results.hidden, false, "pointerup -> blur must keep the result for click.");
  f.clickResult();
  assert.equal(f.events.shouldShowTypedResults(), false, "Selection guard must release after click.");
}

// Other browsers can blur between pointerdown and pointerup.
{
  const f = createFixture();
  f.events.onPointerDown({ target: f.child });
  f.blur();
  f.events.onPointerUp({ target: f.child });
  assert.equal(f.results.hidden, false, "blur -> pointerup must keep the result for click.");
  f.clickResult();
}

// Tapping outside or releasing outside the original result must close the menu.
{
  const f = createFixture();
  f.events.onPointerDown({ target: f.child });
  f.document.activeElement = null;
  f.events.onPointerUp({ target: f.outside });
  assert.equal(f.results.hidden, true, "Release outside must clear touch selection.");
}
{
  const f = createFixture();
  f.events.onPointerDown({ target: f.child });
  f.document.activeElement = null;
  f.events.onPointerCancel();
  assert.equal(f.results.hidden, true, "Cancelled touch must not retain the results.");
}
{
  const f = createFixture();
  f.events.onPointerDown({ target: f.outside });
  f.blur();
  assert.equal(f.results.hidden, true, "Ordinary outside tap must dismiss typed results.");
}

// Keyboard/click selection does not need a prior pointer event.
{
  const f = createFixture();
  f.events.onClick({ target: f.child });
  assert.equal(f.getRecordedLabels(), 1, "Keyboard click must still reach the existing handler.");
}

// Empty-query recent results remain visible independently of input focus.
{
  const f = createFixture("");
  f.blur();
  assert.equal(f.results.hidden, false, "Recent player results remain available without typed query.");
}

console.log("Evaluation Safari result tap passed: both blur orders, outside release/cancel, keyboard, and recents.");
