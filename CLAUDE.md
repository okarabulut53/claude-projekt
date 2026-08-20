# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**finara** — an AI investment intelligence platform (German-market focus) that analyzes stocks,
ETFs, and cryptocurrencies and surfaces AI-scored investment opportunities. The full product
concept (onboarding journey, non-negotiable principles, scoring model, data model, MVP scope) is
documented in `Proejkt.md` (note the filename typo — not `Projekt.md`) — read it before making
product/feature decisions. Three rules from there matter most for how code gets written:

- **No autonomous trading, ever.** No feature or API route may execute a buy/sell order. Depot
  integrations are strictly read-only.
- **No guaranteed-return language.** UI copy and generated analysis text must use
  chance/risk framing ("attraktives Chancen/Risiko-Verhältnis"), never promises ("wird steigen",
  "du wirst X% Gewinn machen"). See the Formulierungsregeln table in `Proejkt.md`.
- **Every AI Investment Score / recommendation must show its reasoning, its risks, and the
  assumptions behind it** — never a bare score.

## Commands

```bash
npm run dev      # start dev server (Turbopack) at localhost:3000
npm run build    # production build — also runs the TypeScript check
npm run start    # run a production build
npm run lint     # eslint
npm test         # vitest run — the full unit-test suite (see "Testing" below)
npx tsc --noEmit # type-check only, faster than a full build
```

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
`app/page.tsx` and `app/(main)/dashboard/page.tsx` can't be renamed. Instead, several top-level
pages have their actual content in a named component under `components/pages/` that the route
file just re-exports: `app/page.tsx` → `Hauptseite.tsx`, `app/(main)/dashboard/page.tsx` →
`Dashboardsite.tsx`, `app/(main)/watchlist/page.tsx` → `Watchlistsite.tsx`,
`app/(main)/erste-schritte/page.tsx` → `ErsteSchrittesite.tsx`. Keep following this split for any
other page the user asks to have a recognizable name — add the named component under
`components/pages/`, keep the route's `page.tsx` as a thin default-export wrapper. Routes whose
content is naturally driven by server data fetching + a single feature component (e.g.
`app/(main)/finaraai/page.tsx` composing `ChatShell`) skip this pattern and fetch/compose directly
in the route file — the split exists to give a *page* a name, not to wrap every route.

## Route groups and the onboarding gate

- `app/(main)/` — the authenticated app shell (`dashboard`, `portfolio`, `search`, `watchlist`,
  `instrument/[symbol]`, `finaraai` (the FinaraAI chat, branded in the URL as `finaraai` rather
  than `chat`), `erste-schritte`, `settings`). Its `layout.tsx` calls `requireAppUser()` and
  **redirects to `/onboarding/whatsapp` if `riskProfile` is null** — risk profile is the one
  mandatory onboarding step per the product spec. Don't bypass this check when adding pages here.
- `app/onboarding/` — the (WhatsApp → Depot → Risikoprofil) wizard, outside the `(main)` shell
  chrome. Its own `layout.tsx` only requires auth, not a completed profile (it's how you complete
  one).
- Both route groups sit directly under `app/`, not nested inside a shared `(app)` group — that's
  intentional, so the URL for onboarding stays `/onboarding/...` rather than picking up an extra
  segment.
- `app/api/chart/[symbol]/route.ts` is the one plain API route — it backs the interactive
  instrument chart's interval switcher (`lib/chart-client.ts`'s `fetchChartData()`) since that
  needs to be called client-side on demand, unlike everything else which goes through Server
  Actions in `lib/actions/*`.

## Data layer: live market data, mock fallback, and Supabase

Three separate data sources exist and shouldn't be confused:

