#!/usr/bin/env bash
set -euo pipefail
mkdir -p previous-database

PREVIOUS_RUN_ID=""
PREVIOUS_ARTIFACT_ID=""
PREVIOUS_CREATED_AT=""

while IFS=$'\t' read -r CREATED_AT ARTIFACT_ID RUN_ID; do
  [ -n "$ARTIFACT_ID" ] || continue
  [ -n "$RUN_ID" ] || continue

  rm -rf previous-database/*
  echo "Checking mfl_database artifact $ARTIFACT_ID from run $RUN_ID ($CREATED_AT)."

  if ! gh run download "$RUN_ID" --repo "$GITHUB_REPOSITORY" --name mfl_database --dir previous-database; then
    echo "Artifact $ARTIFACT_ID could not be downloaded; trying the next candidate."
    continue
  fi

  if python -m scripts.database.prepare_runtime_database previous-database/mfl_database.db --validate-only; then
    PREVIOUS_RUN_ID="$RUN_ID"
    PREVIOUS_ARTIFACT_ID="$ARTIFACT_ID"
    PREVIOUS_CREATED_AT="$CREATED_AT"
    break
  fi

  echo "Artifact $ARTIFACT_ID does not contain a valid prepared mfl_database.db; trying the next candidate."
done < <(
  gh api --paginate \
    "repos/${GITHUB_REPOSITORY}/actions/artifacts?name=mfl_database&per_page=100" \
    --jq '.artifacts[] | select(.name == "mfl_database" and .expired == false) | [.created_at, (.id | tostring), (.workflow_run.id | tostring)] | @tsv' \
    | sort -r
)

if [ -n "$PREVIOUS_RUN_ID" ]; then
  echo "Using previous database artifact $PREVIOUS_ARTIFACT_ID from run $PREVIOUS_RUN_ID ($PREVIOUS_CREATED_AT)."
else
  rm -rf previous-database/*
  echo "No valid previous database artifact found; progression emails will be skipped."
fi
