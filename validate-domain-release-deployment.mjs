import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-release-history.mjs",
  "validate-release-version-source.mjs",
  "validate-release-runtime-ownership.mjs",
  "validate-runtime-data-identity.mjs",
  "validate-generated-styles.mjs",
  "validate-next-deployment-ownership.mjs",
  "validation/cross-release-cache-regression.mjs",
  "validate-database-refresh-deployment.mjs",
  "validate-security-boundaries.mjs",
  "validate-operational-health.mjs",
];

await runDomainValidators({
  domain: "release/deployment",
  title: "Release/deployment",
  validators,
  baseUrl: import.meta.url,
});