- **`lib/market-data/*`** — real API clients for Finnhub (`finnhub.ts`: quotes, general/company
  news, analyst recommendation trends) and Twelve Data (`twelvedata.ts`: daily historical bars),
  both free-tier, plus a shared in-memory TTL cache (`cache.ts`) that all fetches must go through.
  `symbols.ts` maps this app's internal symbols to provider tickers **only for the instruments
  verified to have accurate free coverage**: US-listed stocks (SAP's NYSE ADR, NVDA, MSFT, TSLA,
  ASML) and crypto (`BINANCE:xUSDT` on Finnhub / `xUSD` on Twelve Data for BTC/ETH/SOL).
  Deliberately *not* live-wired: SIE/ALV/DTE (only trade OTC as ADRs with unverified conversion
  ratios — showing that price mislabeled as the XETRA share price would be misleading) and
  IUSA/EXW1/VWCE (UCITS ETFs aren't covered by either provider's free tier). Both free tiers are
  rate-limited (Finnhub: 60 req/min; Twelve Data: 8 req/min, 800/day) — quotes are cached 60s,
  history 6h, general news 5min, company news 15min. `cached()` serves a stale value on fetch
  failure rather than throwing. `rateLimitQueue.ts` is a second, separate layer on top: a FIFO
  queue (`runTwelveDataRateLimited()`) that throttles *every* Twelve Data call in the process to
  8/min regardless of how many concurrent callers/users there are — `cached()` alone only
  prevents repeat calls for the *same* cache key, not concurrent calls for different symbols. It
  also tracks a daily request counter for Financial Modeling Prep (`reserveFmpDailyRequest()`,
  250/day free tier, UTC calendar day) — see "FinaraAI" below for why that one throws instead of
  returning a boolean.
