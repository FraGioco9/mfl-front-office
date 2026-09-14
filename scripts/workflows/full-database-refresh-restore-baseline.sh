#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_NAME="full-database-refresh-baseline-${GITHUB_RUN_ID}"
mkdir -p previous-database

artifact_id="$(
  gh api --paginate     "repos/${GITHUB_REPOSITORY}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=100"     --jq '.artifacts | map(select(.expired == false)) | sort_by(.created_at) | reverse | .[0].id // empty'
)"

if [ -n "$artifact_id" ]; then
  rm -rf previous-database/*
  echo "Restoring immutable refresh baseline artifact ${artifact_id} for run ${GITHUB_RUN_ID}."
  gh run download "$GITHUB_RUN_ID"     --repo "$GITHUB_REPOSITORY"     --name "$ARTIFACT_NAME"     --dir previous-database
  python -m scripts.database.prepare_runtime_database     previous-database/mfl_database.db     --validate-only
  echo "created=false" >> "$GITHUB_OUTPUT"
  echo "reused=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

bash "$GITHUB_WORKSPACE/builder/scripts/workflows/full-database-refresh-restore-previous-database-for-email-comparison.sh"

if [ -s previous-database/mfl_database.db ]; then
  python -m scripts.database.prepare_runtime_database     previous-database/mfl_database.db     --validate-only
  echo "created=true" >> "$GITHUB_OUTPUT"
else
  echo "created=false" >> "$GITHUB_OUTPUT"
fi
echo "reused=false" >> "$GITHUB_OUTPUT"
