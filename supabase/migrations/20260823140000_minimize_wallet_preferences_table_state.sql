-- Keep only canonical cloud-owned table state in wallet_preferences.
-- linkedWalletAddress duplicates the wallet_preferences primary key.
update public.wallet_preferences
set table_state = coalesce(table_state, '{}'::jsonb) - 'linkedWalletAddress'
where coalesce(table_state, '{}'::jsonb) ? 'linkedWalletAddress';

-- Watchlists are owned by the dedicated watchlists column, not table_state.
update public.wallet_preferences
set table_state = coalesce(table_state, '{}'::jsonb)
  - 'watchlistPlayerIds'
  - 'watchlists'
  - 'currentWatchlistId'
where coalesce(table_state, '{}'::jsonb) ?| array[
  'watchlistPlayerIds',
  'watchlists',
  'currentWatchlistId'
];

-- recentSearchItems is the canonical mixed search history. Only remove the
-- legacy per-entity arrays when canonical mixed history is already present.
-- Legacy-only rows are intentionally left intact so the API can fold them into
-- recentSearchItems on the next authenticated save without losing history.
update public.wallet_preferences
set table_state = coalesce(table_state, '{}'::jsonb)
  - 'recentSearchPlayerIds'
  - 'recentSearchAgentWallets'
where jsonb_typeof(coalesce(table_state, '{}'::jsonb)->'recentSearchItems') = 'array';
