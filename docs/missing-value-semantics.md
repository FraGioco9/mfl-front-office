# DATA-04 — Missing MFL value semantics

Issue: #1034

## Goal

Keep three states distinct throughout import and presentation:

1. **Known zero** — a real value supplied by MFL, such as retirement years `0` or revenue share `0`.
2. **Unknown** — the upstream value is absent/null/blank and must not be presented as zero.
3. **Not applicable / semantic absence** — the field is absent because the concept does not apply, for example a free agent has no club division and an unlisted player has no listing price.

The database representation remains unchanged. DATA-04 changes only presentation semantics and adds regression coverage.

## Canonical sentinel catalog

| Domain | Raw sentinel | Meaning | UI |
| --- | --- | --- | --- |
| Generic numeric/text MFL value | `NULL`, `null`, `undefined`, empty string | Unknown / not provided by MFL | **Unknown**, tooltip: “Not provided by MFL.” |
| Numeric `0` | `0` or `"0"` | Known zero | Render the real zero; never map to Unknown |
| `retirement_years = 0` | integer zero | Retired | Existing **Retired** marker |
| `retirement_years = NULL` | SQL null | Retirement timing unknown | No false Retired marker; null remains distinct from zero |
| Missing `listing_price` | null/empty | Player is not currently listed | No price badge; table accessibility label remains **Not For Sale** |
| `listing_price = 0` | numeric zero | Real numeric listing value | Render `$0` if supplied |
| No active contract | empty club id/name/division | Free Agent / no club division applies | **Free Agent** and blank division; never “Unknown division” |
| Active contract, missing/invalid division | club present, division blank/invalid | Contract exists but division is unknown | **Unknown** with standard tooltip |
| Active contract, missing revenue share | revenue share null/blank | Contract exists but value is unknown | **Unknown** with standard tooltip |
| Active contract, revenue share `0` | integer zero | Known 0% | **0%** |

## Import contract

`scripts/database/run_flow_rebuild.py` already provides the correct raw distinction:

- `to_int(None)` and `to_int("")` → `None`;
- `to_int(0)` and `to_int("0")` → `0`;
- missing contract division → empty string;
- an absent contract → empty club id/name/division;
- a present contract with missing division remains distinguishable because club id/name are present.

DATA-04 keeps these values intact rather than converting missing numeric values to zero.

## Table presentation

The canonical shared helper classifies only null/undefined/empty/`NULL` as missing. Missing Table values render **Unknown** and expose the tooltip/accessible label “Not provided by MFL.”

Exceptions retain their domain meaning:

- listing price missing → **Not For Sale**, not Unknown;
- no contract → **Free Agent**, division blank;
- active contract with missing division → Unknown;
- missing stat → Unknown;
- stat value 0 → 0.

## Player presentation

Profile fields use the same Unknown presentation for missing nationality, age, height, foot and seasons.

Contract presentation preserves:
- Free Agent for no contract;
- Unknown division only when a contract exists but its division is absent/invalid;
- Unknown revenue share only when a contract exists but its value is absent;
- 0% when the upstream value is explicitly zero.

## Regression coverage

- `tests/test_missing_value_normalization.py` checks DB-builder normalization for null, zero, retirement status and incomplete/no-contract records.
- `tests/test_missing_value_semantics.mjs` executes the canonical missing-value helper and verifies Table/Player ownership of the presentation rules, listing-price semantics and retirement zero/null separation.
- The JS validator is part of `validate-all.mjs`.

No production database refresh, Vercel deployment or Supabase mutation is needed for DATA-04.
