# ARCH-07 — Pages API wrapper contract

**Result: NO CHANGE runtime.**

The Pages Router layer is intentionally a thin compatibility adapter. Each public `pages/api/<name>.js`:

1. requires the same-named canonical CommonJS handler from `api/<name>.js`;
2. disables Next automatic body parsing with `bodyParser: false`;
3. exports that handler directly;
4. does not own response headers, cookies, request IDs, tracing or method logic.

This keeps body-size enforcement (including 413 behavior), JSON/raw-body parsing, cookies, method handling and observability in the canonical handler rather than duplicating them in Next wrappers.

ARCH-07 adds one inventory-based validator instead of a wrapper generator. A new public `api/*.js` handler now requires a same-named Pages wrapper and all wrappers are checked for the same contract.
