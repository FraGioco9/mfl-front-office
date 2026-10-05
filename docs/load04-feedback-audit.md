# LOAD-04C — Contextual Planner and Settings error feedback (#1034)

**Clean reconstruction:** 2026-10-05 on `main` `38323c814b9c4ce85bc5106325616ac31642a2c0`, after LOAD-04B/#1130 was squash-merged. Historical PR #1118 remains evidence only and is not part of this branch history. No database refresh, wallet/account action, Supabase change or Vercel deploy.

## Reproduced problems

The isolated LOAD-04 fixture showed three generic current-user failures:
- Planner generic HTTP 409 displayed only `Conflict`;
- Planner generic HTTP 429 displayed only `Too Many Requests`;
- browser-offline Planner saves displayed only `Failed to fetch`;
- Settings offline save kept the draft but displayed only `Settings could not be saved.` as a polite toast.

Existing specific API messages, single-flight locks, modal focus restoration, retry ownership and the newly integrated sticky-toast lifecycle already behave correctly and remain unchanged.

## Targeted change

Planner adds a domain-local `plannerActionErrorMessage` shared by toolbar and Saved Plans actions:
- generic 409 → `Saved plan changed. Reopen it from Plans before retrying.`;
- generic 429 → `Too many requests. Try again later.`;
- browser offline fetch errors → `Network unavailable. Check your connection and try again.`;
- specific revision/quota/401/500 messages remain unchanged.

Settings offline save now announces `Settings could not be saved. Your changes are kept; select Save to retry.` with `urgent:true`. The queued local draft and manual retry flow are unchanged; success stays polite.

## Verification

The dedicated LOAD-04 source-execution fixture runs with `LOAD04_EXPECT_FIXED=1` and retains the sticky-toast assertions from LOAD-04B. Focused validators exercise toolbar and Saved Plans single-flight/focus recovery, Settings failure/retry, Planner conflict state, cross-domain mutation locks and A11Y assertive/polite live-region ownership.

No automatic retry/backoff, global HTTP error mapper, timer change, wallet/session change, persistence change or focus movement is introduced. Real Safari/iPhone/wallet/network checks remain at the final issue gate.

## Decision

Integrate only these Planner/Settings feedback corrections after exact-head CI. Do not import #1118 history or unrelated generated artifacts. Do not merge without explicit maintainer approval.
## Generated artifact synchronization

Site Quality on user head `2af3facfc4400bdcf5849f5432316092cbb64371` passed the application/browser gates and produced CI-owned commit `cdcd9772a45ba12623c5ea1f89b5597588562927`, changing only the derived `table-width-runtime.js` core build ID. The bot-authored pull-request events are `action_required`, so this documentation-only commit retriggers the complete exact-head workflow set on the synchronized generated state. No application behavior changes here.
