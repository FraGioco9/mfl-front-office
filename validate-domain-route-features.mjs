import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-global-search-results.mjs",
  "validate-global-search-agent-activation.mjs",
  "validate-global-search-open-lifecycle.mjs",
  "validate-global-search-keyboard.mjs",
  "validate-document-title-runtime.mjs",
  "validate-first-html-metadata.mjs",
  "validate-empty-states.mjs",
  "validate-entity-request-errors.mjs",
  "validate-home-search-recovery.mjs",
  "validate-evaluation-refresh-hydration.mjs",
  "validate-evaluation-stale-wallet-preferences-ui.mjs",
  "validate-settings-route-core.mjs",
  "validate-planner-route-core.mjs",
  "validate-planner-toolbar-actions.mjs",
  "validate-planner-saved-plan-actions.mjs",
  "validate-cross-domain-actions.mjs",
  "validate-planner-roster.mjs",
  "validate-settings-email-privacy.mjs",
  "validate-player-route-core.mjs",
  "validate-player-overall-loading-color.mjs",
  "validate-player-loading-plain-attributes.mjs",
  "validate-player-loading-unknown-position.mjs",
  "validate-render-reuse-contract.mjs",
  "validate-agent-title-loading.mjs",
  "validate-progression-retired-filter.mjs",
  "validate-watchlist-route-core.mjs",
  "validate-watchlist-progression-access.mjs",
  "validate-watchlist-selector-navigation.mjs",
];

await runDomainValidators({
  domain: "route-features",
  title: "Route-features",
  validators,
  baseUrl: import.meta.url,
});
