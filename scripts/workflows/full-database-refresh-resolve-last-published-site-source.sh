#!/usr/bin/env bash
set -euo pipefail

SITE_SHA="$(
  gh run list \
    --workflow vercel-site-update.yml \
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
