# Account, opt-in and sharing help

This page explains what works as a guest, what Dapper opt-in unlocks, and what happens to saved or shared content.

## Quick access guide

| State | Public pages | Public shared Evaluation | Public shared Planner plan | Watchlists / My Players / My Clubs / Settings | Save or manage private content |
| --- | --- | --- | --- | --- | --- |
| Guest | Yes | Yes | Yes | Opt-in screen | No |
| Wallet connected but opted out | Yes | Yes | Yes | Opt-in screen | No |
| Opted in with a valid server session | Yes | Yes | Yes | Yes | Yes |
| Wallet/authentication temporarily unavailable | Public access remains available | Existing public link remains readable if it is still active | Existing public link remains readable if it is still active | Depends on whether an existing server session is still valid | New authentication-dependent actions may need to wait |

Opening a public shared link never gives the viewer ownership of the saved item.

## What “Opt in” means

Dapper opt-in establishes a server-verified wallet session. The browser receives an HttpOnly session cookie used by private MFL Front Office APIs.

A browser-side opt-in marker is only a UI hint. It is not authentication by itself.

If the server session expires or is revoked, private routes fall back to the opt-in state and the app asks you to opt in again. Public pages and active public share links remain separate from that private session.

If Dapper or wallet authentication is temporarily unavailable, retry the opt-in later. Do not expect an old browser marker or legacy wallet proof to unlock private features.

## Watchlists

Watchlists are private, wallet-scoped account data.

- Dapper opt-in is required to create, rename, delete, sync or use Watchlists.
- A wallet can keep up to **5 Watchlists**.
- Each Watchlist can contain up to **250 players**.
- Watchlist data is stored separately from the packaged public MFL database, so a normal database refresh does not intentionally erase it.

If you are signed out or opted out, Watchlist routes show the existing opt-in screen instead of exposing another wallet's data.

## Saved Evaluations

The plain Evaluation tool can be opened without opting in, but saving and loading private Evaluations requires an opted-in wallet session.

- A wallet can keep up to **100 saved Evaluations**.
- Saved Evaluations are private to the wallet that created them.
- A saved Evaluation link is not a public share unless you explicitly create a share.

If the private session expires, the app asks you to opt in again before loading or saving private Evaluations.

## Shared Evaluations

Creating a shared Evaluation requires opt-in. Opening an active shared Evaluation does not.

- Shared Evaluation links are read-only for viewers.
- Public share responses do not expose the creator wallet.
- New Evaluation shares expire **one calendar year** after creation.
- If a share is expired, unavailable or malformed, the app reports that the shared Evaluation could not be loaded and returns to the normal Evaluation route.

A public viewer cannot edit the owner's saved Evaluation by opening its share link.

## Planner saves

Private Planner saves require opt-in.

- A wallet can keep up to **50 saved plans**.
- Saves are wallet-scoped.
- Concurrent/stale edits are revision-checked so an older client does not silently overwrite a newer saved revision.

If your session expires while working with saved plans, opt in again before saving or managing them.

## Shared Planner plans

Creating or managing a Planner share requires opt-in. Opening an active shared-plan URL does not.

- Shared-plan viewers get a public, read-only snapshot.
- The public response omits owner-only fields.
- Planner shares expire after **one year**.
- The owner can explicitly **Revoke** a share.
- Revocation makes the existing public link unavailable immediately.
- Deleting a saved plan also removes its linked share.

If an active shared plan cannot be found because it was revoked or expired, the public link no longer loads that plan.

## What happens when the wallet is unavailable?

If wallet authentication cannot complete:

- public pages remain usable;
- active public Evaluation/Planner share links remain readable;
- new opt-in, private saves, Watchlist changes and share-management actions may be unavailable;
- an already valid server session can continue to authorize private requests until it expires or is revoked.

If the app says the Dapper opt-in expired, opt in again. Do not refresh repeatedly expecting a stale browser marker to restore access.

## Before reporting a bug

Check which state applies:

1. **Guest / opted out:** private routes should show the opt-in screen.
2. **Opted in:** private saves and account data should be available to the linked wallet.
3. **Share viewer:** an active public share should open without opt-in, but it is read-only.
4. **Revoked/expired share:** the old link should no longer load its content.
5. **Wallet/auth unavailable:** public browsing should still work; private actions may need to wait or be retried after authentication recovers.

If the behavior differs from the matching state above, use **Report a bug** in the footer and include the route plus whether you were guest, opted out, opted in, or opening a public share.
