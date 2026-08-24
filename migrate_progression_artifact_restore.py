from __future__ import annotations

from pathlib import Path


path = Path(".github/workflows/full-database-refresh.yml")
original = path.read_text(encoding="utf-8").replace("\r\n", "\n")
source = original

start_marker = "      - name: Restore previous database for email comparison\n"
end_marker = "      - name: Rebuild database\n"
start = source.find(start_marker)
if start < 0:
    raise RuntimeError("Could not find previous-database restore step")
end = source.find(end_marker, start)
if end < 0:
    raise RuntimeError("Could not find rebuild step after previous-database restore")
if source.find(start_marker, start + len(start_marker)) >= 0:
    raise RuntimeError("Found duplicate previous-database restore steps")

replacement = '''      - name: Restore previous database for email comparison
        if: github.event_name != 'schedule' || steps.schedule_gate.outputs.should_run == 'true'
        working-directory: builder
        shell: bash
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          mkdir -p previous-database

          PREVIOUS_RUN_ID=""
          PREVIOUS_ARTIFACT_ID=""
          PREVIOUS_CREATED_AT=""

          while IFS=$'\\t' read -r CREATED_AT ARTIFACT_ID RUN_ID; do
            [ -n "$ARTIFACT_ID" ] || continue
            [ -n "$RUN_ID" ] || continue

            rm -rf previous-database/*
            echo "Checking mfl_database artifact $ARTIFACT_ID from run $RUN_ID ($CREATED_AT)."

            if ! gh run download "$RUN_ID" --repo "$GITHUB_REPOSITORY" --name mfl_database --dir previous-database; then
              echo "Artifact $ARTIFACT_ID could not be downloaded; trying the next candidate."
              continue
            fi

            if python prepare_runtime_database.py previous-database/mfl_database.db --validate-only; then
              PREVIOUS_RUN_ID="$RUN_ID"
              PREVIOUS_ARTIFACT_ID="$ARTIFACT_ID"
              PREVIOUS_CREATED_AT="$CREATED_AT"
              break
            fi

            echo "Artifact $ARTIFACT_ID does not contain a valid prepared mfl_database.db; trying the next candidate."
          done < <(
            gh api --paginate \\
              "repos/${GITHUB_REPOSITORY}/actions/artifacts?name=mfl_database&per_page=100" \\
              --jq '.artifacts[] | select(.name == "mfl_database" and .expired == false) | [.created_at, (.id | tostring), (.workflow_run.id | tostring)] | @tsv' \\
              | sort -r
          )

          if [ -n "$PREVIOUS_RUN_ID" ]; then
            echo "Using previous database artifact $PREVIOUS_ARTIFACT_ID from run $PREVIOUS_RUN_ID ($PREVIOUS_CREATED_AT)."
          else
            rm -rf previous-database/*
            echo "No valid previous database artifact found; progression emails will be skipped."
          fi

'''

source = source[:start] + replacement + source[end:]

required = [
    "actions/artifacts?name=mfl_database&per_page=100",
    "gh api --paginate",
    "prepare_runtime_database.py previous-database/mfl_database.db --validate-only",
    "trying the next candidate",
]
for fragment in required:
    if fragment not in source:
        raise RuntimeError(f"Artifact restore migration is missing: {fragment}")

restore_section = source[source.find(start_marker):source.find(end_marker, source.find(start_marker))]
if "gh run list" in restore_section:
    raise RuntimeError("Previous-database restore still scans recent workflow runs")

if source != original:
    path.write_text(source, encoding="utf-8")
    print(f"Migrated {path}")
else:
    print(f"Unchanged {path}")
