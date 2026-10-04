# DATA-01C6.G0E — Safe cleanup for stacked pull requests

**Scope:** GitHub Actions cleanup only. This PR does not change the application,
auth, SQLite, production database, release, deployment workflows or Vercel.

## Confirmed failure before this PR

`.github/workflows/cleanup-unused-branches.yml` previously collected only
`[].head.ref` from open pull requests. A squash merge closes its PR and fires
`pull_request_target: closed`; the parent branch is no longer an open PR head,
although open *child* PRs may still name it as their base.

Concrete stack currently present:

- PR #1120: head `fix-1034-data01-listing-cache-freshness`, base `main`.
- PR #1121: head `audit-1034-data01c-generation-races`, base PR #1120's head.
- PR #1122: head `fix-1034-data01c-generation-regression`, base PR #1120's head.
- PR #1123: head `fix-1034-data01c3-visibility-identity`, base PR #1122's head.

Original cleanup could delete the PR #1120 branch immediately after its close.
A failed `gh api` inside bash process substitution could also be mistaken for
an empty collection and trigger mass deletion.

## Remediation

`scripts/workflows/cleanup-unused-branches.mjs` is a narrow, independently
testable command owner. The GitHub workflow checks out trusted `main` only,
runs synthetic tests and uses this single owner to:

1. Request all pages of open PRs with `gh api --paginate --slurp`, parse the
   full JSON and reject missing/malformed/duplicated PRs; protect `main`.
2. Preserve each open PR's **base** in this repository and its **head** only
   when the head belongs to this repository. Fork heads cannot protect local
   branches of the same name. Preserve head-less fork PR bases.
3. Abort without deletion if API fails, pagination content is malformed, no
   open PRs are returned, or the remote branch inventory fails validation.
4. For an apparent orphan, re-fetch open PRs just before deletion. Re-read
   remote branch heads and skip any branch that has moved.
5. Delete via `git push --force-with-lease=refs/heads/<ref>:<observed_sha>`,
   so the ref cannot be deleted if someone pushed since the last observation.
   Distinguish already-gone refs from failed deletion where the branch remains.
6. Serialize overlapping cleanup workflow executions with
   `concurrency.group: cleanup-unused-branches-${{ github.repository }}`
   and `cancel-in-progress: false`.
7. Keep release.json/main trigger, PR-close trigger and manual dispatch, and
   continue deleting genuinely unreferenced branches.

The command remains deliberately conservative: zero open PRs refuses bulk
deletion (manual maintenance instead). As with any server-side API snapshot,
there remains a narrow race where a *new* PR starts referencing a branch after
the final PR inventory and before the compare-and-swap delete; execution
serialization and a ref SHA lease do not make a PR-open event atomic with branch
deletion. This is a reduced-risk fix, not a claim of global atomicity.

## Test matrix

`tests/test_cleanup_unused_branches.mjs` invokes the **actual code** using
injected GitHub/git command responses; it never runs live `gh` or `git push`.
Cases include open stacked PR head/base, 101 PRs across pages, cross-fork
head collision, deleted forks, duplicate/malformed metadata and pages, zero
open PRs, initial and recheck API errors, newly opened child PR, concurrent
remote ref advance, already-deleted branch, push rejection, malformed remote
inventory, and workflow concurrency/trusted-main/no-deploy contract.

Run `node --test tests/test_cleanup_unused_branches.mjs`. It is also included
in `validate-all.mjs` and the cleanup workflow itself. The release validator
`validate-release-version-source.mjs` enforces the new source-of-truth and
preserves its existing release projection checks.

## Integration safety gates

- This PR should be validated on its **exact latest head** through every
  applicable workflow and 17/17 jobs (9 workflows baseline), including Windows,
  Site Quality, Mobile, Table Header and A11Y-01–06.
- If the Site Quality artifact writer pushes a generated head, run the entire
  exact-head CI again on the new head. No action_required counts as green.
- **Do not merge this PR without a separate authorization.** Its merge will
  itself fire the cleanup workflow, which then reads the version on trusted
  main. Keep #1120 open during this preparatory merge.
- Only after a validated and authorized integration of this cleanup can
  #1120 be considered for its own *separate* merge gate and authorization.
- #1121 remains diagnostics only, not an integration dependency; do not
  retarget it blindly or include its bug-expected tests in application CI.
- Do not deploy Vercel, refresh SQLite or execute real Safari/iPhone/Dapper
  until the final designated release gate.
