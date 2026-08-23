// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const SHOW_MODAL_SINGLE_FRAME = `function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    modal.classList.add("modalOpen");
  });
}`;

const SHOW_MODAL_PAINT_BOUNDARY = `function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing", "modalOpen");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      modal.classList.add("modalOpen");
    });
  });
}`;

/**
 * Guarantee one painted closed-state frame before a modal enters. A single
 * requestAnimationFrame can still coalesce `hidden = false` and `modalOpen`
 * during a first lazy-loaded open, leaving no rendered opacity/transform state
 * for CSS to transition from. The second frame makes first and cached opens use
 * the same canonical entrance path without changing the transition styling.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeModalEntranceLifecycle(artifacts) {
  const core = String(artifacts?.core || "");
  if (!core) throw new Error("Cannot normalize modal entrance lifecycle without shared core.");

  return Object.freeze({
    ...artifacts,
    core: replaceRequired(
      core,
      SHOW_MODAL_SINGLE_FRAME,
      SHOW_MODAL_PAINT_BOUNDARY,
      "modal entrance waits for a painted closed-state frame",
    ),
  });
}
