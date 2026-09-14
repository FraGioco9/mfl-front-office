#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_NAME="full-database-refresh-resume-${GITHUB_RUN_ID}"
RESUME_DIR="resume-checkpoint"

emit_empty_state() {
  {
    echo "stage=none"
    echo "core_done=false"
    echo "player_seasons_done=false"
    echo "player_data_done=false"
    echo "final_ready=false"
  } >> "$GITHUB_OUTPUT"
}

artifact_id="$(
  gh api --paginate     "repos/${GITHUB_REPOSITORY}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=100"     --jq '.artifacts | map(select(.expired == false)) | sort_by(.created_at) | reverse | .[0].id // empty'
)"

if [ -z "$artifact_id" ]; then
  echo "No same-run refresh resume checkpoint exists."
  emit_empty_state
  exit 0
fi

rm -rf "$RESUME_DIR"
mkdir -p "$RESUME_DIR"
echo "Restoring refresh resume artifact ${artifact_id} for run ${GITHUB_RUN_ID}."
gh run download "$GITHUB_RUN_ID"   --repo "$GITHUB_REPOSITORY"   --name "$ARTIFACT_NAME"   --dir "$RESUME_DIR"

STATE_PATH="$RESUME_DIR/resume-state.json"
DATABASE_PATH="$RESUME_DIR/mfl_database.db"
test -s "$STATE_PATH"
test -s "$DATABASE_PATH"

stage="$(jq -r '.stage // empty' "$STATE_PATH")"
run_id="$(jq -r '.runId // empty' "$STATE_PATH")"
if [ "$run_id" != "$GITHUB_RUN_ID" ]; then
  echo "Resume checkpoint runId ${run_id:-<missing>} does not match ${GITHUB_RUN_ID}." >&2
  exit 1
fi

case "$stage" in
  core|player_seasons|player_data|final) ;;
  *)
    echo "Invalid refresh resume stage: ${stage:-<missing>}" >&2
    exit 1
    ;;
esac

python -m scripts.database.prepare_runtime_database "$DATABASE_PATH" --validate-only
cp "$DATABASE_PATH" mfl_database.db

core_done=true
player_seasons_done=false
player_data_done=false
final_ready=false

case "$stage" in
  core)
    ;;
  player_seasons)
    player_seasons_done=true
    ;;
  player_data)
    player_seasons_done=true
    player_data_done=true
    ;;
  final)
    player_seasons_done=true
    player_data_done=true
    final_ready=true
    mkdir -p checkpoints/final
    cp "$DATABASE_PATH" checkpoints/final/mfl_database.db
    ;;
esac

{
  echo "stage=$stage"
  echo "core_done=$core_done"
  echo "player_seasons_done=$player_seasons_done"
  echo "player_data_done=$player_data_done"
  echo "final_ready=$final_ready"
} >> "$GITHUB_OUTPUT"

echo "Resuming Full database refresh after validated stage: $stage"
