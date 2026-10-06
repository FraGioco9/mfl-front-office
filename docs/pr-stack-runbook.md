# Milestone and PR stack runbook

This runbook describes the repository's normal path from an Issue plan to a squash-merged change. It is intentionally lightweight: GitHub Issues, branches, pull requests and existing CI remain the workflow.

## 1. Plan the issue

For work larger than one edit:

1. assign the target milestone;
2. split the work into independently testable checklist items;
3. record hard dependencies between items;
4. identify any final-only gates such as real-device testing, production deployment, database refresh or secret rotation;
5. do not mark a waived/deferred test as PASS.

The Issue is the durable roadmap. PR descriptions should not become a second competing roadmap.

## 2. Choose PR boundaries

A good stack keeps each PR independently understandable.

Prefer:
- one concern per PR;
- small diffs with a named owner;
- a dedicated PR for a migration, runtime fix, benchmark-backed optimization, or documentation correction;
- dependent PRs only when the second change cannot be represented safely without the first.

Avoid:
- combining unrelated cleanup with a behavior change;
- opportunistic formatting across untouched domains;
- live provider/database operations hidden inside a source change.

## 3. Link the issue correctly

For a long issue implemented by several PRs:

```text
Refs #1034
```

For the final PR that completes the entire issue:

```text
Closes #1034
```

This distinction matters: GitHub processes `Closes` when the PR reaches the default branch. Using it on the first slice of a stack can close the roadmap too early.

## 4. Work from canonical sources

Read `docs/ownership.md` before changing a generated area.

Examples:
- edit files under `modules/core-sources/`, not their generated `modules/app-core-*-runtime.js` projections;
- edit HTML/CSS canonical fragments, not generated bundles when ownership says otherwise;
- let **Site quality** remain the single writer of tracked generated application artifacts.

If CI produces a generated commit, note the new head SHA and restart the exact-head gate.

## 5. Validate the PR

Use the narrowest deterministic test while developing, then the repository CI gate.

Typical local commands:

```powershell
npm ci --no-audit --no-fund
npm run check
```

Specialized PRs may use a smaller validator while iterating, but merge readiness is based on the repository's required checks on the exact PR head.

Classify non-automated checks explicitly:
- **PASS** — actually executed successfully;
- **WAIVED** — intentionally skipped by an authorized decision;
- **DEFERRED** — reserved for a later named gate;
- **NOT APPLICABLE** — does not apply to this change.

## 6. Re-align after an earlier PR merges

Every squash merge changes `main`. Before merging the next PR in a stack, compare it again with the new base.

For a safe local rebase:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch <next-branch>
git rebase origin/main
git push --force-with-lease
```

If the next PR has a complex dependency history, preserve the intended file/behavior delta rather than mechanically replaying obsolete intermediate commits. After realignment:
- verify `behind = 0`;
- verify the diff still matches the intended scope;
- wait for fresh CI on the new head.

## 7. Exact-head pre-merge gate

Record all of the following together:

```text
base main: <sha>
PR head: <sha>
mergeable: true
behind: 0
required workflows: success on <same PR head>
```

If any one of these changes, the gate is stale.

Generated-artifact commits are head changes too.

## 8. Merge

Normal integration is **squash merge**.

Do not treat "CI green" as permission to merge. Merge only after the maintainer has approved the integration step.

After merge:
1. verify the PR reports merged;
2. record the new `main` SHA;
3. update the Issue checklist/status;
4. re-evaluate the next open PR against the new `main`;
5. do not deploy or refresh production unless that separate action is authorized.

## 9. Release/changelog

Normal feature slices do not each need a version bump.

When the release/milestone is ready:
- update the canonical release source `release.json`;
- preserve required historical entries;
- let the normal build generate projections;
- run release validators;
- document the final release/deploy gate separately from code merge authorization.

## 10. Rollback

For a normal squash-merged code/docs PR, the rollback unit is the squash commit.

For changes with persistent state or external effects, define recovery before executing the live action:
- database/schema: backward/forward migration or restore path;
- Vercel production: use the production rollback runbook and keep code + packaged SQLite identity atomic;
- secrets: retain the old credential until the replacement has been verified when the provider supports overlap.

A source PR that merely prepares a runbook or migration does not itself authorize applying it live.

## Worked example: three-PR issue

Issue `#2000` has three items:

- A — add a validator;
- B — fix the demonstrated runtime bug;
- C — update docs and release notes.

### PR A
Body contains `Refs #2000`. CI is green on head `aaa...`; squash merge creates new main `111...`. Issue item A becomes checked.

### PR B
It was created before PR A merged. Compare it to new main `111...`; it is behind. Re-align the branch, verify its diff still contains only B, then wait for CI on new head `bbb...`. Only then squash merge. Issue item B becomes checked.

### PR C
After re-aligning to the latest main, C completes the final open item. Its body uses `Closes #2000`, includes the planned release/changelog source change, and passes exact-head CI. Squash merge closes the issue automatically.

If C were only another intermediate slice, it would keep `Refs #2000` and the Issue would stay open.

## Final checklist

Before declaring a milestone/stack complete:

- [ ] all intended PRs are merged or explicitly discarded;
- [ ] Issue checkboxes match reality;
- [ ] waived/deferred checks are labeled accurately;
- [ ] generated artifacts match canonical sources;
- [ ] release/changelog state matches the milestone plan;
- [ ] final live release actions have separate authorization and verification;
- [ ] rollback identity/instructions are recorded for any live change.
