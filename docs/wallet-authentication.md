# Wallet authentication

Part of #969.

The active authentication boundary is split across:
- `site/api/_wallet-challenge.js` — signed five-minute server challenges;
- `site/api/_wallet-proof.js` — Flow account-proof/user-signature verification;
- `site/api/_wallet-session.js` — durable one-time nonce consumption and seven-day sessions;
- `site/api/_wallet-auth.js` — session-cookie authentication for protected API consumers;
- `site/api/wallet-session.js` — browser challenge issuance, proof exchange, and logout.

## Deployment configuration

Set `WALLET_CHALLENGE_SECRET` to a dedicated random 32-byte hexadecimal value (64 hex characters)
for every deployed environment that supports wallet opt-in. Do not reuse the Supabase service-role key
or another application secret. The endpoint fails closed with 503 if the challenge service cannot be
created.

The challenge origin is server-configured. `WALLET_CHALLENGE_ORIGIN` may explicitly set the exact
public application origin; otherwise Vercel deployments use `VERCEL_URL`. Request Host/forwarded-host
metadata is not trusted for deployed origins. Only localhost/loopback development may derive the origin
from the incoming request. If production is served from a custom domain different from `VERCEL_URL`,
set `WALLET_CHALLENGE_ORIGIN` to that exact HTTPS origin.

## Verified identity boundary

Authorization is always the verified Flow account. Client-provided wallet headers cannot establish a
relationship between different wallets.

Account proofs are verified against the claimed Flow account, the challenge application identifier, and
the exact server-issued nonce. FCL verifies account-proof keys against that explicit account address;
individual account-proof signatures need not repeat the address.

User-message proofs sign the challenge-specific message, which includes the trusted origin, random nonce,
issue time, and expiry. Every supplied user-message signature must identify the authorized wallet.

Only a literal `true` from the selected FCL verifier grants access. False/unexpected results, verifier
exceptions, or an unavailable SDK deny authentication.

## Challenge and browser binding

`GET /api/wallet-session` creates:
- a random 32-byte challenge nonce;
- a separate random 32-byte browser binding;
- an HMAC-authenticated challenge envelope with a fixed five-minute lifetime.

Only a digest of the browser binding appears in the challenge token. The raw binding is stored in an
HttpOnly, SameSite=Strict cookie scoped to `/api/wallet-session`; it is never returned in JSON.
Production HTTPS responses add `Secure`.

The public response contains only the signed challenge token, nonce, Flow application identifier,
challenge-specific user-signature message, and expiry.

## Proof exchange and replay protection

`POST /api/wallet-session` requires a same-origin request, bounded request body, valid browser binding,
valid unexpired challenge, and valid Flow proof for that exact challenge.

A successful proof is handed to `consumeChallengeAndCreateSession`. Supabase atomically:
1. rechecks challenge expiry against the database clock;
2. claims the unique challenge nonce;
3. creates the wallet session in the same transaction.

Concurrent or repeated exchange of the same nonce can therefore create at most one session across
server instances.

The server returns the raw random session token only in an HttpOnly, SameSite=Strict cookie with a
seven-day lifetime (and `Secure` on HTTPS). Supabase stores only its SHA-256 hash, wallet identity,
timestamps, and revocation state.

## Protected API authentication

Protected wallet consumers authenticate only through `site/api/_wallet-auth.js`, which resolves the
session cookie server-side. Legacy `x-wallet-*` / `x-dapper-wallet-address` proof headers are no
longer an authorization fallback.

Current consumers include data ownership/progression reads, wallet permissions and opt-in presence,
wallet preferences, saved/shared Evaluation writes, and optional wallet attribution for bug reports.

The browser helper `walletProofHeaders()` remains temporarily as a compatibility call-site shim but
returns an empty object. Authentication transport is the cookie.

## Browser persistence and migration

After a successful exchange, local storage keeps only a non-authorizing `type: "session"` marker with
the linked wallet address. Flow signatures and challenge material are not persisted.

Startup restores only this session marker. Any legacy stored proof is cleared and requires a one-time
Dapper re-link. The startup wallet-preferences request then validates the server session; a 401 clears
the local linked state and returns the UI to opted-out behavior.

This means a copied local-storage marker cannot authenticate API requests, and an expired/revoked/missing
cookie cannot be replaced by an old signed proof.

## Logout and revocation

Explicit Opt Out calls `DELETE /api/wallet-session` before clearing local linked state. The endpoint
revokes the durable session by hashed token and clears both session and challenge cookies.

Expired/revoked sessions are never returned by the session resolver. Stale browser markers are removed
when startup hydration receives 401.

## Abuse and request boundaries

The wallet-session endpoint has:
- a 32 KiB exchange request limit;
- same-origin enforcement for state-changing exchange/logout requests;
- bounded per-instance issuance/exchange/logout rate buckets;
- no-store response caching;
- bounded challenge lifetime and one-time durable consumption.

These controls complement platform-level protections; they do not replace infrastructure rate limiting
if production traffic later warrants it.

## Regression coverage

The API/persistence validation domain covers:
- verified identity binding and verifier failure;
- challenge tamper/origin/browser-binding/expiry behavior;
- durable single-use nonce consumption, cross-instance races, expiry recheck, token hashing, session
  resolution and revocation;
- active challenge issuance/exchange/session-cookie/logout behavior;
- legacy-proof retirement and session-only consumer ownership;
- stale-session startup invalidation and non-authorizing local session markers.

Manual testing for this PR should still cover a real Dapper account-proof/user-signature flow, reload
restoration, private pages/preferences, and Opt Out in the deployed preview with
`WALLET_CHALLENGE_SECRET` configured.
