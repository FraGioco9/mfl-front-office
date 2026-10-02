# NAV-04 — Shareable and canonical filter URLs (#1034)

## Scope and current ownership
Canonical Table routes use a view slug in the path and public query parameters for quick filters (hideRetired, hideRetiring, database-only hideMfl, MFL-only packableOnly, newMintsOnly), non-default sort and direction, and advanced filters such as age.gte=25, or.name.contains=Jos%C3%A9 or age.between.from=20&age.between.to=30. Query parsing occurs before the first Table data request and is mirrored in the bootstrap and parser first-paint control projections. When a query is supplied, it is authoritative; without a query the locally saved Table state remains the fallback.

Intentionally not encoded in public filter URLs: page index, page size, selected players, private wallet/Dapper state, unpublished Watchlist membership, personal notes, and Planner edit state. Club, Evaluation and Planner have their own route owners. We retain these boundaries; no new share mechanism.

## NAV-04A — Findings
- Previously a later duplicate quick-filter value could override an earlier value: hideRetired=false&hideRetired=true. Duplicate sort/direction already use first occurrence; the mixed precedence was undocumented.
- In the Table parser, first-rule connector normalization happened before invalid filters were discarded, leaving the first valid rule with an OR connector if the earlier one was invalid. The serializer likewise used the original array index, not the first successfully emitted rule.
- Unsupported query columns/operators, invalid numeric values, unsupported sort keys and unknown parameters were already removed by canonical URL replacement. UTF-8 values, range bounds and non-default sorting already had stable readable URLs.

## NAV-04B — Code behavior
- First occurrence of a quick-filter key is authoritative, even if invalid (then its default applies); duplicate keys are ignored. Boolean inputs remain case-insensitive, output remains lowercase true/false, matching existing sort/direction first-occurrence behavior.
- Validate rules before renumbering connectors: the first *surviving* valid rule always uses AND, later OR is retained. When serializing, only emitted valid rules determine the connector ordinal. Invalid ranges cannot leave a dangling initial OR.
- The hydrated Table parser, bootstrap and inline parser first paint use the same interpretation. Browser query normalization keeps only supported shareable fields via the existing history.replaceState implementation; no extra history entry or private state is introduced.

## Validation
- validate-nav04-shareable-urls.mjs executes the real canonical parser/serializer in a sandboxed Node VM. Cases include duplicated quick/sort, invalid leading rules, Unicode accented names, between ranges, round-trip idempotence, Stats views and locally saved fallback.
- The existing Chromium browser routing regression adds two real direct-refresh pasted URLs at desktop 1280px and mobile 390px with duplicate quick flags, invalid numeric/unsupported sort, unknown parameter and encoded José value; checks parser first-paint count/header, hydrated controls, canonical URL and console errors.
- Existing UX-04 browser matrix and validate-table-url-state.mjs still cover valid linked sorting/filtering and empty filters.

## Reviewed CSP first-paint hash update

The inline first-paint parser changed without adding or removing any scripts. The existing 12 SHA-256 hashes were independently reproduced from the generated HTML and matched the checked-in snapshot exactly. Rebuilding with the revised first-paint fragment changes only inline script #1 from `'sha256-yN/ZmKiORV6M5t+kOjf+rvexMS7OKHAHMDdtlKUCOVM='` to `'sha256-2yOfnR5276GFwUpwFc/m4qFv7d0ZKZsbd994d6MWciM='`; all 11 other approved hashes are unchanged. The regenerated tracked `index.html` and `csp-legacy-hash-snapshot.mjs` are committed together; no `unsafe-inline` allowance or CSP enforcement change.

## NAV-04C — Deferred final gate
After the one final Vercel deployment for issue #1034: copy/paste, reload and Back/Forward across real Database/MFL/Progression/Watchlist for guest, opt-out and opt-in; Unicode and percent-encoded text, duplicate keys, multiple OR/between rules, invalid filters/sort and saved local fallback; Safari iPhone and actual wallet/permissions. Confirm correct initial HTML, hydration and CDN route responses; leave this checkbox open until then.
