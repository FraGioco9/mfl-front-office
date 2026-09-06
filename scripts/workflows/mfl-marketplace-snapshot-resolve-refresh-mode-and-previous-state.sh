#!/usr/bin/env bash
set -euo pipefail
mkdir -p marketplace-previous

TRIGGER_SOURCE="${INPUT_TRIGGER_SOURCE:-manual}"
MODE="${DISPATCH_MODE:-incremental}"

if [ "${GITHUB_EVENT_NAME}" = "workflow_dispatch" ] && [ "$TRIGGER_SOURCE" = "supabase-cron" ]; then
  [ -n "$INPUT_INTENDED_AT" ] || { echo "Scheduled dispatch is missing intended_at." >&2; exit 1; }
  [ -n "$INPUT_OCCURRENCE_KEY" ] || { echo "Scheduled dispatch is missing occurrence_key." >&2; exit 1; }
  [ -n "$INPUT_TRIGGERED_AT" ] || { echo "Scheduled dispatch is missing triggered_at." >&2; exit 1; }
  [[ "$INPUT_OCCURRENCE_KEY" =~ ^[0-9]{8}-[0-9]{4}-[pm][0-9]{4}$ ]] || {
    echo "Scheduled dispatch has an invalid occurrence_key: $INPUT_OCCURRENCE_KEY" >&2
    exit 1
  }

  TARGET_HM="${INPUT_OCCURRENCE_KEY:9:4}"
  if [ "$TARGET_HM" = "0400" ]; then
    EXPECTED_MODE="reconcile"
  else
    EXPECTED_MODE="incremental"
  fi
  [ "$MODE" = "$EXPECTED_MODE" ] || {
    echo "Scheduled mode $MODE does not match $TARGET_HM ($EXPECTED_MODE)." >&2
    exit 1
  }
elif [ "${GITHUB_EVENT_NAME}" = "push" ]; then
  TRIGGER_SOURCE="push"
  MODE="incremental"
else
  TRIGGER_SOURCE="manual"
fi

STATE_RUN_ID=""
if [ "$MODE" = "incremental" ]; then
  while IFS=$'\t' read -r CREATED_AT RUN_ID; do
    [ -n "$RUN_ID" ] || continue
    [ "$RUN_ID" != "$GITHUB_RUN_ID" ] || continue
    ARTIFACT_NAME="$(
      gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${RUN_ID}/artifacts" \
        --jq '.artifacts[] | select(.name == "mfl_marketplace_state" and .expired == false) | .name' \
        | head -n 1
    )"
    if [ "$ARTIFACT_NAME" = "mfl_marketplace_state" ]; then
      STATE_RUN_ID="$RUN_ID"
      echo "Using marketplace state from run $RUN_ID ($CREATED_AT)."
      break
    fi
  done < <(
    gh run list \
      --workflow mfl-marketplace-snapshot.yml \
      --status success \
      --limit 100 \
      --json databaseId,createdAt \
      --jq '.[] | [.createdAt, .databaseId] | @tsv'
  )

  if [ -n "$STATE_RUN_ID" ]; then
    gh run download "$STATE_RUN_ID" \
      --name mfl_marketplace_state \
      --dir marketplace-previous
    test -s marketplace-previous/mfl_marketplace_listings.json
  elif [ "$TRIGGER_SOURCE" = "manual" ]; then
    echo "Incremental mode requires a previous successful marketplace state." >&2
    exit 1
  else
    echo "No previous state exists; bootstrapping instead."
    MODE="bootstrap"
  fi
fi

echo "mode=$MODE" >> "$GITHUB_OUTPUT"

if [ "$TRIGGER_SOURCE" = "supabase-cron" ]; then
  {
    echo "### Marketplace scheduler"
    echo "- Intended at: $INPUT_INTENDED_AT"
    echo "- Occurrence: $INPUT_OCCURRENCE_KEY"
    echo "- Supabase triggered at: $INPUT_TRIGGERED_AT"
    echo "- Resolved mode: $MODE"
  } >> "$GITHUB_STEP_SUMMARY"
fi
