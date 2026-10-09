import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-loading-ownership.mjs",
  "validate-data-shaped-loading-foundation.mjs",
  "validate-home-summary-first-paint.mjs",
  "validate-player-hero-club-branding.mjs",
  "validate-route-runtime.mjs",
  "validate-bootstrap-ownership.mjs",
  "validate-prebuilt-core-loading.mjs",
  "validate-route-core-startup-routing.mjs",
  "validate-route-page-normalization.mjs",
  "validate-route-shell-ownership.mjs",
  "validate-static-route-ui.mjs",
  "validate-wallet-opt-in-transition.mjs",
  "validate-protected-opted-out-routes.mjs",
  "validate-page-scroll-reset.mjs",
  "validate-view-button-refresh-handoff.mjs",
  "validate-generated-view-transition.mjs",
  "validate-page-route-gate-transition.mjs",
  "validate-table-loading-state.mjs",
  "validate-filter-loading-blank-rows.mjs",
  "validate-table-background-loading-stability.mjs",
  "validate-app-core-startup-handshake.mjs",
  "validate-data-client-foundation.mjs",
  "validate-client-performance-timing.mjs",
  "validate-performance-capture.mjs",
];

await runDomainValidators({
  domain: "routing/loading",
  title: "Routing/loading",
  validators,
  baseUrl: import.meta.url,
});
