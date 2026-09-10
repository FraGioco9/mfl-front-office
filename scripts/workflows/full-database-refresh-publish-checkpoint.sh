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

node production-site/site/build-app-core.mjs
test -s production-site/site/modules/app-core-runtime.js
bash "$GITHUB_WORKSPACE/builder/scripts/workflows/full-database-refresh-validate-database-with-published-site-adapter.sh"
bash "$GITHUB_WORKSPACE/builder/scripts/workflows/full-database-refresh-record-expected-database-summary.sh"

ACTUAL_SHA="$(git -C production-site rev-parse HEAD)"
EXPECTED_SHA="${PUBLISHED_SITE_SHA:?published site SHA is required}"
test "$ACTUAL_SHA" = "$EXPECTED_SHA"

PUBLISHED_ADAPTER_BLOB="$(git -C production-site rev-parse HEAD:site/api/_database.js)"
CURRENT_ADAPTER_BLOB="$(git -C production-site hash-object site/api/_database.js)"
test "$CURRENT_ADAPTER_BLOB" = "$PUBLISHED_ADAPTER_BLOB"

UNEXPECTED_TRACKED_CHANGES="$(
  git -C production-site diff --name-only -- . \
    ':(exclude)site/api/data-files/**' \
    ':(exclude)site/modules/app-core-runtime.js' \
    ':(exclude)site/modules/app-core-*-runtime.js'
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
  vercel deploy --prod --yes --force \
    --local-config site/vercel.production.json \
    --build-env ALLOW_VERCEL_ACTION_DEPLOY=1 \
    --token "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
)

bash "$GITHUB_WORKSPACE/builder/scripts/workflows/full-database-refresh-verify-live-production-database.sh"

COMPLETED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
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
  --argjson domains "$DOMAIN_STATUS" \
  '{checkpoint:$checkpoint,completedAt:$completedAt,runId:$runId,runAttempt:$runAttempt,publishedSiteSha:$sourceSha,domains:$domains}' \
  > "$METADATA_PATH"

{
  echo "### Database checkpoint: $CHECKPOINT_NAME"
  echo
  echo "Published at \`$COMPLETED_AT\` from run \`$GITHUB_RUN_ID\` attempt \`$GITHUB_RUN_ATTEMPT\`."
  echo
  echo '| Domain | Status |'
  echo '| --- | --- |'
  jq -r '.domains | to_entries[] | "| \(.key) | `\(.value)` |"' "$METADATA_PATH"
} >> "$GITHUB_STEP_SUMMARY"
