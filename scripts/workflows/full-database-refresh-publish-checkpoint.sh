#!/usr/bin/env bash
set -euo pipefail

CHECKPOINT_NAME="${1:?checkpoint name is required}"
DATABASE_SOURCE_PATH="${2:?database source path is required}"

if [ ! -s "$DATABASE_SOURCE_PATH" ]; then
  echo "Checkpoint database does not exist or is empty: $DATABASE_SOURCE_PATH" >&2
  exit 1
fi
if [ ! -d production-site/.git ]; then
  echo "Published site source is not checked out." >&2
  exit 1
fi

export DATABASE_SOURCE_PATH
bash "$GITHUB_WORKSPACE/builder/scripts/workflows/full-database-refresh-install-fresh-database-in-published-site-source.sh"

node production-site/build-app-core.mjs
test -s production-site/modules/app-core-runtime.js
bash "$GITHUB_WORKSPACE/builder/scripts/workflows/full-database-refresh-validate-database-with-published-site-adapter.sh"

ACTUAL_SHA="$(git -C production-site rev-parse HEAD)"
EXPECTED_SHA="${PUBLISHED_SITE_SHA:?published site SHA is required}"
test "$ACTUAL_SHA" = "$EXPECTED_SHA"

DEPLOYMENT_ROOT=production-site EXPECTED_SITE_SHA="$EXPECTED_SHA" \
  bash "$GITHUB_WORKSPACE/builder/scripts/workflows/record-production-identity.sh"

PUBLISHED_ADAPTER_BLOB="$(git -C production-site rev-parse HEAD:api/_database.js)"
CURRENT_ADAPTER_BLOB="$(git -C production-site hash-object api/_database.js)"
test "$CURRENT_ADAPTER_BLOB" = "$PUBLISHED_ADAPTER_BLOB"

UNEXPECTED_TRACKED_CHANGES="$(
  git -C production-site diff --name-only -- . \
    ':(exclude)api/data-files/**' \
    ':(exclude)modules/app-core-runtime.js' \
    ':(exclude)modules/app-core-*-runtime.js'
)"
if [ -n "$UNEXPECTED_TRACKED_CHANGES" ]; then
  echo "Database checkpoint changed published site source files:" >&2
  printf '%s\n' "$UNEXPECTED_TRACKED_CHANGES" >&2
  exit 1
fi

mkdir -p production-site/.vercel
printf '{"orgId":"%s","projectId":"%s"}' \
  "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}" \
  "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}" \
  > production-site/.vercel/project.json

(
  cd production-site
  if [ ! -d node_modules ]; then
    npm ci --no-audit --no-fund
  fi
  vercel pull --yes --environment=production \
    --token "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
  VERCEL_REMOTE_ROOT="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(".vercel/project.json","utf8")); process.stdout.write(String(p?.settings?.rootDirectory ?? p?.rootDirectory ?? ""));')"
  export VERCEL_REMOTE_ROOT
  node "$GITHUB_WORKSPACE/builder/scripts/workflows/normalize-vercel-project-root.mjs"
  node "$GITHUB_WORKSPACE/builder/scripts/workflows/write-deployment-commit.mjs" "$EXPECTED_SHA"
  ALLOW_VERCEL_ACTION_DEPLOY=1 vercel build --prod --yes \
    --token "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
  node "$GITHUB_WORKSPACE/builder/scripts/workflows/verify-prebuilt-deployment-commit.mjs" "$EXPECTED_SHA"
  node "$GITHUB_WORKSPACE/builder/scripts/workflows/stage-vercel-prebuilt-for-remote-root.mjs"
  # A transient network failure during the large prebuilt upload must not force
  # the entire database refresh to rebuild the same checkpoint.
  deployment_log="$(mktemp)"
  trap 'rm -f "$deployment_log"' EXIT
  for attempt in 1 2 3; do
    if vercel deploy --prebuilt --prod --yes --force \
      --token "${VERCEL_TOKEN:?VERCEL_TOKEN is required}" 2>&1 | tee "$deployment_log"; then
      break
    fi

    if [ "$attempt" -eq 3 ] || ! grep -Eq \
      'Error: fetch failed|AbortError: This operation was aborted|ECONNRESET|ETIMEDOUT|EAI_AGAIN' \
      "$deployment_log"; then
      echo "Vercel checkpoint deployment failed; no further retry." >&2
      exit 1
    fi

    echo "Transient Vercel upload failure (attempt $attempt/3); retrying the same prebuilt checkpoint." >&2
    sleep "$((attempt * 15))"
  done
)

