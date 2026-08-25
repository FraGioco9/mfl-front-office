const validators = [
  "validate-shared-api-logic.mjs",
  "validate-supabase-persistence.mjs",
  "validate-wallet-core.mjs",
  "validate-evaluation-share-preview.mjs",
  "validate-evaluation-preview-portrait.mjs",
  "validate-evaluation-preview-rarity-accent.mjs",
  "validate-evaluation-preview-shell-path.mjs",
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
