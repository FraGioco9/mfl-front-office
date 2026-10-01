-- SEC-01 (#1034): pin the trigger function's search_path without modifying its body.
-- The only referenced routine, now(), resolves via the implicit pg_catalog schema.
alter function public.set_updated_at() set search_path = '';
