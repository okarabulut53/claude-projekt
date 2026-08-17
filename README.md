# finara — AI Investment Intelligence Platform

Erster Entwurf einer KI-gestützten Investment-Analyse-Plattform (siehe `Proejkt.md` für das
vollständige Konzept). Diese Version arbeitet mit realistischen **Mock-Daten** für Marktkurse,
News und AI Investment Scores — die Struktur ist so gebaut, dass echte Datenquellen später
eingesteckt werden können, ohne die UI umzubauen.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + Tailwind CSS 4
- **Clerk** — Authentifizierung (Registrierung, Login, E-Mail-Bestätigung)
- **Supabase** (Postgres) — Nutzerprofil (Risikoprofil, Onboarding-Status), Portfolio-Positionen

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Im SQL Editor das Skript aus [`supabase/schema.sql`](./supabase/schema.sql) ausführen — legt die
   Tabellen `app_users` und `portfolio_positions` an.
3. Unter **Project Settings → API** die `Project URL` und den `service_role`-Key kopieren und in
   `.env.local` eintragen:

   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

   Der `service_role`-Key hat vollen DB-Zugriff und wird ausschließlich serverseitig verwendet —
   niemals im Client-Code oder mit `NEXT_PUBLIC_`-Präfix verwenden.

### 3. Clerk

Die Clerk-Keys sind bereits in `.env.local` hinterlegt. Die Sign-in/Sign-up-Routen liegen unter
`/sign-in` und `/sign-up`; nach der Registrierung landen neue Nutzer im Onboarding
(`/onboarding/whatsapp` → `/onboarding/depot` → `/onboarding/risikoprofil`).

### 4. Entwicklungsserver starten

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) öffnen.

## Struktur

- `app/page.tsx` — öffentliche Landingpage
- `app/onboarding/*` — Onboarding-Flow (WhatsApp, Depot, Risikoprofil)
- `app/(main)/*` — geschützter Bereich (Dashboard, Portfolio, Suche, Instrument-Detail, Chatbot,
  Einstellungen); Zugriffsschutz erfolgt ressourcenbasiert über `auth.protect()` in
  `lib/current-user.ts`, wie von Clerk empfohlen (nicht mehr über Middleware-Pfad-Matching)
- `lib/mock/*` — deterministisch generierte Markt-, News- und Opportunity-Daten
- `lib/db.ts`, `lib/supabase.ts` — Supabase-Zugriffsschicht
- `lib/chat-engine.ts` — regelbasierte Chatbot-Logik: Zahlen kommen immer aus echten
  Tool-Berechnungen (Portfolio, Scores), nie vom Sprachmodell erfunden
- `supabase/schema.sql` — Datenbankschema

## Was als Nächstes sinnvoll wäre

- Echte Marktdaten-/News-API anbinden (z. B. Finnhub, CoinGecko) anstelle von `lib/mock/*`
- Claude API für den Chatbot und die Reasoning-Texte der Opportunities anbinden
- finAPI-Anbindung für echte, read-only Depot-Synchronisierung
- E-Mail-/WhatsApp-Versand der täglichen Zusammenfassung (Resend + WhatsApp Business API)
- Rechtliche Prüfung der Texte in `app/rechtliches` vor einem echten Launch
