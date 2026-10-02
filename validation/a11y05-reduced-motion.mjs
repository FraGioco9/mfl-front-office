import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [sharedMotion, baseCss, plannerCss, modalSource] = await Promise.all([
  read("../motion.css"),
  read("../styles-base.css"),
  read("../planner.css"),
  read("../modules/core-sources/shared-modal-lifecycle.js"),
]);
assert.match(sharedMotion, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(baseCss, /A11Y-05: specialist movement not covered by shared timing variables/);
assert.match(baseCss, /\.buttonGear,\s*\.mflStatsHistogramFill \{\s*animation: none;/);
assert.match(baseCss, /\.toastMessage,\s*\.toastMessage\.visible \{\s*transform: none;\s*transition: none;/);
assert.match(baseCss, /\.selectionBar\.mflSelectionActionDismissed \{\s*--mfl-selection-exit-y: 0px;/);
assert.match(baseCss, /\.modalBackdrop > section,[\s\S]*?\.modalBackdrop\.modalClosing > section \{\s*transform: none;/);
assert.match(baseCss, /\.evaluationDiscountTooltipPortal \{\s*transition: none;/);
assert.match(plannerCss, /@media\(prefers-reduced-motion:reduce\)\{\.plannerFormationSlotButton \.plannerFormationToken\{transition:none\}\}/);
for (const normalAnimation of [
  "animation: mflStatsBarRise 220ms ease-out;",
  "animation: spin 900ms linear infinite;",
]) assert.ok(baseCss.includes(normalAnimation), "Normal motion must preserve existing presentation: " + normalAnimation);

const start = modalSource.indexOf("function showModal(modal) {");
const end = modalSource.indexOf("function setupBackdropClickClose(");
assert.ok(start >= 0 && end > start, "Canonical shared modal owner functions are available.");
const functions = modalSource.slice(start, end);
class Element {
  constructor() {
    this.hidden = true;
    this.isConnected = true;
    this.roles = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this.roles.add(name)),
      remove: (...names) => names.forEach(name => this.roles.delete(name)),
      contains: name => this.roles.has(name),
    };
  }
  contains(value) { return value === this || value === this.internal; }
  closest() { return null; }
  focus() { return true; }
}
for (const reduced of [true, false]) {
  let active, focused = 0, synced = 0, frames = [], timers = [];
  const opener = new Element();
  opener.hidden = false;
  const inside = new Element();
  inside.hidden = false;
  const modal = new Element();
  modal.internal = inside;
  active = opener;
  const document = { body: new Element(), documentElement: new Element(), get activeElement() { return active; } };
  const window = {
    matchMedia: query => {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: reduced };
    },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
  };
  const context = vm.createContext({
    HTMLElement: Element, Node: Element, document, window,
    modalReturnFocus: new WeakMap(),
    bindModalFocusTrap() {},
    syncModalBackgroundAccessibility() { synced += 1; },
    focusModalFallback() { active = inside; focused += 1; return true; },
  });
  vm.runInContext(functions, context);
  vm.runInContext("showModal", context).call(null, modal);
  assert.equal(modal.hidden, false);
  if (reduced) {
    assert.equal(frames.length, 0, "Reduced modal entrance must not schedule extra painted animation frames.");
    assert.equal(modal.classList.contains("modalOpen"), true);
    assert.equal(focused, 1);
  } else {
    assert.equal(frames.length, 1, "Standard modal entrance remains frame-paced.");
    frames.shift()();
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(modal.classList.contains("modalOpen"), true);
    assert.equal(focused, 1);
  }
  vm.runInContext("hideModal", context).call(null, modal, () => { synced += 100; });
  if (reduced) {
    assert.equal(modal.hidden, true, "Reduced modal exit must immediately hide the dialog.");
    assert.equal(timers.length, 0, "Reduced modal exit must not wait 180ms.");
    assert.equal(synced >= 102, true, "Reduced modal closing must release background and invoke callback.");
  } else {
    assert.equal(modal.hidden, false, "Normal motion must preserve the visible closing frame.");
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 180);
    timers[0].callback();
    assert.equal(modal.hidden, true);
    assert.equal(synced >= 102, true);
  }
}
console.log("A11Y-05 canonical motion overrides and reduced/normal modal entrance, exit and focus contracts passed.");
