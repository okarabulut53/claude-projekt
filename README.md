# finara — AI Investment Intelligence Platform

Eine KI-gestützte Investment-Analyse-Plattform für den deutschen Markt (siehe [`Proejkt.md`](./Proejkt.md)
für das vollständige Produktkonzept: Onboarding-Journey, nicht verhandelbare Grundprinzipien,
Scoring-Modell, Datenmodell). finara analysiert Aktien, ETFs und Kryptowährungen und liefert
KI-gestützte Investment-Einschätzungen — mit Reasoning, Risiken und Annahmen statt einer nackten
Zahl, und ohne jemals eigenständig zu handeln: **die KI schlägt vor, der Nutzer entscheidet.**

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + Tailwind CSS 4
- **Clerk** — Authentifizierung (Registrierung, Login, E-Mail-Bestätigung)
- **Supabase** (Postgres) — Nutzerprofil, Portfolio-Positionen, Watchlist, Chat-Threads
- **Claude API** (Anthropic) — FinaraAI, der Chat-Assistent (siehe unten)
- **Finnhub / Twelve Data / Financial Modeling Prep** — echte Marktdaten, News und
  Fundamentaldaten, mit deterministischem Mock-Fallback wo (noch) keine Anbindung besteht
- **lightweight-charts** — der interaktive Instrument-Chart (Candlesticks, Zeichentools,
  Indikatoren); kleinere Vorschau-Charts sind dagegen bewusst dependency-freies, handgebautes SVG
- **Vitest** — Unit-Tests für die Analyse-/Strategie-/Chatbot-Logik

## Was die App kann

- **Dashboard** mit Portfolio-Snapshot, relevanzsortierten News und Top-Opportunities
- **Instrument-Detailseiten** mit interaktivem Chart (Indikatoren, Zeichentools), echten
  Kennzahlen wo verfügbar, klar gekennzeichnet als Live- oder Simulationsdaten
- **Portfolio** — manuell erfasste Positionen, Gewinn/Verlust live gegen aktuelle Kurse berechnet
- **Watchlist** — eigene Beobachtungsliste, im Chat direkt score- und risikoanalysierbar
- **FinaraAI-Chat** (`/finaraai`) — ein über die echte Claude API laufender Assistent, der SWOT-
  und Bullen/Bären-Analysen, Score-Analysen, Rankings, Marktübersichten, News-Zusammenfassungen,
  Fundamentaldaten-Auswertungen und Exporte (CSV/Word/PowerPoint) als strukturierte Karten statt
  Fließtext liefert. Jede Zahl, die der Assistent nennt, kommt 1:1 aus einer echten Berechnung —
  das Sprachmodell erfindet nie einen Kurs, Score oder eine Kennzahl.
- **Onboarding** (WhatsApp → Depot → Risikoprofil), Risikoprofil ist der einzige Pflichtschritt

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Im SQL Editor das Skript aus [`supabase/schema.sql`](./supabase/schema.sql) ausführen — legt
   alle benötigten Tabellen an (`app_users`, `portfolio_positions`, `watchlist_items`,
   `chat_folders`/`chat_threads`/`chat_messages`).
3. Unter **Project Settings → API** die `Project URL` und den `service_role`-Key kopieren und in
   `.env.local` eintragen:

   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

   Der `service_role`-Key hat vollen DB-Zugriff und wird ausschließlich serverseitig verwendet —
   niemals im Client-Code oder mit `NEXT_PUBLIC_`-Präfix verwenden.

   **Ohne Supabase-Konfiguration** läuft die App trotzdem: `lib/mock/user-store.ts` übernimmt
   automatisch als dateibasierter Fallback-Store, solange `SUPABASE_URL`/
   `SUPABASE_SERVICE_ROLE_KEY` fehlen — praktisch für einen schnellen lokalen Test ohne
   Supabase-Setup.

### 3. Clerk

Die Clerk-Keys sind bereits in `.env.local` hinterlegt. Die Sign-in/Sign-up-Routen liegen unter
`/sign-in` und `/sign-up`; nach der Registrierung landen neue Nutzer im Onboarding
(`/onboarding/whatsapp` → `/onboarding/depot` → `/onboarding/risikoprofil`).

### 4. Optionale API-Keys für echte Daten

