#!/usr/bin/env bash
set -euo pipefail
if [ -z "${TEST_RECIPIENT:-}" ]; then
  if [ "${GITHUB_EVENT_NAME}" = "push" ]; then
    echo "Set the PROGRESSION_EMAIL_TEST_RECIPIENT repository secret before using the pre-merge [gmail-test] trigger." >&2
  else
    echo "A test recipient is required." >&2
  fi
  exit 1
fi
