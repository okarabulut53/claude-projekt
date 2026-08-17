# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**finara** — an AI investment intelligence platform (German-market focus) that analyzes stocks,
ETFs, and cryptocurrencies and surfaces AI-scored investment opportunities. The full product
concept (onboarding journey, non-negotiable principles, scoring model, data model, MVP scope) is
documented in `Proejkt.md` (note the filename typo — not `Projekt.md`) — read it before making
product/feature decisions. Two rules from there matter most for how code gets written:

- **No autonomous trading, ever.** No feature or API route may execute a buy/sell order. Depot
  integrations are strictly read-only.
- **No guaranteed-return language.** UI copy and generated analysis text must use
  chance/risk framing ("attraktives Chancen/Risiko-Verhältnis"), never promises ("wird steigen",
  "du wirst X% Gewinn machen"). See the Formulierungsregeln table in `Proejkt.md`.
- Every AI Investment Score / recommendation must show its reasoning, its risks, and the
  assumptions behind it — never a bare score.

## Commands

```bash
npm run dev      # start dev server (Turbopack) at localhost:3000
npm run build    # production build — also runs the TypeScript check
npm run start    # run a production build
npm run lint     # eslint
npx tsc --noEmit # type-check only, faster than a full build
```

There is no test suite configured yet.

## Breaking-changes warning (read this first)

This repo pins **Next.js 16**, which the auto-generated `AGENTS.md` block above warns has
API/convention changes not reflected in most models' training data. Two that already bit this
codebase:

- Middleware is called **`proxy.ts`** (project root), not `middleware.ts`. Same `clerkMiddleware`
  API, new filename.
- Clerk is on **Core 3**: `<SignedIn>`, `<SignedOut>`, and `<Protect>` are removed and throw at
  the type level. Use `<Show when="signed-in">` / `<Show when="signed-out">` / `<Show when={{...}}>`
  instead (see `components/layout/PublicHeader.tsx` and `app/page.tsx` for the pattern). `auth`
  and `currentUser` come from `@clerk/nextjs/server`, not `@clerk/nextjs`.

Before touching routing, Clerk, fonts, or Server Actions/Functions, check
`node_modules/next/dist/docs/` for the current convention rather than relying on prior Next.js
knowledge — the docs snapshot there is this exact version's source of truth.

## Auth & route protection

Route protection is **resource-based**, not middleware-based. `createRouteMatcher` +
per-path middleware checks are deprecated by Clerk in favor of calling `auth.protect()` directly
in the layout/action that needs it (Clerk's stated reason: middleware path-matching can drift out
of sync with how Next.js actually routes requests). Concretely:

- `proxy.ts` only calls `clerkMiddleware()` with no route matching logic — it exists solely to
  make Clerk's auth context available.
- `lib/current-user.ts` exports `requireUserId()` (calls `auth.protect()`) and `requireAppUser()`
  (also bootstraps/fetches the Supabase `app_users` row). Every protected layout and every Server
  Action calls one of these itself rather than trusting middleware to have already gated the
  request — Server Actions are POST endpoints reachable independently of the page that renders
  the trigger form, so each one re-checks auth.
- When adding a new protected route or action, follow this pattern rather than adding a path to a
  matcher list.

## Route groups and the onboarding gate

- `app/(main)/` — the authenticated app shell (`dashboard`, `portfolio`, `search`,
  `instrument/[symbol]`, `chat`, `settings`). Its `layout.tsx` calls `requireAppUser()` and
  **redirects to `/onboarding/whatsapp` if `riskProfile` is null** — risk profile is the one
  mandatory onboarding step per the product spec. Don't bypass this check when adding pages here.
- `app/onboarding/` — the (WhatsApp → Depot → Risikoprofil) wizard, outside the `(main)` shell
  chrome. Its own `layout.tsx` only requires auth, not a completed profile (it's how you complete
  one).
- Both route groups sit directly under `app/`, not nested inside a shared `(app)` group — that's
  intentional, so the URL for onboarding stays `/onboarding/...` rather than picking up an extra
  segment.

## Data layer: mock market data vs. Supabase

Two separate data sources exist and shouldn't be confused:

- **`lib/mock/*`** — stocks/ETFs/crypto, market indices, news, and AI Investment Opportunities.
  All deterministically generated (seeded PRNG in `lib/mock/random.ts`, keyed by symbol) so
  prices/history are stable across requests instead of randomizing on every render. This stands
  in for a future real market-data/news/LLM-scoring provider — when wiring one in, replace the
  functions in `lib/mock/instruments.ts` / `market.ts` / `news.ts` / `opportunities.ts` and the
  rest of the app (which only calls their exported functions) shouldn't need to change.
- **Supabase** (`lib/supabase.ts`, `lib/db.ts`, `lib/database.types.ts`) — the only real
  persistent store, holding `app_users` (Clerk user id → risk profile, WhatsApp number, depot/
  onboarding status) and `portfolio_positions` (manually-entered positions; a `source` column
  already distinguishes `manual` from a future `depot` sync). Schema lives in
  `supabase/schema.sql` and must be applied manually via the Supabase SQL editor — there's no
  migration tooling. `getSupabaseAdmin()` uses the service-role key and is server-only; never
  import `lib/supabase.ts` from a Client Component.
- Portfolio "current price" is looked up live from `lib/mock/instruments.ts` by symbol
  (`lib/db.ts`'s `getPortfolioPositions`), not stored — so a position's gain/loss always reflects
  the mock market data's current price, not a stale snapshot.

## The chatbot is not an LLM call

`lib/chat-engine.ts` is deliberately rule-based/deterministic, not a Claude API call — no
`ANTHROPIC_API_KEY` is wired up. This mirrors a hard requirement in `Proejkt.md`'s
"Datenqualität & Vertrauen im Chatbot" section: **every number in a chat reply must come 1:1 from
a computed value, never be generated by a language model.** `generateChatReply()` computes
portfolio stats via `lib/portfolio-analysis.ts` and picks a response by pattern-matching the
message, falling back to an explicit "I don't have reliable data for that" rather than guessing.
If a real LLM is later wired in for the chatbot or for opportunity reasoning text, preserve this
split: deterministic calculation stays in `lib/`, the model only turns already-computed data into
prose (tool-calling against the app's own data, not free-form number generation).

## Environment variables

`.env.local` (gitignored) needs, beyond the Clerk keys already present:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from a Supabase project's API settings; schema in
  `supabase/schema.sql`. Without these, `lib/supabase.ts` throws at first use (landing/marketing
  pages still work; anything behind `(main)` or `/onboarding` does not).
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_SIGN_IN_FALLBACK_REDIRECT_URL` /
  `_SIGN_UP_FALLBACK_REDIRECT_URL` — already set to point at the custom `/sign-in`, `/sign-up`
  pages and route new sign-ups into `/onboarding/whatsapp`.

## Styling

Design tokens (brand navy/teal, risk-level colors) are defined once in `app/globals.css` via
Tailwind v4's `@theme inline`, then used as utility classes (`bg-brand-teal`, `text-risk-high`,
etc.) — extend the palette there rather than hardcoding hex values in components. Charts
(`components/charts/`) are hand-rolled inline SVG, not a charting library — there was a deliberate
choice not to add a dependency for this.