- **`lib/data-providers/fmp.ts`** — Financial Modeling Prep client for fundamentals data (KGV,
  PEG, KUV, Verschuldungsgrad, Dividendenrendite, freier Cashflow je Aktie, EPS,
  Marktkapitalisierung, Sektor, Analysten-Konsensschätzungen). Separate from `lib/market-data/*`
  because its coverage axis is different: `hasFundamentalsCoverage()` gates on a much narrower,
  empirically-verified symbol set (currently NVDA/MSFT/TSLA only — see the file's own comment for
  why SAP/ASML, which *do* have live price data, don't qualify) and its cache TTL is 6h instead of
  the 60s–15min tiers `lib/market-data` uses, since fundamentals don't move minute-to-minute.
- **`lib/mock/*`** — stocks/ETFs/crypto, market indices, news, and AI Investment Opportunities.
  Deterministically generated (seeded PRNG in `lib/mock/random.ts`, keyed by symbol) so
  prices/history are stable across requests instead of randomizing on every render.
  `lib/mock/instruments.ts` is now the merge point: for each seed symbol it tries
  `lib/market-data` first (via `liveSymbols`) and falls back to the deterministic generator on any
  failure (missing API key, rate limit, unknown symbol) — every `Instrument` carries a
  `source: "live" | "simulated"` field so the UI can show which one it got
  (`lib/data-source.ts`'s `getDataSourceInfo()`, used by `components/ui/Badge.tsx`'s
  `DataSourceBadge` on the instrument detail page, search results, and opportunity cards).
  `lib/mock/opportunities.ts` and `getGeneralMarketNews()` / `getNewsForSymbols()` in
  `lib/mock/news.ts` follow the same live-with-mock-fallback pattern. Because
  instruments/opportunities/news depend on `fetch`, **all of
  `getAllInstruments`/`getInstrument`/`searchInstruments`,
  `getAllOpportunities`/`getOpportunitiesForRiskProfile`/`getOpportunityForSymbol`, and
  `getGeneralMarketNews`/`getNewsForSymbols` are async** — every caller awaits them. Market
  indices (`lib/mock/market.ts`, DAX/MDAX/S&P 500/Nasdaq 100) stay fully mock — index-level quotes
  require a paid Finnhub/Twelve Data plan.
- **Supabase** (`lib/supabase.ts`, `lib/db.ts`, `lib/database.types.ts`) — the only real
  persistent store, holding `app_users` (Clerk user id → risk profile, WhatsApp number, depot/
  onboarding status), `portfolio_positions` (manually-entered positions; a `source` column already
  distinguishes `manual` from a future `depot` sync), `watchlist_items`, and
  `chat_folders`/`chat_threads`/`chat_messages` for FinaraAI. Schema lives in `supabase/schema.sql`
  and must be applied manually via the Supabase SQL editor — there's no migration tooling.
  `getSupabaseAdmin()` uses the service-role key and is server-only; never import
  `lib/supabase.ts` from a Client Component.
- **`lib/mock/user-store.ts`** is a third, transitional piece: an in-memory fallback for all of
  the above tables, used automatically whenever `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are
  unset (`isSupabaseConfigured()` in `lib/supabase.ts` gates it). Every function in `lib/db.ts`
  checks this first and delegates to the mock store instead of throwing, so the full authenticated
  flow (onboarding → dashboard → portfolio → watchlist → chat) works before Supabase is ever
  configured. It persists to a gitignored `.data/mock-store.json` on every write (still
  single-machine, no concurrency safety — not a real database) specifically so onboarding state
  survives a dev-server restart instead of forcing the risk-profile gate in `app/(main)/layout.tsx`
  to re-trigger on every restart. Delete `.data/mock-store.json` to reset onboarding state on
  purpose. Once real Supabase credentials are added to `.env.local`, `lib/db.ts` switches to
  Postgres automatically; no code change needed. Don't add a third persistence path — extend
  `lib/db.ts`'s existing if/else instead.
- Portfolio "current price" is looked up live from `lib/mock/instruments.ts` by symbol
  (`lib/db.ts`'s `getPortfolioPositions`), not stored — so a position's gain/loss always reflects
  the mock market data's current price, not a stale snapshot.

## Charting: two different renderers for two different purposes

Don't assume one charting approach covers the whole app — there are three, deliberately kept
separate:

- **The main interactive instrument chart** (`components/instrument/InstrumentChart.tsx` →
  `components/charts/ChartWorkspace.tsx` + `CandlestickChart.tsx`, ~1900 lines) is built on the
  **`lightweight-charts`** npm package (TradingView's library) — candles, drawing tools
  (`chartDrawings.ts`), indicator overlays (`IndicatorLegendRow.tsx`, `IndicatorStylePopover.tsx`),
  and persisted chart settings (`chartSettings.ts`, `ChartSettingsDialog.tsx`) all sit on top of
  it. Interval switching goes through `lib/chart-client.ts`'s `fetchChartData()` calling
  `app/api/chart/[symbol]/route.ts`.
- **Small inline previews** (`components/charts/Sparkline.tsx`, `LineChart.tsx` — dashboard cards,
  opportunity cards, compact instrument summaries) are still hand-rolled inline SVG, no
  dependency, by deliberate choice for that lightweight use case.
- **The chat-attachment chart image** (`lib/chart-image.ts`'s `renderChartImage()`) rasterizes
  price history to a PNG via the Canvas API (not SVG, not `lightweight-charts`) specifically
  because it needs a `data:image/png;base64,...` payload to send to Claude's vision API as a chat
  attachment — see "FinaraAI" below for when it's actually attached.

Don't reach for a fourth charting approach without a reason one of these three doesn't cover.

## FinaraAI: the chatbot is an LLM call, but only via tool-calling

The chat experience after login (`/finaraai`, branded **FinaraAI**, `components/chat/ChatShell.tsx`
composing the thread sidebar/chat panel/watchlist panel/resizable chart panel) calls the real
Claude API through `lib/finara-ai/client.ts`'s `generateFinaraReply()`, using
`CLAUDE_CHATBOT_API_KEY` / `CLAUDE_CHATBOT_MODEL`. This respects the hard requirement in
`Proejkt.md`'s "Datenqualität & Vertrauen im Chatbot" section: **every number in a chat reply must
come 1:1 from a computed value, never be generated by a language model.** Claude only produces
conversational prose and tool calls; every figure it states must come from a tool call.

**Two tool categories**, both defined in `lib/finara-ai/tools.ts`:

- **Data tools** (`financeTools`, routed through `runFinanceTool()`): `get_portfolio_summary`,
  `get_opportunities`, `get_instrument`, `get_analysis` (real momentum/risk/technical/volume/
  sentiment/analystConsensus scores per instrument, computed by `lib/analysis/*` +
  `lib/strategy/*`, cached 90s per symbol), `get_ranking` (scores a candidate list, or the user's
  watchlist with `watchlistOnly=true`), `explain_term`, `get_market_overview`, `get_news`,
  `get_watchlist`, `get_fundamentals` (Financial Modeling Prep — see the "Data layer" section
  above for its coverage gate), and `export_analysis` (turns the last structured analysis in the
  conversation into a downloadable CSV/DOCX/PPTX via `lib/finara-ai/export.ts`, terminal on
  success: `client.ts` returns the file's data URL directly instead of routing it back through the
  model).
- **Presentation tools** (`presentationTools`, defined in `client.ts` + `tools.ts`): terminal,
  structured-output-only tool calls — `present_market_analysis`, `present_score_analysis`,
  `present_ranking`, `present_swot_analysis`, `present_bull_bear_analysis`,
  `present_market_overview`, `present_news_summary`, `present_watchlist_overview`,
  `present_fundamentals_analysis`. Each renders as a dedicated chat card
  (`components/chat/*Card.tsx`) instead of prose, parsed out of the tool-call JSON by
  `components/chat/structuredMessage.ts`'s `parseStructuredMessage()` (which also recovers from
  the model occasionally writing the JSON as plain text with trailing prose instead of a real
  `tool_use` block — see that file's doc comment for the observed-live bug it guards against).

**The regression that already happened once, and how it's guarded against:** a presentation tool
added to `presentationTools` without a matching entry in `client.ts`'s `presentationTypes` map
silently falls through to `runFinanceTool`'s "Unbekanntes Tool." fallback instead of rendering a
card — `client.test.ts`'s `describe("presentationTypes / presentationTools stay in sync", ...)`
asserts every tool in one array has a matching entry in the other, in both directions. **Any new
`present_*` tool must be added to both** `presentationTools` and `presentationTypes` in one commit
— the test catches the omission without needing a live API call.

**Structured output must survive follow-up questions too — another live-observed inconsistency,
now guarded.** Early on, a follow-up like "wieso MSFT?" after a `present_ranking` card got answered
in prose (RSI/ADX/SMA etc. as a paragraph) instead of the same `present_score_analysis` card a
direct single-instrument analysis gets — and a score request with no recognizable ticker
("analysiere mit score") fell all the way through to `chat-engine.ts`'s fixed fallback sentence
instead of the real Claude path asking a clarifying question. `buildSystemPrompt()` now has two
rules for this: "Strukturierte Ausgabe ist verpflichtend, auch bei Anschlussfragen" (a follow-up/
reasoning question about an instrument already covered by a prior ranking or analysis must
re-call `get_analysis` for that one instrument — tool results aren't remembered across turns
either, see the "Nachfragen" bullet above — and answer via `present_score_analysis`, never prose)
and "Fehlender Ticker bei Analyse-/Score-Anfrage" (an analysis/score request naming no instrument
must get a concrete clarifying question like "Für welches Instrument möchtest du eine
Score-Analyse? (z. B. SAP, MSFT, NVDA)", never a tool call and never the generic "keine
verlässlichen Daten" evasion). `client.test.ts` covers both with prompt-guardrail assertions plus
a behavioral `describe` block that mocks the Anthropic SDK directly (`vi.mock("@anthropic-ai/sdk")`)
to exercise `generateFinaraReply()`'s actual routing — useful as a template if you need to test
routing behavior rather than just that the prompt text asks for the right thing. Note that
`chat-engine.ts`'s fallback sentence is returned from exactly two places in `client.ts`: no API key
configured, or the Anthropic call throwing inside the `try` block (logged as `[FinaraAI] Anthropic
call failed, ...`) — if that sentence shows up unexpectedly with a valid key configured, check the
server log for that line rather than assuming a prompt/routing bug.

**Chart-context attachment is deliberately conditional, not automatic.** `ChatPanel.tsx` only
attaches the currently-charted instrument's image + symbol label when the *message itself*
plausibly refers to it (`lib/chat/chartRelevance.ts`'s `isChartContextRelevant()` — an explicit
ticker/name mention, or a deictic word like "das"/"es"/"aktuell"/"im Chart" paired with an
instrument-related question). This exists because of a live-observed bug: a user got a strategy
explanation, replied "gib mir Beispiele" while SAP happened to be charted, and the chart image got
attached and derailed the answer toward a SAP analysis nobody asked for. The system prompt in
`client.ts` reinforces this: a background chart ticker is never automatically the answer to a
follow-up question. `KNOWN_INSTRUMENTS` in `chartRelevance.ts` is a deliberately client-safe,
hand-curated duplicate of the seed symbol/name list in `lib/mock/instruments.ts` — keep the two in
sync manually if instruments are added.

**Rate-limit honesty, not silent degradation.** When Twelve Data reports a 429 despite the queue
in `rateLimitQueue.ts` (e.g. another process shares the key), `get_analysis`/`get_ranking` add a
`rateLimitNote` field to their JSON result instead of a raw error; the system prompt tells the
model to relay that note verbatim rather than inventing its own wording. `get_fundamentals` uses
the analogous `rateLimited: true` + `message` shape when FMP's 250/day quota is exhausted
(`FmpDailyLimitReachedError`, thrown by `fmp.ts`'s `fmpGet()` rather than returned as `null` —
returning `null` would get memoized by `cache.ts`'s `cached()` as a 6h-long false "not available"
result, conflating a quota problem with a genuine data gap).

The original rule-based engine (`lib/chat-engine.ts`'s `generateChatReply()`, plus its exported
`glossary` array used by `explain_term`) is kept as the **fallback**: `generateFinaraReply()` uses
it whenever `CLAUDE_CHATBOT_API_KEY` is unset or the Anthropic API call throws, mirroring the
"serve a stale/mock value on failure" pattern used throughout `lib/market-data`. If you extend
FinaraAI's capabilities, add a new data tool backed by a deterministic function (never let the
model state a number without calling a tool for it) and, if it needs its own card, a matching
presentation tool registered in both arrays above.

Chat threads/folders and messages persist through `lib/db.ts`
(`getChatThreads`/`createChatThread`/`getThreadMessages`/`appendChatMessage`/etc.), following the
same Supabase-with-mock-store-fallback split as the rest of `lib/db.ts` — see
`supabase/schema.sql`'s `chat_folders`/`chat_threads`/`chat_messages` tables.

## Testing

`npm test` (`vitest run`) covers `lib/analysis/*`, `lib/strategy/*`, `lib/orchestrator/*`,
`lib/finara-ai/*`, `lib/data-providers/fmp.ts`, `lib/market-data/rateLimitQueue.ts`,
`lib/chat/chartRelevance.ts`, and `components/chat/structuredMessage.ts` + its card parsers —
plain server-side TypeScript, no jsdom/React-rendering environment configured
(`vitest.config.ts`). There is no component-rendering test setup; UI changes still need manual
verification in the browser.

A few conventions worth knowing before adding tests here:

- **Vitest does not auto-load `.env.local`** (no dotenv wiring in `vitest.config.ts`) — tests run
  against whatever's already in `process.env`, which in practice means external API keys are
  unset and code paths that check `isFmpConfigured()`/`liveSymbols` fall back to mock data
  automatically. To exercise a real external API deliberately (e.g. verifying a provider's
  response shape after a plan change), pass the key inline: `FMP_DATA_API_KEY=... npx vitest run
  some.test.ts`, and delete any such one-off live-verification test file afterward — don't leave
  it in the suite where CI would depend on the key being present.
- Modules that read an env var **at import time** (`isFmpConfigured()`, `isSupabaseConfigured()`,
  etc.) need `vi.resetModules()` + a dynamic `import()` per test to see a changed env var —
  see `lib/data-providers/fmp.test.ts`'s `importFresh()` helper for the pattern.
- `lib/db.ts`/`getWatchlist` and similar Supabase-backed reads are typically mocked with
  `vi.mock("@/lib/db", () => ({ ... }))` rather than exercised against the real mock-store file,
  to keep tests hermetic (no `.data/mock-store.json` state leaking between runs) — see
  `lib/finara-ai/tools.test.ts`.
- Fake timers (`vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()`) are used for the rate-limit
  queue tests; when asserting a promise rejects, attach the `expect(...).rejects.toThrow(...)`
  assertion *before* advancing timers, not after — otherwise Node flags it as an
  unhandled-rejection window even though it's awaited a line later.

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
- `FMP_DATA_API_KEY` — enables `lib/data-providers/fmp.ts` (Financial Modeling Prep: KGV, PEG,
  KUV, Verschuldungsgrad, Dividendenrendite, freier Cashflow je Aktie, EPS, Marktkapitalisierung,
  Sektor, und Analysten-Konsensschätzungen via `getFundamentals`/`getRatios`/`getCompanyProfile`/
  `getAnalystEstimates`, combined for the chatbot by `getFundamentalsSummary`). Coverage on
  finara's plan is narrower than a symbol having live price data — the ratios/income-statement/
  cash-flow-statement/analyst-estimates endpoints are verified working only for NVDA/MSFT/TSLA
  (`FUNDAMENTALS_COVERED_SYMBOLS` in that file); SAP and ASML have live quotes via Finnhub/Twelve
  Data but return a "Premium Query Parameter" error from those endpoints on this plan.
  `getCompanyProfile` is the one exception — FMP's `/profile` endpoint answers for every finara
  stock symbol including SAP/ASML, so it isn't gated by that coverage set. Wired into FinaraAI's
  tool loop via `get_fundamentals`/`present_fundamentals_analysis` (see "FinaraAI" above). Without
  a key, `get_fundamentals` reports the metric as unavailable — nothing throws. FMP's free tier
  caps at 250 requests/day; fundamentals are cached 6h per symbol (they don't change
  minute-to-minute like quotes).
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_SIGN_IN_FALLBACK_REDIRECT_URL` /
  `_SIGN_UP_FALLBACK_REDIRECT_URL` — already set to point at the custom `/sign-in`, `/sign-up`
  pages and route new sign-ups into `/onboarding/whatsapp`.

## Styling

Design tokens (brand navy/teal, risk-level colors) are defined once in `app/globals.css` via
Tailwind v4's `@theme inline`, then used as utility classes (`bg-brand-teal`, `text-risk-high`,
etc.) — extend the palette there rather than hardcoding hex values in components. Illustrations
follow a no-dependency, no-external-image approach: `components/icons/Icons.tsx` is a small
hand-drawn stroke-icon set (24x24 viewBox, `stroke="currentColor"`, sized/colored via the
`IconTile` wrapper in `components/ui/IconTile.tsx`), and `components/illustrations/HeroVisual.tsx`
is the decorative blob-shape + floating-chip wrapper used behind the landing page's hero card —
both exist so the landing page doesn't depend on hotlinked or licensed stock imagery. (Charts are
a separate story — see the "Charting" section above; `lightweight-charts` **is** a dependency for
the main instrument chart, just not for the small inline previews or the landing page.)

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
