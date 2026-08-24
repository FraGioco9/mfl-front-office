const validators = [
  "validate-shared-api-logic.mjs",
  "validate-supabase-persistence.mjs",
  "validate-wallet-core.mjs",
];

for (const validator of validators) {
  console.log(`[api/persistence] ${validator}`);
  try {
    await import(new URL(`./${validator}`, import.meta.url));
  } catch (error) {
    console.error(`[api/persistence] FAILED ${validator}`);
    throw error;
  }
}

console.log(`API/persistence validator domain passed: ${validators.length} validators in one process.`);
