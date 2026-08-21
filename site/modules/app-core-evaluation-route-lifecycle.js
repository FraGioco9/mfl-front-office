// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

export function normalizeEvaluationRouteLifecycle(artifacts) {
  const core = String(artifacts?.core || "");
  if (!core) throw new Error("Cannot normalize Evaluation routing without shared application core.");

  let normalizedCore = replaceRequired(
    core,
    `function pageTargetFromPath(path) {
  const cleanPath = String(path || "").split("?")[0];`,
    `function pageTargetFromPath(path) {
  const requestedPath = String(path || "");
  const cleanPath = requestedPath.split("?")[0];

  if (cleanPath === "/evaluation") {
    const queryIndex = requestedPath.indexOf("?");
    const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(search);
    const playerId = String(params.get("player") || "").trim();
    const savedId = String(params.get("saved") || "").trim();
    const shareId = String(params.get("share") || "").trim();
    return {
      pageName: "evaluation",
      options: {
        path: search ? \`/evaluation?\${search}\` : "/evaluation",
        ...(playerId ? { playerId } : {}),
        ...(savedId ? { savedId } : {}),
        ...(shareId ? { shareId } : {}),
      },
    };
  }`,
    "Evaluation route preserves its complete query state",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    `  if (pageName === "evaluation") {
    if (options.plain) {
      return "/evaluation";
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? \`/evaluation?player=\${encodeURIComponent(playerId)}\` : "/evaluation";
  }`,
    `  if (pageName === "evaluation") {
    if (options.plain) {
      return "/evaluation";
    }

    const explicitPath = String(options.path || "");
    if (explicitPath === "/evaluation" || explicitPath.startsWith("/evaluation?")) {
      return explicitPath;
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? \`/evaluation?player=\${encodeURIComponent(playerId)}\` : "/evaluation";
  }`,
    "Evaluation page path keeps explicit saved and shared URLs",
  );

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
  });
}
