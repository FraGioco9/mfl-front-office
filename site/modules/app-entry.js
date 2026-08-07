// @ts-check

import { CORE_RUNTIME_PARTITIONS, prepareCoreRuntimeSource } from "./core-runtime.js";
import { installApiFetchPolicy } from "./http.js";
import { loadRelease } from "./release.js";
import { loadPartitionedClassicScript, loadScriptGroup } from "./runtime-loader.js";

const EARLY_RUNTIME_SCRIPTS = Object.freeze([
  "/evaluation-static-chrome-runtime.js",
  "/mfl-stats-first-paint-runtime.js",
  "/startup-integrity-runtime.js",
]);

const LATE_RUNTIME_SCRIPTS = Object.freeze([
  "/watchlist-route-ui-runtime.js",
  "/database-stats-navigation-release-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-refinement-runtime.js",
  "/database-stats-tooltip-portal-runtime.js",
  "/release-ui-runtime.js",
  "/v1-120-10-runtime.js",
  "/database-stats-view-button-runtime.js",
  "/selection-refresh-reset-runtime.js",
  "/my-players-refresh-view-runtime.js",
  "/selection-stack-runtime.js",
  "/changelog-history-runtime.js",
]);

function showStartupError(error) {
  console.error(error);
  document.documentElement.dataset.mflReady = "error";
  const existing = document.getElementById("mflStartupError");
  if (existing) return;

  const message = document.createElement("p");
  message.id = "mflStartupError";
  message.className = "emptyState";
  message.setAttribute("role", "alert");
  message.textContent = "Could not load MFL Front Office.";
  document.querySelector("main")?.prepend(message);
}

async function start() {
  const release = await loadRelease();
  window.__mflRelease = release;
  window.__mflReleaseVersion = release.version;
  window.__mflAssetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;

  installApiFetchPolicy();
  await loadScriptGroup(EARLY_RUNTIME_SCRIPTS, release.version);
  await loadPartitionedClassicScript(
    "/modules/legacy-core.js",
    release.version,
    CORE_RUNTIME_PARTITIONS,
    prepareCoreRuntimeSource,
  );
  await loadScriptGroup(LATE_RUNTIME_SCRIPTS, release.version);

  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));
}

void start().catch(showStartupError);
