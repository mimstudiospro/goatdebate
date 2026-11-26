-- ================= GOAT Debate — subscription webhook column ==============
--
-- Run ONCE in the MAIN mimstudiospro project's SQL editor (Lovable Cloud:
-- Database > Manage > SQL editor). Do NOT run this on the retiring GOAT
-- project. Idempotent: safe to run again (ADD COLUMN IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS).
--
-- What this does:
--   * Adds stripe_subscription_id to public.subscriptions (created by
--     supabase/add-criteria.sql, section 6d). The main site's Stripe
--     webhook (src/routes/api/public/stripe-goat-subscriptions.ts) writes
--     it on every event, so later events — subscription updates, deletes,
--     invoice renewals and failures — can find the fan's row even though
--     those events carry no user id of their own. The upsert is still
--     keyed on user_id (one row per fan); this column is the lookup key
--     for the webhook, not a second identity.
--
-- What this does NOT do:
--   * It does NOT change any policy, grant, or function, and it does NOT
--     touch the browser: subscriptions stay unwritable from the client.
--     No email address and no live voter_token may ever appear in it.
--
-- The statements below are mirrored verbatim in supabase/schema.sql and
-- supabase/migrate-to-main-project.sql (the repo test asserts the two
-- files' SQL bodies are identical, and a second test asserts this
-- section 7 is mirrored in both).

-- 7a. The webhook records which Stripe subscription a row came from -------
alter table public.subscriptions
  add column if not exists stripe_subscription_id text;

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

-- Verification (run one at a time in the SQL editor):
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'subscriptions'
--   and column_name = 'stripe_subscription_id';
--   -- expect 1 row
-- select indexname from pg_indexes
--   where schemaname = 'public' and tablename = 'subscriptions'
--   and indexname = 'subscriptions_stripe_subscription_id_idx';
--   -- expect 1 row
-- select has_table_privilege('anon', 'public.subscriptions', 'SELECT'); -- expect false
