import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-database-stats-lazy-runtime.mjs",
  "validate-stats-animation-owner.mjs",
  "validate-stats-navigation-lifecycle.mjs",
  "validate-mfl-stats-first-paint.mjs",
  "validate-mfl-stats-data-scope.mjs",
];

await runDomainValidators({
  domain: "stats",
  title: "Stats",
  validators,
  baseUrl: import.meta.url,
});
