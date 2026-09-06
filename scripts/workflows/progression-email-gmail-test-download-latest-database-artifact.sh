#!/usr/bin/env bash
set -euo pipefail

CANDIDATE="$(
  gh api --paginate \
    "repos/${GITHUB_REPOSITORY}/actions/artifacts?name=mfl_database&per_page=100" \
    --jq '.artifacts[] | select(.name == "mfl_database" and .expired == false) | [.created_at, (.workflow_run.id | tostring)] | @tsv' \
    | sort -r \
    | head -n 1
)"
if [ -z "$CANDIDATE" ]; then
  echo "No non-expired mfl_database artifact is available." >&2
  exit 1
fi

IFS=$'\t' read -r CREATED_AT RUN_ID <<< "$CANDIDATE"
echo "Using database artifact from run $RUN_ID ($CREATED_AT)."
gh run download "$RUN_ID" --repo "$GITHUB_REPOSITORY" --name mfl_database --dir .
python -m scripts.database.prepare_runtime_database mfl_database.db --validate-only
