import { runDomainValidators } from "./validation/domain-runner.mjs";

const validators = [
  "validate-fragment-ownership.mjs",
  "validate-text-reader.mjs",
  "validate-ci-quality-scope.mjs",
  "validate.mjs",
  "validate-app-config.mjs",
  "validate-core-source-ownership.mjs",
  "validate-shared-core-route-ownership.mjs",
  "validate-asset-cache-policy.mjs",
  "validate-cache-policy.mjs",
  "validate-prebuilt-cache-model.mjs",
  "validate-tail-pagination.mjs",
  "validate-production-core-sources.mjs",
  "validate-generated-core-bindings.mjs",
];

await runDomainValidators({
  domain: "build/generated",
  title: "Build/generated",
  validators,
  baseUrl: import.meta.url,
});
