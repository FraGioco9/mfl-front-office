# API-02 — Error envelope and retry policy

Issue: #1034  
Date: 2026-10-06

## Backward-compatible error envelope

JSON API errors retain the existing human-readable `error` field and add:

- `code`: stable machine-readable error code;
- `retryable`: whether the condition is transient in principle;
- `retryAfterSeconds`: present when the response has a positive numeric
  `Retry-After` header.

Example:

```json
{
  "error": "Too many requests.",
  "code": "rate_limited",
  "retryable": true,
  "retryAfterSeconds": 2
}
```

The response also exposes `X-MFL-Error-Code`, uses `Cache-Control: no-store`,
and adds an `api_error;dur=0` Server-Timing phase without overwriting existing
Server-Timing metrics.

Existing clients that only read `payload.error` continue to work.

### Default codes

| HTTP | Code | Default retryable |
| ---: | --- | --- |
| 400 | `invalid_request` | no |
| 401 | `authentication_required` | no |
| 403 | `forbidden` | no |
| 404 | `not_found` | no |
| 405 | `method_not_allowed` | no |
| 408 | `request_timeout` | yes |
| 409 | `conflict` | no |
| 413 | `payload_too_large` | no |
| 415 | `unsupported_media_type` | no |
| 422 | `validation_failed` | no |
| 429 | `rate_limited` | yes |
| 500 | `internal_error` | no |
| 502 | `bad_gateway` | yes |
| 503 | `service_unavailable` | yes |
| 504 | `gateway_timeout` | yes |

Domain endpoints can override the generic code and retryability. In particular,
the 50-plan / saved-evaluation limits use `capacity_exceeded` and
`retryable:false`: they are quota boundaries, not temporary throttling.

## No internal error leakage

The envelope never serializes an exception, stack, Supabase response body,
database query, wallet proof or other internal object.

The MFL season-ratio endpoint previously surfaced its caught exception message
in HTTP 500 responses. It now logs the internal exception server-side and returns
only `Could not load MFL season ratios.`.

## Client retry policy

The canonical `window.__mflDataClient` owns automatic retries.

Automatic retry is limited to **one additional attempt** and only for
**GET/HEAD** requests.

HTTP retry statuses:

- 408
- 429
- 502
- 503
- 504

Rules:

- `409` conflicts are never retried;
- POST/PATCH/PUT/DELETE are never automatically retried;
- caller aborts and canonical timeouts are never retried;
- when the browser reports `navigator.onLine === false`, network failures are
  returned immediately;
- ordinary online network failures may retry once;
- a numeric or HTTP-date `Retry-After` is honored when the delay is at most
  five seconds;
- longer server-advised waits are returned immediately to the feature/UI instead
  of blocking the request for a long hidden retry;
- without `Retry-After`, transient GET/HEAD retry uses a 250 ms delay.

This policy avoids duplicate mutation side effects while giving idempotent reads
one bounded recovery attempt.

## Duplicate requests

Existing explicit GET dedupe remains authoritative. When two callers request the
same deduped GET, they share one transport promise including its retry sequence.
A transient response therefore produces at most one shared retry, not one retry
per caller.

## Timing and diagnostics

Retries emit both:

- `recordClientTiming("data-retry", ...)`;
- `mfl:data-client-retry` browser event.

The fields are request key/URL, method, attempt number, delay, status when
available, and reason (`http` or `network`). They contain no response body,
wallet, payload or exception message.

Final `data-response` timing includes the attempt count.

## Gradual compatibility

JSON handlers installed with `installApiErrorEnvelope()` immediately gain the
new contract. Data/Identity-style handlers that use the canonical
`api/_data-auth.js::sendJson()` are normalized through the same helper.

Non-JSON image/HTML preview endpoints are not forced into a JSON envelope.

## Regression coverage

`tests/test_api02_error_retry.mjs` covers:

- legacy `error` compatibility;
- stable code + retryable + Retry-After fields;
- Server-Timing/error-code headers;
- 429 short Retry-After retry;
- 409 no retry;
- POST network failure no retry;
- known offline no retry;
- caller abort no retry;
- duplicate GET sharing one retry sequence;
- upstream/internal error non-leak.

No Vercel deployment, database refresh or Supabase mutation is required for
API-02.
