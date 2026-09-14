#!/usr/bin/env bash
set -euo pipefail

STAGE="${1:?resume stage is required}"
DATABASE_SOURCE_PATH="${2:?resume database path is required}"

case "$STAGE" in
  core|player_seasons|player_data|final) ;;
  *)
    echo "Invalid refresh resume stage: $STAGE" >&2
    exit 1
    ;;
esac

if [ ! -s "$DATABASE_SOURCE_PATH" ]; then
  echo "Resume database does not exist or is empty: $DATABASE_SOURCE_PATH" >&2
  exit 1
fi

python -m scripts.database.prepare_runtime_database "$DATABASE_SOURCE_PATH" --validate-only

RESUME_DIR="resume-checkpoint"
rm -rf "$RESUME_DIR"
mkdir -p "$RESUME_DIR"
cp "$DATABASE_SOURCE_PATH" "$RESUME_DIR/mfl_database.db"

RECORDED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
jq -n   --arg stage "$STAGE"   --arg runId "$GITHUB_RUN_ID"   --arg runAttempt "$GITHUB_RUN_ATTEMPT"   --arg recordedAt "$RECORDED_AT"   '{stage:$stage,runId:$runId,runAttempt:$runAttempt,recordedAt:$recordedAt}'   > "$RESUME_DIR/resume-state.json"

{
  echo "### Refresh resume checkpoint: $STAGE"
  echo
  echo "Validated checkpoint recorded at `$RECORDED_AT` for run `$GITHUB_RUN_ID` attempt `$GITHUB_RUN_ATTEMPT`."
} >> "$GITHUB_STEP_SUMMARY"
