import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = Object.freeze({
  home: { page: "homePage", navigation: "home" },
  database: { page: "progressionPage", navigation: "database" },
  player: { page: "playerPage", navigation: "player" },
  planner: { page: "plannerPage", navigation: null },
  settings: { page: "settingsPage", navigation: "settings" },
});

export async function auditAccessibility(cdp, url, baseline) {
  const route = process.env.MFL_A11Y01_ROUTE;
  const config = routes[route];
  assert.ok(config, "Unknown A11Y-01 route: " + route);
  assert.equal(baseline.status, "passed", "First load routing regression must pass before accessibility audit.");

  async function evaluate(expression) {
    const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error("A11Y-01 browser exception: " + JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  }

  // Reuse the repository's fully hydrated Chromium fixture (public dataset and
  // wallet/permission mocks). Never fetch or authenticate against real accounts.
  const state = await evaluate(`(async () => {
    const name = ${JSON.stringify(route)};
    const destinations = {
      home: ["home", null], database: ["database", { view: "attributes" }],
      player: ["player", { playerId: "1" }], settings: ["settings", null]
    };
    if (name === "settings") {
      // This fixture has no real Dapper wallet. Supply an in-memory mock
      // session only for this isolated page so the genuine Settings UI renders.
      const address = "0xa110000000000000";
      state.linkedWalletAddress = address;
      state.linkedWalletProof = { type: "session", address,
        message: "MFL Front Office Dapper Opt-In" };
      if (!hasWalletOptIn()) throw new Error("A11Y Settings mock opt-in did not activate.");
    }
    if (destinations[name]) {
      const [page, options] = destinations[name];
      if (typeof window.setPage !== "function") throw new Error("setPage is not ready");
      await window.setPage(page, true, options || undefined);
    }
    const id = ${JSON.stringify(config.page)};
    const deadline = Date.now() + 6500;
    while (Date.now() < deadline) {
      const page = document.getElementById(id);
      if (page instanceof HTMLElement && !page.hidden && !page.inert
          && getComputedStyle(page).display !== "none"
          && document.documentElement.dataset.mflRouteReady === "true") break;
      await new Promise(done => setTimeout(done, 50));
    }
    const page = document.getElementById(id);
    return { path: location.pathname, id, visible: page instanceof HTMLElement && !page.hidden
      && !page.inert && getComputedStyle(page).display !== "none", body: document.body.dataset.page };
  })()`);
  assert.equal(state?.visible, true, "A11Y-01 cannot scan a hidden or loading route: " + JSON.stringify(state));

  // Load a pinned axe distribution from node_modules into the isolated CDP
  // evaluation context; no runtime dependency or third-party script in the app.
  const source = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
  const injected = await cdp.send("Runtime.evaluate", { expression: source, returnByValue: false });
  if (injected.exceptionDetails) throw new Error("A11Y-01 axe inject failed: " + JSON.stringify(injected.exceptionDetails));
  const report = await evaluate(`(async () => {
    if (!window.axe || typeof window.axe.run !== "function") throw new Error("axe-core did not initialize");
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      iframes: false
    });
    const summarize = item => ({
      id: item.id, impact: item.impact,
      count: item.nodes.length,
      targets: item.nodes.slice(0, 6).map(node => node.target.join(" > "))
    });
    return {
      version: window.axe.version,
      violations: result.violations.map(summarize),
      incomplete: result.incomplete.map(summarize),
      passes: result.passes.length
    };
  })()`);
  assert.equal(report?.version, "4.14.0", "A11Y-01 axe version drifted.");
  const critical = report.violations.filter(item => item.impact === "critical");
  const serious = report.violations.filter(item => item.impact === "serious");
  const labelNameMismatches = report.violations.filter(item => item.id === "label-content-name-mismatch");
  console.log("A11Y-01 " + route + " WCAG report: " + JSON.stringify({
    page: state.path, axe: report.version, passes: report.passes,
    critical: critical.length, serious: serious.length, labelNameMismatches: labelNameMismatches.length,
    other: report.violations.length - critical.length - serious.length,
    incomplete: report.incomplete.length, violations: report.violations
  }));
  assert.deepEqual(critical, [], "A11Y-01 critical WCAG violations on " + route + ": " + JSON.stringify(critical));
  assert.deepEqual(labelNameMismatches, [], "A11Y-01 visible labels must remain within accessible names on " + route + ": " + JSON.stringify(labelNameMismatches));

  const keyboardState = () => evaluate(`(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return null;
    const hidden = el.closest("[inert], [hidden], [aria-hidden='true']");
    return { tag: el.tagName, id: el.id || "",
      label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 64) || "",
      disabled: el.matches(":disabled"), hidden: Boolean(hidden),
      valid: el !== document.body && el !== document.documentElement };
  })()`);
  async function key(key, { shift = false } = {}) {
    const codes = { Tab: 9, Enter: 13, " ": 32, Escape: 27 };
    const code = { Tab: "Tab", Enter: "Enter", " ": "Space", Escape: "Escape" }[key];
    await cdp.send("Input.dispatchKeyEvent", {
      // A normal keyDown with its text payload, not rawKeyDown, is required
      // for Chromium to synthesize the native Enter/Space button click.
      type: key === "Enter" || key === " " ? "keyDown" : "rawKeyDown", key, code,
      ...(key === "Enter" || key === " " ? { text: key === "Enter" ? "\r" : " ", unmodifiedText: key === "Enter" ? "\r" : " " } : {}),
      windowsVirtualKeyCode: codes[key], nativeVirtualKeyCode: codes[key],
      modifiers: shift ? 8 : 0
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key, code,
      windowsVirtualKeyCode: codes[key], nativeVirtualKeyCode: codes[key],
      modifiers: shift ? 8 : 0
    });
  }
  await evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur(); true');
  await key("Tab");
  const first = await keyboardState();
  assert.ok(first?.valid && !first.hidden && !first.disabled, "A11Y-01 Tab did not focus a visible control on " + route + ": " + JSON.stringify(first));
  await key("Tab");
  const second = await keyboardState();
  assert.ok(second?.valid && !second.hidden && !second.disabled, "A11Y-01 second Tab did not focus visible control on " + route);
  await key("Tab", { shift: true });
  const reversed = await keyboardState();
  assert.equal(JSON.stringify({tag: reversed.tag, id: reversed.id, label: reversed.label}),
    JSON.stringify({tag: first.tag, id: first.id, label: first.label}),
    "A11Y-01 Shift+Tab failed to restore the prior focus on " + route);

  // Real keyboard activation on the Planner depth picker. This checks actual
  // Enter and Space behavior, the expanded state and Escape focus restoration.
  if (route === "planner") {
    const ready = await evaluate(`(async () => {
      // The selected-club fixture may not carry a usable outfield roster.
      // Isolate keyboard semantics with deterministic players in the in-page
      // preview; never write to the real Planner or to any API.
      const preview = window.__mflPlannerFormationPreview;
      if (!preview?.setRoster || !preview?.render) return false;
      preview.setAssignments([]);
      preview.setRoster([
        { player_id: 91001, name: "A11Y CB", positions: "CB", overall: 95, retirement_years: 5 },
        { player_id: 91002, name: "A11Y GK", positions: "GK", overall: 90, retirement_years: 5 }
      ]);
      preview.render("442");
      const slot = document.querySelector('.plannerFormationSpot[data-slot-key="CB#1"] .plannerFormationSlotButton:not(:disabled)');
      if (!(slot instanceof HTMLButtonElement)) return false;
      slot.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      await new Promise(done => setTimeout(done, 120));
      slot.focus({ preventScroll: true });
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      window.__mflA11ySlotRef = slot;
      window.__mflA11yKeyTrace = [];
      for (const type of ["keydown", "keypress", "keyup", "click"]) {
        slot.addEventListener(type, event => window.__mflA11yKeyTrace.push(type + ":" + (event.key || "mouse")), {capture: true});
      }
      window.addEventListener("keydown", event => window.__mflA11yKeyTrace.push("window-keydown:" + event.key), true);
      window.addEventListener("scroll", event => window.__mflA11yKeyTrace.push("scroll:" + (event.target.id || event.target.tagName || "document")), true);
      return document.activeElement === slot;
    })()`);
    assert.equal(ready, true, "A11Y-01 Planner picker is not keyboard reachable.");
    await key("Enter");
    const enter = await evaluate(`(() => {
      const picker = document.getElementById("plannerDepthPicker");
      return { opened: picker?.hidden === false,
        expanded: document.querySelectorAll('.plannerFormationSlotButton[aria-expanded="true"]').length,
        focus: document.activeElement?.outerHTML.slice(0, 260),
        current: document.querySelector('.plannerFormationSpot[data-slot-key="CB#1"] .plannerFormationSlotButton')?.getAttribute("aria-expanded"), trace: window.__mflA11yKeyTrace || [] };
    })()`);
    assert.equal(enter.opened, true, "A11Y-01 Enter did not open Planner position menu: " + JSON.stringify(enter));
    const settled = await evaluate(`(async () => {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      await new Promise(done => setTimeout(done, 130));
      return {
        open: document.getElementById("plannerDepthPicker")?.hidden === false,
        expanded: document.querySelectorAll('.plannerFormationSlotButton[aria-expanded="true"]').length,
        focus: document.activeElement?.outerHTML.slice(0, 180),
        trace: window.__mflA11yKeyTrace || []
      };
    })()`);
    assert.equal(settled.open, true,
      "A11Y-01 picker closed before Escape after Enter: " + JSON.stringify(settled));
    await key("Escape");
    await evaluate('(async () => { await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); return true; })()');
    assert.equal(await evaluate('document.getElementById("plannerDepthPicker")?.hidden === true'), true,
      "A11Y-01 Escape did not close the Planner position menu.");
    const focusAfterEscape = await evaluate(`(() => {
      const slot = document.querySelector('.plannerFormationSpot[data-slot-key="CB#1"] .plannerFormationSlotButton');
      return { restored: document.activeElement === slot, focus: document.activeElement?.outerHTML.slice(0, 220),
        originalConnected: window.__mflA11ySlotRef?.isConnected,
        originalDisabled: window.__mflA11ySlotRef?.disabled,
        sameNode: window.__mflA11ySlotRef === slot, currentDisabled: slot?.disabled,
        trace: window.__mflA11yKeyTrace || [] };
    })()`);
    assert.equal(focusAfterEscape.restored, true,
      "A11Y-01 Escape did not restore position focus: " + JSON.stringify(focusAfterEscape));
    await key(" ");
    const space = await evaluate(`(() => ({
      opened: document.getElementById("plannerDepthPicker")?.hidden === false,
      expanded: document.querySelectorAll('.plannerFormationSlotButton[aria-expanded="true"]').length,
      trace: window.__mflA11yKeyTrace || [],
      focus: document.activeElement?.outerHTML.slice(0, 220)
    }))()`);
    assert.equal(space.opened, true,
      "A11Y-01 Space did not open Planner position menu: " + JSON.stringify(space));
    await key("Escape");
    assert.equal(await evaluate('document.getElementById("plannerDepthPicker")?.hidden === true'), true,
      "A11Y-01 Escape did not close the Space-opened menu.");
  }
  console.log("A11Y-01 keyboard Tab / Shift+Tab" + (route === "planner" ? " / Enter / Space / Escape" : "") + " passed: " + route);
  return baseline;
}
