## Issue / milestone

- Refs #
- Milestone:
- Stack position / dependencies:

> Use `Refs #...` for an intermediate PR in a multi-PR roadmap. Change it to `Closes #...` only when this PR is intended to complete the entire issue.

## Scope

Describe the smallest independently reviewable change in this PR.

### Out of scope

List adjacent work deliberately left for another PR or the final release gate.

## Validation

- [ ] Relevant deterministic validators/tests pass.
- [ ] Required CI is green on the **exact current PR head**.
- [ ] PR is mergeable and not behind its intended base.
- [ ] Manual/device/live checks are recorded as PASS, WAIVED, DEFERRED, or NOT APPLICABLE — never implied.

Exact head SHA checked:

```text
<sha>
```

## Generated artifacts

- [ ] Canonical source owners were edited instead of generated projections.
- [ ] If Site quality advanced the branch with generated artifacts, CI was rechecked on the new exact head.
- [ ] No generated-file conflict was resolved by inventing output manually.

## Live operations

- [ ] No deploy, production database refresh, secret rotation, provider mutation, or other live operation is included.
- [ ] Or: the live action is explicitly authorized and documented here.

Details:

## Release / changelog

- [ ] No release metadata change is needed for this slice.
- [ ] Or: release/changelog sources are updated as part of the planned release.

## Rollback

State the rollback unit and any data/deployment considerations. For a normal source/docs PR, reverting the squash commit is usually sufficient.

## Merge readiness

- [ ] Scope is complete.
- [ ] Issue checklist/roadmap is updated.
- [ ] Exact-head CI gate is complete.
- [ ] Squash merge has explicit maintainer approval.
