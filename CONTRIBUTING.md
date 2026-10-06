# Contributing to MFL Front Office

MFL Front Office uses small, reviewable pull requests and a squash-merge workflow. For multi-step work, keep each PR narrow enough to validate independently and track the full plan in one GitHub Issue/milestone.

Before editing source ownership or generated files, read [docs/ownership.md](docs/ownership.md). For the step-by-step milestone/PR-stack process, see [docs/pr-stack-runbook.md](docs/pr-stack-runbook.md).

## Local setup

Use Node.js 22 and run commands from the repository root.

```powershell
npm ci --no-audit --no-fund
npm run dev
```

Before publishing a normal application change:

```powershell
npm run check
```

Do not rebuild or refresh the production database merely to validate an unrelated code/documentation PR.

## Branch and PR scope

- Start from the current `main` unless the change genuinely depends on another open PR.
- Prefer one behavior, fix, migration, documentation item, or operational concern per PR.
- Record dependencies explicitly in the PR body.
- Do not mix deploys, database refreshes, secret rotation, provider changes, or other live operations into an ordinary source PR unless that live action is separately authorized.
- Keep rollback instructions proportional to the risk: a docs-only PR can say "revert the squash commit"; a schema/deployment change needs a concrete recovery path.

## Issue links in a PR stack

Use `Refs #<issue>` for intermediate PRs in a multi-PR roadmap.

Use `Closes #<issue>` only on the PR that is intended to complete and close the whole issue. This prevents the first merged slice of a long stack from closing a roadmap that still has open work.

If one PR fully implements a standalone issue, `Closes #<issue>` is appropriate immediately.

## Generated artifacts

Tracked generated application artifacts have one writer: **Site quality**. Edit the canonical source owner, not the generated projection.

If Site quality commits generated projections back to the PR branch, the PR head changes. Treat every previous check as stale until CI has completed successfully again on that new exact head.

Do not hand-resolve a generated-file conflict by inventing a projection. Rebase/sync the canonical source, let the canonical build regenerate, and verify the resulting diff.

## Exact-head CI gate

Before squash merge:

1. fetch the current PR head SHA;
2. confirm the branch is not behind the intended base;
3. confirm the PR is mergeable;
4. confirm required CI completed successfully on that exact head;
5. if any commit is added, rebased, regenerated, or merged into the branch, repeat the gate from step 1.

A green check from an older head is evidence only, not merge authorization for a newer head.

## Syncing with main

Preferred PowerShell flow for a branch that can be rebased safely:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch <branch>
git rebase origin/main
git push --force-with-lease
```

If a branch is part of a dependency stack, first verify which commits belong to the intended PR delta. Preserve only that delta when re-aligning. After any history rewrite or merge-based realignment, re-run the exact-head CI gate.

Never use a blind force push; use `--force-with-lease` when a rebase requires updating the remote branch.

## Release and changelog ownership

`release.json` owns the current release version and description. Generated footer/changelog projections are produced from canonical release sources.

A feature/fix PR should not bump the release merely because it is merged. Update release/changelog sources only when the milestone/release plan calls for it. The release PR must preserve complete SemVer history and pass the release validators.

## Merge and rollback

The repository uses squash merge into `main`. The squash commit becomes the rollback unit for a normal PR.

Before merging, the PR description should state:
- linked issue/milestone;
- scope and intentional non-scope;
- validation performed and anything explicitly waived;
- live operations performed, or "none";
- rollback approach;
- release/changelog impact.

Merging a PR does not implicitly authorize a Vercel deployment, production database refresh, secret rotation, Supabase mutation, or other live operation.
