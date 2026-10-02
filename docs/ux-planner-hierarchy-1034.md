# UX-05 — Planner plan-state hierarchy and conflict feedback (#1034)

Scope: preserve existing Plans / Squad / Depth order, layout geometry, buttons, save and share API semantics. UX-05 is a UI/feedback clarification, not a new Planner capability.

## Before this change

| State | Previous behavior | Problem |
| --- | --- | --- |
| No team or new unsaved team | Header shows Draft or Unsaved | A new plan could look like an error even though no remote saved copy exists. |
| Saved plan unchanged | Header Saved | Correct; keep this. |
| Saved plan edited locally | Header changed to Unsaved, preexisting `Unsaved changes` hint was always hidden | It obscured that the plan still has a saved original and made draft vs edited-saved hard to distinguish. |
| Shared link opened in read-only mode | Header Shared, blue read-only banner and Copy to my plans | Keep read-only state and separate from an owned plan that merely has a share link. |
| Owned plan has an active share | Header based on local save state, Share action becomes Revoke | Keep this distinction: a share *link* does not convert the owned plan to read-only Shared mode. |
| Stale revision during save | Endpoint returns HTTP 409, error appears in footer status | A scrolled user may miss the conflict and continue editing without noticing. |
| Repeated save during pending mutation | Shared toolbar lock, but `syncPlannerDirtyState` overwrote Save disabled state | The Save button could become visually available while an overlapping mutation was pending, despite the guarded handler. |

## UX-05A — Source, dirty and conflict semantics

- `Draft`: no persisted plan ID. The first Save still prompts for name, using existing flow.
- `Saved`: owned plan with persisted plan ID, even while it has local changes. `Unsaved changes` is **visible alongside Saved** only when this owned copy differs from its last-saved payload.
- `Shared`: read-only received share; retain existing read-only banner and Copy to my plans. A *shared link on an owned plan* is still an editable saved plan.
- HTTP 409 while saving the owned plan: show a small inline message **Plan changed elsewhere. Reopen it from Plans before saving again.** Keep the local draft/roster untouched; the existing Plans and unsaved-changes navigation guard protect deliberate reload. Dismiss the conflict only when a different plan is opened/new draft created or the save succeeds. No hidden auto-overwrite and no forced navigation.
- Save must remain disabled during pending toolbar or saved-plan operations even when dirty and the mode is Saved.

## UX-05B — Geometry and accessibility

- Keep the existing plan bar, action order/width, Squad/Depth columns, Saved Plans list and read-only banner. No new cards or overlays.
- Reuse the existing warning chip; allow small status text to wrap at compact widths rather than overflowing the bar.
- Show conflict in the plan bar with a polite status region. Mode is a separate polite text update.
- Preserve focus/keyboard confirmation behavior and existing action guards.

## Tests and remaining release gate

Automated VM tests execute the **canonical source** for the state mapping and HTTP 409 handling; existing Planner/browser, UX-03 single-flight and generated parity suites remain mandatory. During the final *single* #1034 Vercel release, test with real Dapper wallets: new/loaded/duplicated/readonly plans; two tabs editing different revisions, Save conflict/Cancel/Open; offline save retry; Shared/Revoke/Delete; phone Safari, keyboard and visual contrast. Synthetic CI does not prove those live behaviors.
