#!/usr/bin/env bash
set -euo pipefail

MEASURED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
RUN_JSON="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}")"
CREATED_AT="$(jq -r '.created_at // empty' <<< "$RUN_JSON")"
if [ -z "$CREATED_AT" ]; then
  CREATED_AT="$MEASURED_AT"
fi

JOBS_JSON="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/jobs?per_page=100")"
JOB_STARTED_AT="$(
  jq -r '.jobs[] | select(.name == "update-database-and-production-data") | .started_at // empty' \
    <<< "$JOBS_JSON" | head -n 1
)"
if [ -z "$JOB_STARTED_AT" ]; then
  JOB_STARTED_AT="$MEASURED_AT"
fi

INTENDED_EPOCH="$(date -d "$INTENDED_AT" +%s)"
TRIGGERED_EPOCH="$(date -d "$TRIGGERED_AT" +%s)"
CREATED_EPOCH="$(date -d "$CREATED_AT" +%s)"
JOB_STARTED_EPOCH="$(date -d "$JOB_STARTED_AT" +%s)"
TRIGGER_DELAY_SECONDS="$((TRIGGERED_EPOCH - INTENDED_EPOCH))"
TRIGGER_TO_WORKFLOW_SECONDS="$((CREATED_EPOCH - TRIGGERED_EPOCH))"
QUEUE_DELAY_SECONDS="$((JOB_STARTED_EPOCH - CREATED_EPOCH))"
TOTAL_DELAY_SECONDS="$((JOB_STARTED_EPOCH - INTENDED_EPOCH))"

SITE_RUNS_JSON="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/vercel-site-update.yml/runs?per_page=30")"
DATABASE_RUNS_JSON="$(gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/full-database-refresh.yml/runs?per_page=30")"
OVERLAPPING_SITE_RUNS="$(
  jq --arg start "$CREATED_AT" --arg end "$JOB_STARTED_AT" \
    '[.workflow_runs[] | select(.created_at <= $end and .updated_at >= $start)] | length' \
    <<< "$SITE_RUNS_JSON"
)"
OVERLAPPING_DATABASE_RUNS="$(
  jq --arg start "$CREATED_AT" --arg end "$JOB_STARTED_AT" --arg run_id "$GITHUB_RUN_ID" \
    '[.workflow_runs[] | select((.id | tostring) != $run_id and .created_at <= $end and .updated_at >= $start)] | length' \
    <<< "$DATABASE_RUNS_JSON"
)"

if [ "$TRIGGER_SOURCE" = "supabase-cron" ]; then
  if [ "$TRIGGER_DELAY_SECONDS" -gt 60 ]; then
    DELAY_SOURCE_HINT="Supabase scheduler arrived late"
  elif [ "$TRIGGER_DELAY_SECONDS" -lt -60 ]; then
    DELAY_SOURCE_HINT="Supabase scheduler arrived early"
  else
    DELAY_SOURCE_HINT="Supabase scheduler within 60 seconds of intended time"
  fi
else
  DELAY_SOURCE_HINT="Manual dispatch"
fi

if [ "$QUEUE_DELAY_SECONDS" -gt 60 ]; then
  if [ "$((OVERLAPPING_SITE_RUNS + OVERLAPPING_DATABASE_RUNS))" -gt 0 ]; then
    DELAY_SOURCE_HINT="$DELAY_SOURCE_HINT + shared concurrency wait"
  else
    DELAY_SOURCE_HINT="$DELAY_SOURCE_HINT + runner/job queue wait"
  fi
fi

TELEMETRY_FILE="$RUNNER_TEMP/full-database-refresh-trigger-telemetry.json"
jq -n \
  --arg timezone "Europe/Rome" \
  --arg triggerSource "$TRIGGER_SOURCE" \
  --arg intendedAt "$INTENDED_AT" \
  --arg triggeredAt "$TRIGGERED_AT" \
  --arg workflowCreatedAt "$CREATED_AT" \
  --arg jobStartedAt "$JOB_STARTED_AT" \
  --arg measuredAt "$MEASURED_AT" \
  --arg delaySourceHint "$DELAY_SOURCE_HINT" \
  --argjson triggerDelaySeconds "$TRIGGER_DELAY_SECONDS" \
  --argjson triggerToWorkflowSeconds "$TRIGGER_TO_WORKFLOW_SECONDS" \
  --argjson queueOrConcurrencyDelaySeconds "$QUEUE_DELAY_SECONDS" \
  --argjson totalStartDelaySeconds "$TOTAL_DELAY_SECONDS" \
  --argjson overlappingSiteUpdateRuns "$OVERLAPPING_SITE_RUNS" \
  --argjson overlappingDatabaseRefreshRuns "$OVERLAPPING_DATABASE_RUNS" \
  --arg runId "$GITHUB_RUN_ID" \
  --arg runAttempt "$GITHUB_RUN_ATTEMPT" \
  '{timezone:$timezone,triggerSource:$triggerSource,intendedAt:$intendedAt,triggeredAt:$triggeredAt,workflowCreatedAt:$workflowCreatedAt,jobStartedAt:$jobStartedAt,measuredAt:$measuredAt,triggerDelaySeconds:$triggerDelaySeconds,triggerToWorkflowSeconds:$triggerToWorkflowSeconds,queueOrConcurrencyDelaySeconds:$queueOrConcurrencyDelaySeconds,totalStartDelaySeconds:$totalStartDelaySeconds,overlappingSiteUpdateRuns:$overlappingSiteUpdateRuns,overlappingDatabaseRefreshRuns:$overlappingDatabaseRefreshRuns,delaySourceHint:$delaySourceHint,runId:$runId,runAttempt:$runAttempt}' \
  > "$TELEMETRY_FILE"

cat "$TELEMETRY_FILE"
{
  echo "### Full database refresh trigger timing"
  echo
  echo "| Metric | Value |"
  echo "| --- | --- |"
  echo "| Trigger source | \`$TRIGGER_SOURCE\` |"
  echo "| Intended Rome time | \`$INTENDED_AT\` |"
  echo "| Triggered | \`$TRIGGERED_AT\` |"
  echo "| Workflow created | \`$CREATED_AT\` |"
  echo "| Database job started | \`$JOB_STARTED_AT\` |"
  echo "| Trigger delay from intended time | ${TRIGGER_DELAY_SECONDS}s |"
  echo "| Trigger → workflow creation | ${TRIGGER_TO_WORKFLOW_SECONDS}s |"
  echo "| Queue/concurrency delay | ${QUEUE_DELAY_SECONDS}s |"
  echo "| Total start delay | ${TOTAL_DELAY_SECONDS}s |"
  echo "| Overlapping site-update runs | $OVERLAPPING_SITE_RUNS |"
  echo "| Overlapping database-refresh runs | $OVERLAPPING_DATABASE_RUNS |"
  echo "| Delay source hint | $DELAY_SOURCE_HINT |"
} >> "$GITHUB_STEP_SUMMARY"