Ohne diese Keys läuft die App vollständig mit deterministischen Mock-Daten — nichts wirft einen
Fehler, es wird einfach kein Live-Wert angezeigt. Zum Einschalten in `.env.local` eintragen:

| Variable | Schaltet frei |
|---|---|
| `FINNHUB_API_KEY` | Live-Kurse, allgemeine/unternehmensbezogene News |
| `TWELVE_DATA_API_KEY` | Historische Kursverläufe für den Instrument-Chart |
| `FMP_DATA_API_KEY` | Fundamentaldaten (KGV, PEG, KUV, Dividendenrendite, Verschuldungsgrad, EPS, Marktkapitalisierung) — nur für NVDA/MSFT/TSLA verifiziert abgedeckt |
| `CLAUDE_CHATBOT_API_KEY` + `CLAUDE_CHATBOT_MODEL` | FinaraAI ruft die echte Claude API statt der regelbasierten Fallback-Engine |

Details zu Abdeckung, Caching und Rate-Limits stehen in [`CLAUDE.md`](./CLAUDE.md).

### 5. Entwicklungsserver starten

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) öffnen.

## Tests

```bash
npm test          # vitest run — Analyse-/Strategie-/Chatbot-Logik
npx tsc --noEmit   # Type-Check
npm run lint       # ESLint
```

## Struktur

- `app/page.tsx` — öffentliche Landingpage
- `app/onboarding/*` — Onboarding-Flow (WhatsApp, Depot, Risikoprofil)
- `app/(main)/*` — geschützter Bereich (Dashboard, Portfolio, Watchlist, Suche, Instrument-Detail,
  FinaraAI-Chat, Einstellungen); Zugriffsschutz erfolgt ressourcenbasiert über `auth.protect()` in
  `lib/current-user.ts`, wie von Clerk empfohlen (nicht über Middleware-Pfad-Matching)
- `lib/market-data/*`, `lib/data-providers/fmp.ts` — echte Marktdaten-/Fundamentaldaten-Clients
  (Finnhub, Twelve Data, Financial Modeling Prep), inkl. Caching und Rate-Limit-Schutz
- `lib/mock/*` — deterministisch generierte Markt-, News- und Opportunity-Daten, dienen als
  Fallback wo keine Live-Anbindung besteht oder verfügbar ist
- `lib/db.ts`, `lib/supabase.ts` — Supabase-Zugriffsschicht (mit dateibasiertem Mock-Fallback)
- `lib/analysis/*`, `lib/strategy/*`, `lib/orchestrator/*` — die deterministische Scoring-Logik
  hinter jeder Instrument-Analyse (technisch, Momentum, Risiko, Sentiment, Analystenkonsens)
- `lib/finara-ai/*` — FinaraAI: Claude-API-Anbindung, Tool-Definitionen, Export-Logik
- `lib/chat-engine.ts` — die regelbasierte Fallback-Chat-Logik (aktiv ohne Claude-API-Key)
- `components/chat/*` — Chat-UI inkl. der strukturierten Antwort-Karten (SWOT, Score, Ranking,
  Fundamentaldaten, Marktübersicht, News, Watchlist, Export)
- `components/charts/*` — der interaktive Instrument-Chart (`lightweight-charts`) sowie
  dependency-freie Vorschau-Charts
- `supabase/schema.sql` — Datenbankschema

Ausführliche, für die Weiterentwicklung relevante Architektur-Entscheidungen (warum etwas so
gebaut ist, welche Konventionen gelten) stehen in [`CLAUDE.md`](./CLAUDE.md).

## Was als Nächstes sinnvoll wäre

- finAPI-Anbindung für echte, read-only Depot-Synchronisierung
- E-Mail-/WhatsApp-Versand der täglichen Zusammenfassung (Resend + WhatsApp Business API)
- Fundamentaldaten-Abdeckung (aktuell NVDA/MSFT/TSLA) erweitern, sobald ein höherer FMP-Tarif oder
  ein zusätzlicher Anbieter zur Verfügung steht
- Sektor-Klassifikation für die Watchlist-Sektorallokation (aktuell eine dokumentierte Datenlücke)
- Rechtliche Prüfung der Texte in `app/rechtliches` vor einem echten Launch
