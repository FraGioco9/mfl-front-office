#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" != "--workflow" ] || [ -z "${2:-}" ]; then
  echo "Usage: $0 --workflow <workflow-file>" >&2
  exit 1
fi
SITE_WORKFLOW="$2"

SITE_SHA="$(
  gh run list \
    --workflow "$SITE_WORKFLOW" \
    --status success \
    --limit 50 \
    --json headSha,createdAt \
    --jq 'sort_by(.createdAt) | reverse | map(select(.headSha != null and .headSha != "")) | .[0].headSha // ""'
)"

if [ -z "$SITE_SHA" ]; then
  echo "No successful Vercel site update run was found." >&2
  echo "Publish the site once with the Vercel site update workflow before running database-only production refreshes." >&2
  exit 1
fi
echo "Using last published site source commit $SITE_SHA."
echo "sha=$SITE_SHA" >> "$GITHUB_OUTPUT"
