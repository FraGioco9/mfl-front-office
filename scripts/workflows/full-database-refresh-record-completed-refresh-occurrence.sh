#!/usr/bin/env bash
set -euo pipefail
jq -n \
  --arg occurrenceKey "$OCCURRENCE_KEY" \
  --arg intendedAt "$INTENDED_AT" \
  --arg triggerSource "$TRIGGER_SOURCE" \
  --arg completedAt "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --arg runId "$GITHUB_RUN_ID" \
  '{
    occurrenceKey: $occurrenceKey,
    intendedAt: $intendedAt,
    triggerSource: $triggerSource,
    completedAt: $completedAt,
    runId: $runId
  }' > "$RUNNER_TEMP/full-database-refresh-occurrence.json"
