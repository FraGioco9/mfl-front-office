# DATA-03 — Immutable SQLite checkpoint verification

Issue: #1034

## Problem confirmed

The staged refresh already preserved:
- a previous-production baseline per refresh run;
- same-run resume checkpoints;
- prepared runtime validation;
- the final canonical `mfl_database` artifact before final publication;
- deployment identity and representative live-route verification.

The missing integrity layer was cryptographic checkpoint identity. A checkpoint artifact had no sidecar binding its exact bytes, schema, runtime metadata and refresh identity together. `prepare_runtime_database --validate-only` validates the runtime contract but does not scan the full SQLite file with `PRAGMA integrity_check`.

## DATA-03 contract

Every new refresh checkpoint now carries `checkpoint-manifest.json` containing:

- manifest format version;
- checkpoint stage;
- GitHub run ID and attempt;
- recorded timestamp;
- SQLite byte size;
- SHA-256 of the complete database file;
- SHA-256 of the ordered `sqlite_master` schema definition;
- `runtime_metadata.generated_at`;
- runtime player/wallet counts;
- database stats contract.

Manifest creation and verification run `PRAGMA integrity_check` and fail unless the result is exactly `ok`.

## Boundaries

### Immutable previous-production baseline

The first valid previous `mfl_database` artifact is still restored non-destructively. Historical artifacts created before DATA-03 may not contain a manifest, so the discovery path keeps the legacy runtime validator for backward compatibility. Before that database becomes the immutable baseline for the new run, DATA-03 creates and verifies a new baseline manifest.

A same-run baseline restore requires the manifest and the matching GitHub run ID.

### Resume checkpoints

Each resume artifact now contains:

- `mfl_database.db`
- `checkpoint-manifest.json`
- `resume-state.json`

Restore requires:
- matching run ID;
- valid stage;
- manifest stage/run identity match;
- byte SHA-256 match;
- schema SHA-256 match;
- runtime metadata match;
- successful SQLite integrity check.

The final resume path restores both the database and sidecar into `checkpoints/final`.

### Published checkpoints

Core, player-seasons, player-data and final materialization create a manifest immediately after runtime preparation. The canonical `mfl_database` artifact preserves both the database and manifest.

The checkpoint publisher verifies the sidecar **before** copying the database into the published site or invoking Vercel. Checkpoint telemetry records the database SHA-256, byte size and schema SHA-256 next to the existing site/database deployment identity.

## Failure behavior

The isolated tests cover:
- missing manifest;
- wrong run identity;
- wrong checkpoint stage;
- database mutation after manifest creation;
- schema mutation after manifest creation;
- corrupted SQLite bytes;
- manifest tampering.

These cases fail closed before publication.

## Compatibility and safety

- Existing pre-DATA-03 canonical database artifacts remain usable as the input to the next refresh through the legacy validation fallback.
- Once a historical artifact is selected as the new run's baseline, it is immediately integrity-checked and sealed with a DATA-03 manifest.
- No production database refresh is required to validate this code.
- No Supabase data/schema change is introduced.
- No Vercel deploy is performed by this work item.
