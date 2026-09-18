# Planner persistence implementation plan

**Goal:** First independently testable PR for #914: private saved plans and explicit read-only sharing.
**Architecture:** Reuse signed Dapper wallet sessions and the server-only Supabase REST adapter. Persist plans separately from preferences; use random UUIDs and explicit private/unlisted visibility. Every mutation filters by authenticated wallet and revision. Public responses omit wallet identity.
**Tech stack:** Existing CommonJS API, Next API adapter, Postgres migration, Node validators.
**Spec:** https://github.com/FraGioco9/mfl-front-office/issues/914 and the user's approval of private-until-Share behavior.

## Constraints
- Milestone v1.128.4; independently test and squash each PR.
- No production deployment or database mutation in this PR.
- Stable intended URL `/planner/<plan_id>`; UI routing follows in PR 2.
- Shared links show the latest saved plan. Disable sharing to revoke access; duplicating always creates a private plan.
- Save complete assignment snapshots; reject duplicate players, unknown formation slots and malformed IDs.

## Task 1 — Contract and failing regression coverage
- [x] Add `validate-planner-plans.mjs`, exercising the real handler and wallet resolver with an in-memory REST transport.
- [x] Verify private creation, private read denial, owner listing, owner-only writes, stale revision rejection, share/revoke, duplication and bounded bodies.
- [x] Run `node validate-planner-plans.mjs`; expect missing implementation failure.

## Task 2 — Storage and endpoint
- [x] Add `planner-formations.json`: five data-driven formations with stable slot IDs and normalized pitch coordinates.
- [x] Add `api/_planner-plan.js`: payload validation and safe public projection.
- [x] Add `api/planner-plans.js` and `pages/api/planner-plans.js`: GET list/read, POST create/duplicate, PUT save, PATCH visibility, DELETE. Reuse `_wallet-auth`, `_supabase`, `_request-body`, trusted origin validation. Mutations require JSON, same origin and a session.
- [x] Add migration and mirror it in `supabase-schema.sql`: separate planner_plans table, RLS, server-only grants, shape constraints and wallet/update index.
- [x] Add validator to `validate-domain-api-persistence.mjs`.

## Task 3 — Verify and publish
- [x] Run focused regression and API persistence domain; lint changed JavaScript.
- [x] Exercise SQL locally if a Postgres-compatible runtime is available; report any unverified deployment step.
- [x] Review ownership filters, projections, sharing revocation, revision conflicts and failure handling.
- [ ] Commit, push and open PR against main with milestone 39; include local sync and test commands.

## Follow-up PRs
2. Standalone `/planner`, canonical Club selection/roster cache, responsive pitch and tap-based assignment, stable skeleton geometry.
3. Connect New/Save/Load/Duplicate/Share controls and `/planner/<plan_id>` restoration, then test owner/guest and mobile workflows.
