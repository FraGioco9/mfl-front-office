#!/usr/bin/env bash
set -euo pipefail

if [ ! -f production-site/site/api/_database.js ]; then
  echo "The last published site source does not support the SQLite runtime." >&2
  echo "Publish a SQLite-capable site version once before using database-only production refreshes." >&2
  exit 1
fi

PUBLISHED_ADAPTER_BLOB="$(git -C production-site rev-parse HEAD:site/api/_database.js)"

rm -rf production-site/site/api/data-files
mkdir -p production-site/site/api/data-files
cp builder/mfl_database.db production-site/site/api/data-files/mfl_database.db
test -s production-site/site/api/data-files/mfl_database.db

CURRENT_ADAPTER_BLOB="$(git -C production-site hash-object site/api/_database.js)"
if [ "$CURRENT_ADAPTER_BLOB" != "$PUBLISHED_ADAPTER_BLOB" ]; then
  echo "Database-only refresh changed the published SQLite adapter; refusing to deploy mixed site versions." >&2
  exit 1
fi

if find production-site/site/api/data-files -maxdepth 1 -type f -name '*.json' | grep -q .; then
  echo "Generated JSON data files are not allowed." >&2
  exit 1
fi
