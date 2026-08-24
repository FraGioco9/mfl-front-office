import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const validationTextPreload = pathToFileURL(resolve(siteRoot, "validate-text-read-preload.mjs")).href;

const validators = [
  "validate-domain-build-generated.mjs",
  "validate-domain-route-features.mjs",
  "validate-domain-release-deployment.mjs",
  "validate-domain-api-persistence.mjs",
  "validate-domain-shared-ui.mjs",
  "validate-domain-routing-loading.mjs",
  "validate-domain-evaluation.mjs",
  "validate-domain-stats.mjs",
  "validate-domain-club.mjs",
  "validate-domain-table.mjs",
];

for (const validator of validators) {
  const result = spawnSync(
    process.execPath,
    ["--import", validationTextPreload, resolve(siteRoot, validator)],
    {
      cwd: siteRoot,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
