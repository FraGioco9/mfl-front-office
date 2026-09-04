update public.evaluation_shares
set expires_at = created_at + interval '1 year'
where expires_at is distinct from created_at + interval '1 year';
