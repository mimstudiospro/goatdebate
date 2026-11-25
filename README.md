# GOAT Debate

Settle it. Vote for your GOAT.

A mobile-first voting app: 9 launch debates (Messi vs Ronaldo, Jordan vs
LeBron, Brady vs Montana, Ali vs Tyson, Federer vs Nadal, Serena Williams
vs Steffi Graf, Hamilton vs Schumacher, Woods vs Nicklaus, Pelé vs
Maradona). One vote per browser per debate — change your mind anytime.
Live results, percentages, and a share link per debate.

No sign-in, no comments, no ads in v1. English only.

## Stack

Vite + React 19 + TypeScript + Tailwind v4 (plain Vite SPA, hash routing).
Votes live in Supabase (Lovable Cloud) via the `cast_vote` RPC.

## Run

```sh
npm install
npm run dev
```

## Database

Apply `supabase/schema.sql` once in the Lovable Cloud SQL editor. It creates
`debates`, `contenders`, `votes`, the RLS policies, the `cast_vote` RPC
(SECURITY DEFINER, `SET search_path = ''`), and seeds the 9 debates.

## Configure

Copy `.env.example` to `.env` and fill in the Lovable Cloud values:

```sh
VITE_SUPABASE_URL=https://your-project.lovable.cloud
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Without them the app still runs and shows the debates, with voting disabled
and a plain line saying voting opens once the database is connected.

## Test

```sh
npm test
```
