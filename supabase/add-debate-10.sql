-- ================= GOAT Debate — add debate #10 ==========================
--
-- Run ONCE in the Supabase SQL editor on a database that already has
-- the other 9 debates (schema.sql v1). Idempotent: safe to run again
-- (ON CONFLICT DO NOTHING).
--
-- Adds: Beyoncé vs Taylor Swift (Pop Music) + both contenders.
-- Taglines use only established public facts (grammy.com):
--   Beyoncé — 35× Grammy winner (the most of any artist, ever)
--   Taylor Swift — 14× Grammy winner (a record 4× Album of the Year)
-- Fixed UUIDs match src/lib/debates.ts exactly.

insert into public.debates (id, slug, title, sport) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'beyonce-vs-taylor-swift', 'Beyoncé vs Taylor Swift', 'Pop Music')
on conflict (slug) do nothing;

insert into public.contenders (id, debate_id, name, tagline, sort_order) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Beyoncé', '35× Grammy winner', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Taylor Swift', '14× Grammy winner', 2)
on conflict (id) do nothing;

-- Verification (run one at a time in the SQL editor):
-- select count(*) from public.debates;        -- expect 10
-- select count(*) from public.contenders;     -- expect 20
-- select slug, title, sport from public.debates where slug = 'beyonce-vs-taylor-swift';
-- select name, tagline from public.contenders where debate_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by sort_order;
