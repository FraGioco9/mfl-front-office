#!/usr/bin/env bash
set -euo pipefail
mkdir -p marketplace-database
DATABASE_RUN_ID=""
while IFS=$'\t' read -r CREATED_AT RUN_ID; do
  [ -n "$RUN_ID" ] || continue
  ARTIFACT_NAME="$(
    gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${RUN_ID}/artifacts" \
      --jq '.artifacts[] | select(.name == "mfl_database" and .expired == false) | .name' \
      | head -n 1
  )"
  if [ "$ARTIFACT_NAME" = "mfl_database" ]; then
    DATABASE_RUN_ID="$RUN_ID"
    echo "Using database artifact from run $RUN_ID ($CREATED_AT)."
    break
  fi
done < <(
  gh run list \
    --workflow full-database-refresh.yml \
    --status success \
    --limit 100 \
    --json databaseId,createdAt \
    --jq '.[] | [.createdAt, .databaseId] | @tsv'
)
[ -n "$DATABASE_RUN_ID" ] || { echo "No non-expired mfl_database artifact was found." >&2; exit 1; }
gh run download "$DATABASE_RUN_ID" --name mfl_database --dir marketplace-database
test -s marketplace-database/mfl_database.db
