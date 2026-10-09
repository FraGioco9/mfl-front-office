import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-eval-ownership.mjs",
  "validate-evaluation-search-lifecycle.mjs",
  "validation/evaluation-safari-result-tap.mjs",
  "validate-evaluation-search-fast-select.mjs",
  "validate-evaluation-search-clear-selection.mjs",
  "validate-evaluation-search-stacking.mjs",
  "validate-evaluation-load-cache.mjs",
  "validate-evaluation-route-ownership.mjs",
  "validate-evaluation-refresh-hydration.mjs",
  "validate-evaluation-overall-hover.mjs",
  "validate-evaluation-mfl-usd-edit-cancel.mjs",
  "validate-evaluation-mfl-usd-loading-race.mjs",
  "validate-evaluation-discount-derived-loading.mjs",
  "validate-evaluation-snapshot-edit-route.mjs",
  "validate-evaluation-saved-share-icon.mjs",
  "validate-progression-email-portrait.mjs",
];

await runDomainValidators({
  domain: "evaluation",
  title: "Evaluation",
  validators,
  baseUrl: import.meta.url,
});
