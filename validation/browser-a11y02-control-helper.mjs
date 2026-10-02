import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function auditControlSemantics(cdp, url, baseline) {
  assert.equal(baseline?.status, "passed", "A11Y-02 requires the canonical routing regression to pass first.");
  const route = process.env.MFL_A11Y02_ROUTE || "";

  const evaluate = async (expression) => {
    const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response?.exceptionDetails) throw new Error("A11Y-02 browser exception: " + JSON.stringify(response.exceptionDetails));
    return response?.result?.value;
  };

  const axeSource = await readFile(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
  const injected = await cdp.send("Runtime.evaluate", { expression: axeSource, returnByValue: false });
  if (injected?.exceptionDetails) throw new Error("A11Y-02 axe inject failed: " + JSON.stringify(injected.exceptionDetails));

  const axeReport = await evaluate(`(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "rule", values: [
        "aria-command-name", "aria-prohibited-attr", "button-name", "link-name", "nested-interactive"
      ] },
      iframes: false
    });
    return result.violations.map(item => ({
      id: item.id, impact: item.impact, count: item.nodes.length,
      targets: item.nodes.slice(0, 8).map(node => node.target.join(" > "))
    }));
  })()`);
  assert.deepEqual(axeReport, [], "A11Y-02 control semantic violations on " + route + ": " + JSON.stringify(axeReport));

  const state = await evaluate(`(() => {
    const visible = element => element instanceof HTMLElement
      && !element.hidden
      && !element.closest("[hidden],[inert],[aria-hidden='true']")
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const label = element => {
      const aria = String(element.getAttribute("aria-label") || "").trim();
      if (aria) return aria;
      const ids = String(element.getAttribute("aria-labelledby") || "").trim().split(/\\s+/).filter(Boolean);
      if (ids.length) {
        const text = ids.map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
        if (text) return text;
      }
      return String(element.textContent || "").trim();
    };
    const allNamedStatusIcons = Array.from(document.querySelectorAll(
      ".retirementMarker[aria-label], .newMintMarker[aria-label]"
    )).every(element => element.getAttribute("role") === "img");

    const result = {
      route: ${JSON.stringify(route)},
      allNamedStatusIcons,
      unnamedVisibleButtons: Array.from(document.querySelectorAll("button"))
        .filter(visible)
        .filter(button => !label(button))
        .map(button => "#" + button.id + "." + button.className),
    };

    if (${JSON.stringify(route)} === "database") {
      const action = document.querySelector(".playerTableActionsButton");
      const select = document.getElementById("selectVisiblePlayersInput");
      result.database = {
        prev: document.getElementById("prevButton")?.getAttribute("aria-label"),
        next: document.getElementById("nextButton")?.getAttribute("aria-label"),
        actionName: action?.getAttribute("aria-label") || "",
        actionExpanded: action?.getAttribute("aria-expanded"),
        selectName: select?.getAttribute("aria-label") || "",
      };
    }
    if (${JSON.stringify(route)} === "player") {
      const more = document.getElementById("playerHeroActionMenuButton");
      result.player = {
        moreName: more?.getAttribute("aria-label") || "",
        expanded: more?.getAttribute("aria-expanded"),
      };
    }
    if (${JSON.stringify(route)} === "planner") {
      const share = document.getElementById("plannerSharePlanButton");
      const pitch = document.querySelector(".plannerPitch");
      const revoke = document.querySelector("#plannerPlanRevokeModal [role='dialog']");
      const remove = document.querySelector("#plannerPlanDeleteModal [role='dialog']");
      result.planner = {
        pitchRole: pitch?.getAttribute("role"),
        pitchName: pitch?.getAttribute("aria-label"),
        shareText: String(share?.textContent || "").trim(),
        shareName: share?.getAttribute("aria-label") || "",
        undoName: document.getElementById("plannerUndoButton")?.getAttribute("aria-label") || "",
        redoName: document.getElementById("plannerRedoButton")?.getAttribute("aria-label") || "",
        revokeDialogLabelledBy: revoke?.getAttribute("aria-labelledby") || "",
        revokeConfirm: String(document.getElementById("plannerPlanRevokeConfirmButton")?.textContent || "").trim(),
        revokeClose: document.getElementById("plannerPlanRevokeModalCloseButton")?.getAttribute("aria-label") || "",
        deleteDialogLabelledBy: remove?.getAttribute("aria-labelledby") || "",
        deleteConfirm: String(document.getElementById("plannerPlanDeleteConfirmButton")?.textContent || "").trim(),
      };
    }
    if (${JSON.stringify(route)} === "watchlist") {
      const dialog = document.querySelector("#deleteWatchlistModal [role='dialog']");
      result.watchlist = {
        labelledBy: dialog?.getAttribute("aria-labelledby") || "",
        describedBy: dialog?.getAttribute("aria-describedby") || "",
        confirm: String(document.getElementById("confirmDeleteWatchlistButton")?.textContent || "").trim(),
        cancel: String(document.getElementById("cancelDeleteWatchlistButton")?.textContent || "").trim(),
        close: document.getElementById("closeDeleteWatchlistButton")?.getAttribute("aria-label") || "",
      };
    }
    return result;
  })()`);

  assert.equal(state?.allNamedStatusIcons, true, "A11Y-02 named status icons must expose role=img: " + JSON.stringify(state));
  assert.deepEqual(state?.unnamedVisibleButtons, [], "A11Y-02 visible buttons without accessible text/name: " + JSON.stringify(state?.unnamedVisibleButtons));

  if (route === "database") {
    assert.equal(state.database?.prev, "Previous page");
    assert.equal(state.database?.next, "Next page");
    assert.match(state.database?.actionName || "", /^Actions for player /);
    assert.equal(state.database?.actionExpanded, "false");
    assert.equal(state.database?.selectName, "Select visible players");
  }
  if (route === "player") {
    assert.equal(state.player?.moreName, "More player actions");
    assert.equal(state.player?.expanded, "false");
  }
  if (route === "planner") {
    assert.equal(state.planner?.pitchRole, "group");
    assert.equal(state.planner?.pitchName, "Squad depth pitch");
    assert.ok(["Share", "Revoke"].includes(state.planner?.shareText), "A11Y-02 Planner share action has an unexpected visible state.");
    assert.equal(state.planner?.shareName, state.planner?.shareText === "Revoke" ? "Revoke share" : "Share plan");
    assert.equal(state.planner?.undoName, "Undo Planner change");
    assert.equal(state.planner?.redoName, "Redo Planner change");
    assert.equal(state.planner?.revokeDialogLabelledBy, "plannerPlanRevokeModalTitle");
    assert.equal(state.planner?.revokeConfirm, "Revoke");
    assert.equal(state.planner?.revokeClose, "Close revoke share dialog");
    assert.equal(state.planner?.deleteDialogLabelledBy, "plannerPlanDeleteModalTitle");
    assert.equal(state.planner?.deleteConfirm, "Delete");
  }
  if (route === "watchlist") {
    assert.equal(state.watchlist?.labelledBy, "deleteWatchlistModalTitle");
    assert.equal(state.watchlist?.describedBy, "deleteWatchlistModalDescription");
    assert.equal(state.watchlist?.confirm, "Delete");
    assert.equal(state.watchlist?.cancel, "Cancel");
    assert.equal(state.watchlist?.close, "Close delete watchlist");
  }

  console.log("A11Y-02 control semantics passed: " + route + " " + new URL(url).pathname);
  return baseline;
}
