import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-club-entry-workflow.mjs",
  "validate-club-refresh-startup.mjs",
  "validate-club-sorting.mjs",
  "validate-club-route-core.mjs",
  "validate-club-cache-ownership.mjs",
  "validate-club-title-loading.mjs",
];

await runDomainValidators({
  domain: "club",
  title: "Club",
  validators,
  baseUrl: import.meta.url,
});
