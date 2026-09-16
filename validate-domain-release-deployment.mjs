const validators = [
  "validate-release-history.mjs",
  "validate-release-version-source.mjs",
  "validate-release-runtime-ownership.mjs",
  "validate-runtime-data-identity.mjs",
  "validate-generated-styles.mjs",
  "validate-next-deployment-ownership.mjs",
  "validate-database-refresh-deployment.mjs",
  "validate-security-boundaries.mjs",
];

for (const validator of validators) {
  console.log(`[release/deployment] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[release/deployment] FAILED ${validator}`);
    throw error;
  }
}

console.log(`Release/deployment validator domain passed: ${validators.length} validators in one process.`);
