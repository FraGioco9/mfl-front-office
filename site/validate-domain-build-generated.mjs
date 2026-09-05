const validators = [
  "validate-text-reader.mjs",
  "validate-ci-quality-scope.mjs",
  "validate.mjs",
  "validate-app-config.mjs",
  "validate-core-source-ownership.mjs",
  "validate-shared-core-route-ownership.mjs",
  "validate-asset-cache-policy.mjs",
  "validate-production-core-sources.mjs",
  "validate-generated-core-bindings.mjs",
];

for (const validator of validators) {
  console.log(`[build/generated] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[build/generated] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Build/generated validator domain passed: ${validators.length} validators in one process.`);
