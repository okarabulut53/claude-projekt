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

## Page components have names; route files don't

Next.js requires the route file itself to be named exactly `page.tsx` — that's not negotiable, so
`app/page.tsx` and `app/(main)/dashboard/page.tsx` can't be renamed. Instead, the two top-level
pages have their actual content in a named component that the route file just re-exports:
`app/page.tsx` → `components/pages/Hauptseite.tsx`, `app/(main)/dashboard/page.tsx` →
`components/pages/Dashboardsite.tsx`. Keep following this split for any other page the user asks
to have a recognizable name — add the named component under `components/pages/`, keep the route's
`page.tsx` as a thin default-export wrapper.

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

## Data layer: live market data, mock fallback, and Supabase

Three separate data sources exist and shouldn't be confused:

- **`lib/market-data/*`** — real API clients for Finnhub (`finnhub.ts`: quotes, general/company
  news) and Twelve Data (`twelvedata.ts`: daily historical bars), both free-tier, plus a shared
  in-memory TTL cache (`cache.ts`) that all fetches must go through. `symbols.ts` maps this app's
  internal symbols to provider tickers **only for the instruments verified to have accurate free
  coverage**: US-listed stocks (SAP's NYSE ADR, NVDA, MSFT, TSLA, ASML) and crypto
  (`BINANCE:xUSDT` on Finnhub / `xUSD` on Twelve Data for BTC/ETH/SOL). Deliberately *not*
  live-wired: SIE/ALV/DTE (only trade OTC as ADRs with unverified conversion ratios — showing that
  price mislabeled as the XETRA share price would be misleading) and IUSA/EXW1/VWCE (UCITS ETFs
  aren't covered by either provider's free tier). Both free tiers are rate-limited (Finnhub: 60
  req/min; Twelve Data: 8 req/min, 800/day) — quotes are cached 60s, history 6h, general news 5min,
  company news 15min. `cached()` serves a stale value on fetch failure rather than throwing.
- **`lib/mock/*`** — stocks/ETFs/crypto, market indices, news, and AI Investment Opportunities.
  Deterministically generated (seeded PRNG in `lib/mock/random.ts`, keyed by symbol) so
  prices/history are stable across requests instead of randomizing on every render.
  `lib/mock/instruments.ts` is now the merge point: for each seed symbol it tries
  `lib/market-data` first (via `liveSymbols`) and falls back to the deterministic generator on any
  failure (missing API key, rate limit, unknown symbol) — every `Instrument` carries a
  `source: "live" | "simulated"` field so the UI can show which one it got
  (`components/ui/Badge.tsx`'s `DataSourceBadge`, used on the instrument detail page, search
  results, and opportunity cards). `lib/mock/opportunities.ts` and `getGeneralMarketNews()` /
  `getNewsForSymbols()` in `lib/mock/news.ts` follow the same live-with-mock-fallback pattern.
  Because instruments/opportunities/news now depend on `fetch`, **all of
  `getAllInstruments`/`getInstrument`/`searchInstruments`,
  `getAllOpportunities`/`getOpportunitiesForRiskProfile`/`getOpportunityForSymbol`, and
  `getGeneralMarketNews`/`getNewsForSymbols` are async** — every caller (dashboard, instrument
  detail page, search page, chat engine, portfolio price enrichment in `lib/db.ts`) awaits them.
  Market indices (`lib/mock/market.ts`, DAX/MDAX/S&P 500/Nasdaq 100) stay fully mock — index-level
  quotes require a paid Finnhub/Twelve Data plan.
- **Supabase** (`lib/supabase.ts`, `lib/db.ts`, `lib/database.types.ts`) — the only real
  persistent store, holding `app_users` (Clerk user id → risk profile, WhatsApp number, depot/
  onboarding status) and `portfolio_positions` (manually-entered positions; a `source` column
  already distinguishes `manual` from a future `depot` sync). Schema lives in
  `supabase/schema.sql` and must be applied manually via the Supabase SQL editor — there's no
  migration tooling. `getSupabaseAdmin()` uses the service-role key and is server-only; never
  import `lib/supabase.ts` from a Client Component.
- **`lib/mock/user-store.ts`** is a third, transitional piece: an in-memory fallback for
  `app_users`/`portfolio_positions` used automatically whenever `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` are unset (`isSupabaseConfigured()` in `lib/supabase.ts` gates it).
  Every function in `lib/db.ts` checks this first and delegates to the mock store instead of
  throwing, so the full authenticated flow (onboarding → dashboard → portfolio → chat) works
  before Supabase is ever configured. It persists to a gitignored `.data/mock-store.json` on every
  write (still single-machine, no concurrency safety — not a real database) specifically so
  onboarding state survives a dev-server restart instead of forcing the risk-profile gate in
  `app/(main)/layout.tsx` to re-trigger on every restart. Delete `.data/mock-store.json` to reset
  onboarding state on purpose. Once real Supabase credentials are added to `.env.local`, `lib/db.ts`
  switches to Postgres automatically; no code change needed. Don't add a third persistence path —
  extend `lib/db.ts`'s existing if/else instead.
- Portfolio "current price" is looked up live from `lib/mock/instruments.ts` by symbol
  (`lib/db.ts`'s `getPortfolioPositions`), not stored — so a position's gain/loss always reflects
  the mock market data's current price, not a stale snapshot.

## FinaraAI: the chatbot is an LLM call, but only via tool-calling

The landing chat experience after login (`/chat`, branded **FinaraAI**) calls the real Claude API
through `lib/finara-ai/client.ts` (`generateFinaraReply()`), using `CLAUDE_CHATBOT_API_KEY` /
`CLAUDE_CHATBOT_MODEL`. This still respects the hard requirement in `Proejkt.md`'s "Datenqualität
& Vertrauen im Chatbot" section: **every number in a chat reply must come 1:1 from a computed
value, never be generated by a language model.** Concretely: Claude is only allowed to produce the
conversational prose; every figure it states must come from a tool call defined in
`lib/finara-ai/tools.ts` (`get_portfolio_summary`, `get_opportunities`, `get_instrument`,
`explain_term`), each backed by the same deterministic functions as before
(`lib/portfolio-analysis.ts`, `lib/mock/opportunities.ts`, `lib/mock/instruments.ts`, the
`glossary` array now exported from `lib/chat-engine.ts`). The system prompt enforces the
chance/risk framing and reasoning/risks/assumptions disclosure rules from `Proejkt.md` as well.

The original rule-based engine (`lib/chat-engine.ts`'s `generateChatReply()`) is kept as the
**fallback**: `generateFinaraReply()` uses it whenever `CLAUDE_CHATBOT_API_KEY` is unset or the
Anthropic API call throws, mirroring the "serve a stale/mock value on failure" pattern already
used throughout `lib/market-data`. So the chat keeps working before the key is configured, and
degrades gracefully if the API is unavailable. If you extend FinaraAI's capabilities, add a new
tool in `lib/finara-ai/tools.ts` backed by a deterministic function — never let the model state a
number without calling a tool for it.

Chat threads/folders and messages persist through `lib/db.ts`
(`getChatThreads`/`createChatThread`/`getThreadMessages`/`appendChatMessage`/etc.), following the
same Supabase-with-mock-store-fallback split as `app_users`/`portfolio_positions` — see
`supabase/schema.sql`'s `chat_folders`/`chat_threads`/`chat_messages` tables and
`lib/mock/user-store.ts`'s mock equivalents.

## Environment variables

`.env.local` (gitignored) needs, beyond the Clerk keys already present:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from a Supabase project's API settings; schema in
  `supabase/schema.sql`. Without these, `lib/supabase.ts` throws at first use (landing/marketing
  pages still work; anything behind `(main)` or `/onboarding` does not).
- `FINNHUB_API_KEY`, `TWELVE_DATA_API_KEY` — enable live quotes/news (Finnhub) and historical
  charts (Twelve Data) for the symbols listed in `lib/market-data/symbols.ts`. Without these, every
  instrument silently falls back to `lib/mock`'s generated data — nothing throws, no code branches
  needed at the call site.
- `CLAUDE_CHATBOT_API_KEY`, `CLAUDE_CHATBOT_MODEL` — enable FinaraAI's real Claude API calls (see
  "FinaraAI" section above). Without a key, `generateFinaraReply()` falls back to the deterministic
  `lib/chat-engine.ts` engine — nothing throws.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_SIGN_IN_FALLBACK_REDIRECT_URL` /
  `_SIGN_UP_FALLBACK_REDIRECT_URL` — already set to point at the custom `/sign-in`, `/sign-up`
  pages and route new sign-ups into `/onboarding/whatsapp`.

## Styling

Design tokens (brand navy/teal, risk-level colors) are defined once in `app/globals.css` via
Tailwind v4's `@theme inline`, then used as utility classes (`bg-brand-teal`, `text-risk-high`,
etc.) — extend the palette there rather than hardcoding hex values in components. Charts
(`components/charts/`) are hand-rolled inline SVG, not a charting library — there was a deliberate
choice not to add a dependency for this. Illustrations follow the same no-dependency,
no-external-image approach: `components/icons/Icons.tsx` is a small hand-drawn stroke-icon set
(24x24 viewBox, `stroke="currentColor"`, sized/colored via the `IconTile` wrapper in
`components/ui/IconTile.tsx`), and `components/illustrations/HeroVisual.tsx` is the decorative
blob-shape + floating-chip wrapper used behind the landing page's hero card — both exist so the
landing page doesn't depend on hotlinked or licensed stock imagery.

**Z-index gotcha (already hit once, don't repeat it):** a `position: relative` wrapper with no
`z-index` of its own does **not** establish a new stacking context, so a child given a *negative*
z-index (e.g. `-z-10` for a decorative background shape) can end up painted behind unrelated
sibling sections instead of just behind its intended sibling — it becomes invisible. `HeroVisual`
avoids this by never using negative z-index: the decorative blob is plain `position: absolute`
with no z-index (default stacking, painted in DOM order), and only the foreground content gets a
positive `z-10`/`z-20`. Follow that pattern — DOM order + non-negative z-index — for any future
decorative/background element rather than reaching for `-z-*`.

**`className` overrides go through `cn()` (`lib/cn.ts`, wraps `tailwind-merge`), never raw string
concatenation.** Components that accept a `className` prop and merge it with their own base
classes (`Card`, `Button`/`ButtonLink`, `Container`, `DisclaimerNote`) all do
`cn(baseClasses, className)`. This was added after a real bug: `<Card className="bg-brand-navy
text-white">` in the landing page's closing CTA silently lost to `Card`'s own `bg-white` — with
plain template-string concatenation, Tailwind resolves conflicting utilities by each class's
position in the *generated stylesheet*, not by where it appears in the `className` string, and a
custom `@theme` color like `bg-brand-navy` isn't guaranteed to sort after a core color like
`bg-white`. It rendered as an invisible white-on-white card with no build or lint error. `cn()`
resolves same-property conflicts deterministically (last one wins) regardless of Tailwind's
internal ordering. Any new component with a base-classes-plus-`className` pattern should use it
too.
