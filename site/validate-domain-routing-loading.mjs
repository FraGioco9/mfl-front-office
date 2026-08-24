const validators = [
  "validate-loading-ownership.mjs",
  "validate-home-summary-first-paint.mjs",
  "validate-route-runtime.mjs",
  "validate-bootstrap-ownership.mjs",
  "validate-prebuilt-core-loading.mjs",
  "validate-route-core-startup-routing.mjs",
  "validate-route-page-normalization.mjs",
  "validate-static-route-ui.mjs",
  "validate-view-button-refresh-handoff.mjs",
  "validate-generated-view-transition.mjs",
  "validate-page-route-gate-transition.mjs",
  "validate-table-loading-state.mjs",
  "validate-table-background-loading-stability.mjs",
  "validate-app-core-startup-handshake.mjs",
];

for (const validator of validators) {
  console.log(`[routing/loading] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[routing/loading] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Routing/loading validator domain passed: ${validators.length} validators in one process.`);
