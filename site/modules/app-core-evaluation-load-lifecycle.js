// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const EVALUATION_LOAD_FACADE = `let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("evaluation");
  }
  if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
    throw new Error("Evaluation route core is not loaded.");
  }
  return __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
}`;

const EVALUATION_LOAD_FACADE_WITH_BUSY = `let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  const busyToken = window.__mflInteractionBusy?.begin?.("evaluation-load") || "";
  try {
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
      await window.__mflEnsureRouteCore("evaluation");
    }
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
      throw new Error("Evaluation route core is not loaded.");
    }
    return await __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
  } finally {
    if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
  }
}`;

/**
 * Enter the shared Uniform Loading workflow synchronously at the Load click,
 * before the lazy Evaluation route core or saved-evaluation request can begin.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeEvaluationLoadLifecycle(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Evaluation Load lifecycle without shared core.");

  const core = replaceRequired(
    source,
    EVALUATION_LOAD_FACADE,
    EVALUATION_LOAD_FACADE_WITH_BUSY,
    "Evaluation Load enters Uniform Loading before lazy route-core readiness",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
