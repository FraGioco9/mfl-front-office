# Security response and abuse boundaries

Part of #969.

## Browser response headers

`next.config.mjs` owns the application-wide browser security headers. They apply to the shell, static application assets and API responses through one `/:path*` rule, independently from route-specific cache policy.

The explicit application headers are:
- `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`
- `Permissions-Policy: camera=(), geolocation=(), microphone=()`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

This intentionally limits only capabilities the application does not use. The CSP protects framing, base-URL rewriting and legacy object embedding without constraining the existing inline/runtime script model or external MFL/Flow resources.

A full `script-src`/style/connect/image CSP is not introduced in this slice because the current compatibility shell still contains inline runtime code and loads Flow/Dapper/MFL resources from multiple explicit origins. Tightening those directives should happen only after nonce/hash/origin ownership is designed and browser-tested.

`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` are intentionally not set by the application because the current Dapper/Flow authentication path can use popup/RPC and third-party resources. Those policies require dedicated wallet-flow verification before adoption.

Strict transport policy remains deployment/platform configuration rather than an application-level duplicate. The application does not attempt to infer custom-domain/HSTS ownership from request headers.

## Endpoint abuse review

The current write boundaries were rechecked against their actual persistence and authentication models.

### Wallet authentication

`/api/wallet-session` is already the strongest boundary:
- 32 KiB exchange body cap;
- same-origin requirement for exchange/logout;
- bounded per-instance issuance/exchange/logout buckets;
- five-minute signed challenge;
- browser-binding cookie;
- durable atomic one-time nonce consumption;
- seven-day hashed-token session;
- no-store responses.

This endpoint should continue to fail closed. Infrastructure rate limiting can be added independently if traffic warrants it.

### Bug reports

`/api/bug-reports` has:
- 32 KiB body cap;
- strict field-length validation;
- durable reporter hashing;
- five submissions per rolling hour per reporter hash;
- private service-role-only storage;
- no-store responses.

The durable Supabase check is appropriate for a serverless deployment and is stronger than a process-local-only bucket for this endpoint.

### Saved Evaluations

`/api/evaluation-save` requires an authenticated wallet, caps the body at 256 KiB, scopes every read/write/delete to that wallet and limits new saves to 100 per wallet. Overwriting an existing save does not consume another slot.

No additional process-local rate limiter is added because the durable per-wallet object cap is the actual storage-abuse boundary.

### Shared Evaluations

`/api/evaluation-share` requires an authenticated wallet for creation, caps the body at 256 KiB and gives every share a mandatory one-year expiry. Public reads expose only validated active shares.

Shares remain intentionally unlimited per wallet because independent long-lived share links are current product behavior. This slice does not silently change that behavior by adding an arbitrary quota. If production evidence shows persistent share-storage abuse, the appropriate control is a durable per-wallet creation/quota policy rather than a process-local serverless counter.

### Wallet preferences and opt-in

`/api/wallet-preferences` requires a server session, caps writes at 512 KiB, normalizes bounded watchlist/note/settings structures and applies writes through the atomic service-role RPC.

`/api/wallet-opt-ins` requires the verified session identity and writes only server-owned presence data; it accepts no user JSON body.

No separate rate limiter is added to either endpoint in this review because they are authenticated, scoped writes with bounded payload/state ownership. A platform-level authenticated-request limiter remains available if production traffic shows a need.

## Review rule

Add endpoint-specific throttling when it protects a real scarce resource or unauthenticated boundary. Prefer durable counters/quotas when the resource itself is durable; do not rely on in-memory serverless buckets as the sole protection for persistent storage.

Security headers and abuse controls must remain independent from cache policy, authentication identity and business limits so one concern cannot accidentally weaken another.