bash "$GITHUB_WORKSPACE/builder/scripts/workflows/verify-live-production-deployment.sh"

COMPLETED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
IDENTITY_PATH="$RUNNER_TEMP/mfl-production-expected.json"
VERSION="$(jq -r '.version' "$IDENTITY_PATH")"
GENERATED_AT="$(jq -r '.database.generatedAt' "$IDENTITY_PATH")"

case "$CHECKPOINT_NAME" in
  core)
    DOMAIN_STATUS='{"wallets":"current-stage","players":"current-stage","clubs":"current-stage","playerSeasons":"previous-production-fallback","progressions":"previous-production-fallback","derivedPlayerData":"current-stage","competitions":"previous-production-fallback"}'
    ;;
  player-seasons)
    DOMAIN_STATUS='{"wallets":"current-run","players":"current-run","clubs":"current-run","playerSeasons":"current-stage","progressions":"previous-production-fallback","derivedPlayerData":"current-run","competitions":"previous-production-fallback"}'
    ;;
  player-data)
    DOMAIN_STATUS='{"wallets":"current-run","players":"current-run","clubs":"current-run","playerSeasons":"current-run","progressions":"current-stage","derivedPlayerData":"current-run","competitions":"previous-production-fallback"}'
    ;;
  final)
    DOMAIN_STATUS='{"wallets":"current-run","players":"current-run","clubs":"current-run","playerSeasons":"current-run","progressions":"current-run","derivedPlayerData":"current-run","competitions":"current-stage"}'
    ;;
  *)
    echo "Unknown checkpoint name: $CHECKPOINT_NAME" >&2
    exit 1
    ;;
esac

METADATA_PATH="$RUNNER_TEMP/full-database-refresh-checkpoint-${CHECKPOINT_NAME}.json"
jq -n \
  --arg checkpoint "$CHECKPOINT_NAME" \
  --arg completedAt "$COMPLETED_AT" \
  --arg runId "$GITHUB_RUN_ID" \
  --arg runAttempt "$GITHUB_RUN_ATTEMPT" \
  --arg sourceSha "$EXPECTED_SHA" \
  --arg version "$VERSION" \
  --arg generatedAt "$GENERATED_AT" \
  --argjson domains "$DOMAIN_STATUS" \
  '{checkpoint:$checkpoint,completedAt:$completedAt,runId:$runId,runAttempt:$runAttempt,publishedSiteSha:$sourceSha,deploymentIdentity:{siteCommit:$sourceSha,version:$version,databaseGeneratedAt:$generatedAt},domains:$domains}' \
  > "$METADATA_PATH"

{
  echo "### Database checkpoint: $CHECKPOINT_NAME"
  echo
  echo "Published at $COMPLETED_AT from run $GITHUB_RUN_ID attempt $GITHUB_RUN_ATTEMPT."
  echo
  echo '| Deployment identity | Value |'
  echo '| --- | --- |'
  echo "| Site commit | $EXPECTED_SHA |"
  echo "| Application version | $VERSION |"
  echo "| Database generated at | $GENERATED_AT |"
  echo
  echo '| Domain | Status |'
  echo '| --- | --- |'
  jq -r '.domains | to_entries[] | "| \(.key) | `\(.value)` |"' "$METADATA_PATH"
} >> "$GITHUB_STEP_SUMMARY"
