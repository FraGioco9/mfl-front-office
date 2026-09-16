import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkflowSource } from "./validation/workflow-source.mjs";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = siteRoot;
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

const workflow = await readWorkflowSource(
  new URL("./.github/workflows/full-database-refresh.yml", import.meta.url),
);
const [
  resolver,
  installer,
  publisher,
  adapterValidator,
  baselineRestore,
  resumeRestore,
  resumeWriter,
  vercelRootNormalizer,
  vercelPrebuiltRootStager,
  identityRecorder,
  deploymentVerifier,
] = await Promise.all([
  readRepository("scripts/workflows/full-database-refresh-resolve-last-published-site-source.sh"),
  readRepository("scripts/workflows/full-database-refresh-install-fresh-database-in-published-site-source.sh"),
  readRepository("scripts/workflows/full-database-refresh-publish-checkpoint.sh"),
  readRepository("scripts/workflows/full-database-refresh-validate-database-with-published-site-adapter.sh"),
  readRepository("scripts/workflows/full-database-refresh-restore-baseline.sh"),
  readRepository("scripts/workflows/full-database-refresh-restore-resume-checkpoint.sh"),
  readRepository("scripts/workflows/full-database-refresh-write-resume-checkpoint.sh"),
  readRepository("scripts/workflows/normalize-vercel-project-root.mjs"),
  readRepository("scripts/workflows/stage-vercel-prebuilt-for-remote-root.mjs"),
  readRepository("scripts/workflows/record-production-identity.sh"),
  readRepository("scripts/workflows/verify-live-production-deployment.sh"),
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
  vercelRootNormalizer,
  vercelPrebuiltRootStager,
  identityRecorder,
  deploymentVerifier,
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
  'cp "$DATABASE_SOURCE_PATH" production-site/api/data-files/mfl_database.db',
  "Database-only refreshes must replace SQLite data from the selected checkpoint snapshot.",
);
excludes(
  "cp builder/api/_database.js production-site/api/_database.js",
  "Database-only refreshes must never mix the current database adapter into an older published site runtime.",
);
includes(
  'PUBLISHED_ADAPTER_BLOB="$(git -C production-site rev-parse HEAD:api/_database.js)"',
  "Database-only refreshes must pin the published database adapter before replacing data.",
);
includes(
  'CURRENT_ADAPTER_BLOB="$(git -C production-site hash-object api/_database.js)"',
  "Database-only refreshes must verify that the published database adapter stayed byte-identical.",
);
includes(
  "node production-site/build-app-core.mjs",
  "Database-only refreshes must rebuild generated application-core artifacts from the published site source before redeploying it.",
);
includes(
  'require(path.resolve("production-site/api/_database.js"))',
  "Every checkpoint database must be smoke-tested through the published site's own SQLite adapter before deployment.",
);
includes(
  'VERCEL_REMOTE_ROOT="$(node -e',
  "Database-only refreshes must capture the remote Vercel Root Directory from vercel pull output before normalization.",
);
includes(
  'const remoteRoot = String(process.env.VERCEL_REMOTE_ROOT || "").trim();',
  "Checkpoint prebuilt staging must use the captured Vercel Root Directory without calling the Vercel project API.",
);
invariant(
  publisher.indexOf('VERCEL_REMOTE_ROOT="$(node -e')
    < publisher.indexOf("normalize-vercel-project-root.mjs"),
  "Database checkpoint deployment must capture remote Root Directory before local normalization clears it.",
);
includes(
  "await cp(source, destination, { recursive: true });",
  "Database-only refreshes must mirror prebuilt output into the remote Vercel Root Directory when required.",
);
invariant(
  publisher.indexOf("vercel build --prod")
    < publisher.indexOf("stage-vercel-prebuilt-for-remote-root.mjs")
    && publisher.indexOf("stage-vercel-prebuilt-for-remote-root.mjs")
      < publisher.indexOf("vercel deploy --prebuilt --prod"),
  "Database checkpoint deployment must stage the completed prebuilt output after build and before deploy.",
);
includes(
  "vercel pull --yes --environment=production",
  "Database-only refreshes must load the production Vercel project environment before rebuilding.",
);
includes(
  'node "$GITHUB_WORKSPACE/builder/scripts/workflows/normalize-vercel-project-root.mjs"',
  "Database-only refreshes must clear stale remote Root Directory settings before rebuilding.",
);
invariant(
  publisher.indexOf("vercel pull --yes --environment=production")
    < publisher.indexOf('node "$GITHUB_WORKSPACE/builder/scripts/workflows/normalize-vercel-project-root.mjs"')
    && publisher.indexOf('node "$GITHUB_WORKSPACE/builder/scripts/workflows/normalize-vercel-project-root.mjs"')
      < publisher.indexOf("vercel build --prod"),
  "Database checkpoint deployment must normalize the Vercel project root after pull and before build.",
);
includes(
  "project.settings.rootDirectory = null",
  "Database checkpoint deployment must normalize Vercel to the repository root.",
);
includes(
  "vercel build --prod",
  "Database-only refreshes must rebuild the published Next runtime around each checkpoint database.",
);
includes(
  "vercel deploy --prebuilt --prod",
  "Database-only refreshes must deploy the exact prebuilt Next checkpoint artifact.",
);
excludes(
  "vercel.production.json",
  "Database-only refreshes must not use the retired static Vercel config projection.",
);
includes(
  "record-production-identity.sh",
  "Every checkpoint deployment must record its published site commit, application version and database generation before deployment.",
);
includes(
  'MFL_DEPLOY_COMMIT="$EXPECTED_SHA" ALLOW_VERCEL_ACTION_DEPLOY=1 vercel build',
  "Every checkpoint deployment must bind the preserved published-site commit into the rebuilt runtime.",
);
includes(
  "verify-live-production-deployment.sh",
  "Every checkpoint deployment must verify live identity and representative direct routes before the next stage can continue.",
);
includes(
  "deploymentIdentity:{siteCommit:$sourceSha,version:$version,databaseGeneratedAt:$generatedAt}",
  "Checkpoint telemetry must retain site commit, application version and database generation together.",
);
invariant(
  identityRecorder.includes('"commitVerificationRequired": commit_verification_required')
    && identityRecorder.includes('"siteCommit": site_commit')
    && identityRecorder.includes('"generatedAt": generated_at'),
  "Checkpoint identity recording must preserve a compatibility gate for the last pre-identity published runtime while retaining the full expected tuple.",
);
invariant(
  deploymentVerifier.includes('routes = ["/", "/database", "/evaluation", "/players/374097", "/clubs/1/squad"]')
    && deploymentVerifier.includes('base_url + "/api/identity"')
    && deploymentVerifier.includes("commit_required = bool(expected.get(\"commitVerificationRequired\"))"),
  "Checkpoint verification must cover runtime identity plus representative root and deep routes.",
);
excludes(
  "full-database-refresh-verify-live-production-database.sh",
  "Database checkpoint publication must not retain the superseded database-only live verifier.",
);
excludes(
  "full-database-refresh-record-expected-database-summary.sh",
  "Database checkpoint publication must not retain the superseded database-only identity recorder.",
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

console.log("Staged database checkpoints preserve the published runtime, record deployment identity, verify representative live routes, retain immutable comparison data, resume validated stages, and safely replace coherent SQLite snapshots.");
