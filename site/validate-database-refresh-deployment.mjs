import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkflowSource } from "./validation/workflow-source.mjs";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

const workflow = await readWorkflowSource(
  new URL("../.github/workflows/full-database-refresh.yml", import.meta.url),
);
const [resolver, installer, publisher, adapterValidator, baselineRestore, resumeRestore, resumeWriter] = await Promise.all([
  readRepository("scripts/workflows/full-database-refresh-resolve-last-published-site-source.sh"),
  readRepository("scripts/workflows/full-database-refresh-install-fresh-database-in-published-site-source.sh"),
  readRepository("scripts/workflows/full-database-refresh-publish-checkpoint.sh"),
  readRepository("scripts/workflows/full-database-refresh-validate-database-with-published-site-adapter.sh"),
  readRepository("scripts/workflows/full-database-refresh-restore-baseline.sh"),
  readRepository("scripts/workflows/full-database-refresh-restore-resume-checkpoint.sh"),
  readRepository("scripts/workflows/full-database-refresh-write-resume-checkpoint.sh"),
]);
const deploymentSource = [
  workflow,
  resolver,
  installer,
  publisher,
  adapterValidator,
  baselineRestore,
  resumeRestore,
  resumeWriter,
].join("\n");

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (value, message) => invariant(deploymentSource.includes(value), message);
const excludes = (value, message) => invariant(!deploymentSource.includes(value), message);

includes(
  "vercel-site-update.yml",
  "Database-only refreshes must resolve the last explicitly published site source.",
);
includes(
  'DATABASE_SOURCE_PATH="${DATABASE_SOURCE_PATH:-builder/mfl_database.db}"',
  "Database-only refreshes must support an explicit immutable checkpoint database source.",
);
includes(
  'cp "$DATABASE_SOURCE_PATH" production-site/site/api/data-files/mfl_database.db',
  "Database-only refreshes must replace SQLite data from the selected checkpoint snapshot.",
);
excludes(
  "cp builder/site/api/_database.js production-site/site/api/_database.js",
  "Database-only refreshes must never mix the current database adapter into an older published site runtime.",
);
includes(
  'PUBLISHED_ADAPTER_BLOB="$(git -C production-site rev-parse HEAD:site/api/_database.js)"',
  "Database-only refreshes must pin the published database adapter before replacing data.",
);
includes(
  'CURRENT_ADAPTER_BLOB="$(git -C production-site hash-object site/api/_database.js)"',
  "Database-only refreshes must verify that the published database adapter stayed byte-identical.",
);
includes(
  "node production-site/site/build-app-core.mjs",
  "Database-only refreshes must rebuild generated application-core artifacts from the published site source before redeploying it.",
);
includes(
  'require(path.resolve("production-site/site/api/_database.js"))',
  "Every checkpoint database must be smoke-tested through the published site's own SQLite adapter before deployment.",
);
includes(
  "--local-config site/vercel.production.json",
  "Database-only refreshes must use the same production Vercel configuration as explicit site releases.",
);
includes(
  "full-database-refresh-verify-live-production-database.sh",
  "Every checkpoint deployment must verify the live production database before the next stage can continue.",
);
excludes(
  "fresh SQLite data/runtime adapter",
  "Database-only deployment logs must not claim that the API runtime adapter is being updated.",
);

const materializeFinalIndex = workflow.indexOf("- name: Materialize final checkpoint");
const uploadFinalIndex = workflow.indexOf("- name: Upload final database");
const publishFinalIndex = workflow.indexOf("- name: Publish final checkpoint");
invariant(
  materializeFinalIndex >= 0
    && uploadFinalIndex > materializeFinalIndex
    && publishFinalIndex > uploadFinalIndex,
  "The completed final database must be preserved before production publication can fail.",
);
invariant(
  workflow.includes("name: mfl_database\n          path: builder/checkpoints/final/mfl_database.db\n          overwrite: true\n          if-no-files-found: error"),
  "Final database preservation must replace the canonical database artifact and fail closed if the checkpoint is missing.",
);
invariant(
  baselineRestore.includes('ARTIFACT_NAME="full-database-refresh-baseline-${GITHUB_RUN_ID}"')
    && workflow.includes("name: full-database-refresh-baseline-${{ github.run_id }}"),
  "Each refresh run must preserve one immutable previous-production baseline independently from resumable checkpoints.",
);
invariant(
  resumeRestore.includes('ARTIFACT_NAME="full-database-refresh-resume-${GITHUB_RUN_ID}"')
    && resumeRestore.includes('if [ "$run_id" != "$GITHUB_RUN_ID" ]; then')
    && resumeRestore.includes('python -m scripts.database.prepare_runtime_database "$DATABASE_PATH" --validate-only'),
  "A rerun may resume only from a validated checkpoint created by the same workflow run.",
);
invariant(
  workflow.includes("steps.resume.outputs.core_done != 'true'")
    && workflow.includes("steps.resume.outputs.player_seasons_done != 'true'")
    && workflow.includes("steps.resume.outputs.player_data_done != 'true'")
    && workflow.includes("steps.resume.outputs.final_ready != 'true'"),
  "Completed refresh stages must be skipped when the same run restores a validated resume checkpoint.",
);
invariant(
  resumeWriter.includes("core|player_seasons|player_data|final")
    && workflow.indexOf("- name: Send progression emails")
      < workflow.indexOf("- name: Prepare player-data resume checkpoint")
    && workflow.indexOf("- name: Save final resume checkpoint")
      < workflow.indexOf("- name: Publish final checkpoint"),
  "Resume checkpoints must advance only after stage side effects are safe to skip, while the final validated snapshot may resume directly at publication.",
);

console.log("Staged database checkpoints preserve the published site runtime, retain immutable comparison data, resume same-run validated stages, and safely replace coherent SQLite snapshots.");
