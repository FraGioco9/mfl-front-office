#!/usr/bin/env bash
set -euo pipefail

# A database refresh reuses the same checkout of the *published* site for each
# checkpoint. Vercel's dependency installation may rewrite package-lock.json
# during a successful build. That change is not part of the published source.
SITE_ROOT="${1:-production-site}"
MODE="${2:-verify}"

if [ ! -d "$SITE_ROOT/.git" ]; then
  echo "Published site source is not checked out: $SITE_ROOT" >&2
  exit 1
fi

case "$MODE" in
  verify)
    ;;
  reconcile-build)
    # Only do this *after* vercel build has succeeded, never during preflight.
    # Restore exactly one tracked build-mutated file; unexpected changes to
    # other source files must remain visible to the integrity check below.
    if ! git -C "$SITE_ROOT" ls-files --error-unmatch -- package-lock.json > /dev/null 2>&1; then
      echo "Published site source has no tracked package-lock.json." >&2
      exit 1
    fi
    git -C "$SITE_ROOT" restore --source=HEAD --worktree -- package-lock.json
    ;;
  *)
    echo "Unsupported published site integrity mode: $MODE" >&2
    exit 2
    ;;
esac

UNEXPECTED_TRACKED_CHANGES="$(
  git -C "$SITE_ROOT" diff HEAD --name-only -- . \
    ':(exclude)api/data-files/**' \
    ':(exclude)modules/app-core-runtime.js' \
    ':(exclude)modules/app-core-*-runtime.js'
)"
if [ -n "$UNEXPECTED_TRACKED_CHANGES" ]; then
  echo "Database checkpoint changed published site source files:" >&2
  printf '%s\n' "$UNEXPECTED_TRACKED_CHANGES" >&2
  exit 1
fi
