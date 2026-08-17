# CLAUDE.md

Diese Datei gibt Claude Code Kontext und Leitplanken für die Arbeit an diesem Projekt.

## Projektübersicht

**AI Investment Intelligence Platform** — eine Webanwendung für Privatanleger, die mithilfe von KI Investmentmöglichkeiten in Aktien, ETFs und Kryptowährungen analysiert und bewertet.

Die App hilft Nutzern, interessante Investmentmöglichkeiten zu erkennen, Marktbewegungen zu verstehen und fundierte eigene Entscheidungen zu treffen.

**Zentrales Konzept:** Die KI analysiert den Markt, bewertet Chancen und Risiken und liefert dem Nutzer konkrete Investmentideen. Der Nutzer entscheidet selbst, ob er investiert.

## Onboarding & Nutzer-Journey

Der komplette Weg eines neuen Nutzers, von der ersten Landung bis zur laufenden Nutzung:

1. **Landingpage (öffentlich, ohne Login):** Erklärt was die Plattform ist, wie sie funktioniert, Preisstruktur usw. — vollständig einsehbar ohne Registrierung.
2. **Registrierung:** E-Mail, Username usw. Danach Versand einer Bestätigungs-E-Mail.
3. **E-Mail-Bestätigung:** Erst nach Bestätigung erhält der Nutzer Zugang zum Portal.
4. **Optionaler Onboarding-Flow direkt nach Bestätigung** (statt sofort auf die Hauptseite), jeder Schritt überspringbar:
   - Schritt 1: WhatsApp-Anbindung (Telefonnummer hinterlegen)
   - Schritt 2: Depot-Anbindung
   - Beide Schritte sind optional und können jederzeit später nachgeholt werden (z. B. über Profil-/Einstellungsseite).
5. **Risikoprofil-Auswahl (Pflichtschritt, nicht überspringbar):** Nutzer legt sein Risikoprofil fest — Low / Medium / High Risk. Zentral für die Empfehlungslogik, jederzeit im Nachhinein änderbar (z. B. in den Einstellungen).
6. **Hauptseite:** Nutzer landet auf dem Dashboard mit News, Feeds, wichtigsten Ereignissen, wichtigsten Indizes, KI-Chat, Suchfeld usw.
7. **Nachträgliche Anbindung jederzeit möglich:** WhatsApp-Nummer und/oder Depot können jederzeit über die Einstellungen ergänzt werden, falls beim Onboarding übersprungen.
8. **Depot-Detailseite:** Nach erfolgter Depot-Anbindung gibt es eine separate Seite mit allen Depot-Informationen (Gewinn/Verlust absolut und in Prozent, Performance je Position usw.).
9. **Empfehlungen & Benachrichtigungen:** Kauf-/Verkaufsempfehlungen werden auf der Hauptseite angezeigt. Zusätzlich per Kanal:
   - Ist eine WhatsApp-Nummer hinterlegt → Versand per WhatsApp.
   - Ist keine WhatsApp-Nummer hinterlegt → Versand per E-Mail.
   - (Beide Kanäle sind also nicht immer parallel aktiv — WhatsApp hat Vorrang, wenn verknüpft; E-Mail ist der Standard-Fallback.)

## Nicht verhandelbare Grundprinzipien

Diese Regeln gelten für jede Funktion, jeden Text und jede UI-Komponente in der App:

1. **Keine autonome Vermögensverwaltung.** Die KI führt niemals selbstständig Käufe oder Verkäufe durch. Keine automatische Orderausführung — auch nicht im späteren Produkt, nicht nur im MVP.
2. **Der Nutzer entscheidet immer selbst.** Jeder Vorschlag endet beim Nutzer, nie bei einer Aktion der KI.
3. **Keine garantierten Renditen.** Niemals Formulierungen wie „Diese Aktie wird steigen" oder „Du wirst X % Gewinn machen". Stattdessen Chancen/Risiko-Sprache verwenden (siehe Formulierungsregeln unten).
4. **Transparenz statt Blackbox.** Jede Empfehlung muss erklären: Warum wurde das Asset ausgewählt? Welche Faktoren sprechen dafür/dagegen? Wie hoch ist das Risiko? Welche Annahmen liegen zugrunde?
5. **Scoring ist nicht frei erfunden.** Der AI Investment Score kombiniert strukturierte, quantitative Daten mit LLM-Analyse — er ist kein reiner LLM-Output ohne Grundlage.
6. **Rechtlicher Hinweis Pflicht.** Klare Disclaimer, dass Marktanalysen/KI-Einschätzungen keine Garantie für zukünftige Entwicklungen sind. Vor öffentlichem Launch: Prüfung durch spezialisierten Rechtsberater (regulatorische Einordnung als Investment-Analyse-Plattform, nicht als Vermögensverwaltung).

### Formulierungsregeln für KI-Output

| Vermeiden | Stattdessen |
|---|---|
| „Diese Aktie wird steigen." | „Die aktuelle Datenlage spricht für ein attraktives Chancen/Risiko-Verhältnis." |
| „Du wirst 20 % Gewinn machen." | „Das Asset weist mehrere positive Faktoren auf, gleichzeitig besteht ein erhöhtes Verlustrisiko." |
| „Das ist ein sicherer Gewinn." | „Interessante Chance für Nutzer mit [Risikoprofil]." |
| „Kaufe NVIDIA." | Score + Reasoning + Risiken + eigene Entscheidung des Nutzers |

## Nutzerprofile & Risikoklassen

Jeder Nutzer wählt bei Setup ein Risikoprofil, das die Investmentvorschläge maßgeblich steuert:

- **Low Risk** — etablierte Unternehmen, stabile Aktien, ETFs, dividendenstarke Werte, geringe Volatilität. Fokus auf Kapitalerhalt.
- **Medium Risk** — Growth-Aktien, etablierte Kryptowährungen, ETFs, ausgewählte Einzelaktien, höheres Wachstumspotenzial.
- **High Risk** — volatile Aktien, Small Caps, Kryptowährungen/Altcoins, kurzfristige Momentum-Chancen, spekulative Investments.

Zwei Nutzer mit unterschiedlichem Risikoprofil erhalten am selben Tag unterschiedliche Vorschläge. Das Risikoprofil ist zentraler Bestandteil des Scoring-Systems, nicht nur ein Filter danach.

## AI Investment Score

Jedes analysierte Asset erhält einen Score (z. B. `87/100`), zusammengesetzt u. a. aus:

- Momentum, Bewertung, Wachstum, Volatilität
- technische Situation, Marktstimmung, Nachrichtenlage
- Risiko, erwartetes Chancen/Risiko-Verhältnis

Bei der Implementierung: quantitatives/regelbasiertes Scoring und LLM-Analyse trennen, dann kombinieren — nicht ein LLM den Score „raten" lassen.

## Analyse-Pipeline (Grundprozess)

```
1. Marktdaten sammeln
2. Assets filtern
3. Quantitative Analyse
4. Nachrichten & externe Informationen analysieren
5. Risiko bestimmen
6. Chancen/Risiko-Verhältnis berechnen
7. Nutzerprofil berücksichtigen
8. AI Score berechnen
9. Investment Opportunities auswählen
10. Analyse/Reasoning generieren
11. Nutzer benachrichtigen
```

Eingangsdaten pro Analyse: Aktien-/Kryptokurse, Kursentwicklung, Volumen, Volatilität, historische Kursdaten, technische Indikatoren, Unternehmenskennzahlen, Nachrichten, Marktstimmung, relevante Ereignisse.

## Kern-Datenmodelle (konzeptionell)

- **User** → Risikoprofil, Benachrichtigungskanäle (E-Mail, WhatsApp), später: Portfolio
- **Asset** → Kurs-/Marktdaten, Score-Historie
- **Investment Opportunity** → Asset-Referenz, AI Score, Risk Level, Potential Entry (Range), Suggested Holding Period, Reasoning, Risiken, AI Assessment
- **Portfolio** → Positionen mit Wert, für Risikoverteilung/Diversifikations-Analyse. Feld `source` unterscheidet: manuell erfasst vs. über Depot-Anbindung synchronisiert.
- **Notification** → tägliche Zusammenfassung der Top-Opportunities je Nutzer/Risikoprofil

## Haltedauer-Logik

Die KI schlägt immer eine Haltedauer vor und begründet sie:

- kurzfristig: mehrere Tage
- kurzfristig bis mittelfristig: mehrere Wochen
- mittelfristig: mehrere Monate
- langfristig: mehrere Jahre

Abhängig von: Investmenttyp, Risikoprofil, Marktbedingungen, Volatilität, erwarteter Entwicklung, technischen/fundamentalen Faktoren.

## Beispiel-Output (Referenzformat)

```
Investment Opportunity
Asset: NVIDIA
AI Score: 87/100
Risk Level: Medium
Potential Entry: 180–185 USD
Suggested Holding Period: 6–12 Monate

Reasoning: Kombination aus starkem Momentum, positiven
Wachstumserwartungen und technischer Unterstützung.

Risiken: Hohe Bewertung, hohe Wachstumserwartungen,
erhöhte Volatilität.

AI Assessment: Interessante Chance für Nutzer mit
mittlerer Risikobereitschaft.
```

## Hauptseite / Dashboard

Die Startseite ist nicht nur eine Liste von Empfehlungen, sondern gibt dem Nutzer einen direkten Marktüberblick:

- **Marktübersicht:** Kursverläufe der wichtigsten/beobachteten Assets (Charts, z. B. Tages-/Wochen-/Monatsansicht).
- **News-Feed:** aktuelle Marktnachrichten, idealerweise gefiltert nach Relevanz für Assets im Portfolio bzw. auf der Watchlist des Nutzers.
- **Tagesüberblick:** kompakte Zusammenfassung der neuesten AI Investment Opportunities, direkt in der App (analog zur täglichen Benachrichtigung).

Wichtig: Charts/News-Widgets sind rein informativ. Keine Kauf-Buttons oder direkte Order-Anbindung an diesen Elementen — bleibt konsistent mit dem Grundprinzip „keine automatische Orderausführung".

## Portfolio & Depot-Anbindung

Der Nutzer kann sein Portfolio auf zwei Wegen hinterlegen:

- **Manuelle Eingabe** — Positionen (Asset, Wert) selbst erfassen.
- **Depot-Anbindung** — echtes Broker-/Krypto-Depot per Schnittstelle verknüpfen (z. B. über die API/Open-Banking- bzw. Open-Broker-Schnittstelle des jeweiligen Anbieters). Zunächst zum Testen mit eigenen Accounts.

**Wichtig:** Die Anbindung ist strikt **read-only** — die App liest nur Bestände/Transaktionen aus. Es wird nichts im Depot ausgelöst; das bleibt konsistent mit dem Grundprinzip „keine automatische Orderausführung".

Auf Basis des Portfolios (egal ob manuell oder angebunden) kann die KI analysieren:

- Risikoverteilung, Branchenverteilung, Asset Allocation
- Konzentrationsrisiken, Performance, Volatilität, Diversifikation
- mögliche Schwachstellen, auf die die KI den Nutzer hinweist

## Suche & Instrumenten-Detailseite

- **Suchfeld** (global, z. B. in der Navigation): Suche nach Aktien, Kryptowährungen, ETFs und weiteren Finanzinstrumenten nach Name/Ticker/ISIN.
- **Detailseite pro Instrument** bei Auswahl eines Suchergebnisses:
  - Kursverlauf als Grafik (verschiedene Zeiträume: Tag/Woche/Monat/Jahr)
  - Kennzahlen/Prozente (z. B. Tages-/Wochenveränderung, Volatilität, Unternehmenskennzahlen wo vorhanden)
  - AI Investment Score inkl. Reasoning (analog zum bestehenden Scoring-Konzept)
  - Risikoeinstufung passend zum Instrument
  - relevante News zu diesem Instrument
- Auch hier: keine Kauf-Buttons — Detailseite ist reine Analyse, Entscheidung bleibt beim Nutzer (Grundprinzip).

## Chatbot

Zusätzlicher Zugang neben Dashboard und Suche: ein Chatbot für freie Fragen des Nutzers.

- **Themenbereich: sowohl als auch.**
  - Fragen zu konkreten, bereits analysierten Instrumenten/Portfolio-Daten (z. B. "Wie sieht NVIDIA gerade aus?", "Was bedeutet dieser Score?", "Wie ist mein Portfolio aktuell verteilt?")
  - Allgemeine Finanzfragen ohne Bezug zu einem konkreten Instrument (z. B. "Was ist ein ETF?", "Was bedeutet Volatilität?")
  - **Konto-/Portfolio-Fragen direkt aus den Nutzerdaten:**
    - **Kontostand/Guthaben:** „Wie hoch ist mein Guthaben?" → Antwort direkt aus den Portfolio-Daten (Depot-Anbindung oder manuell erfasst).
    - **Halten-Empfehlung:** „Welche Aktien sollte ich behalten?" → Antwort basierend auf AI Score + Reasoning je Position im Portfolio.
    - **Verkaufen-Empfehlung:** „Welche sollte ich verkaufen?" → gleiche Logik, aber als Einschätzung mit Begründung (z. B. „Position X zeigt aktuell schwaches Momentum und erhöhtes Risiko"), nicht als Befehl.
  - Diese Konto-/Portfolio-Fragen setzen voraus, dass Portfolio-Daten (aus Depot-Anbindung oder manueller Eingabe) verfügbar und mit dem Chatbot verknüpft sind.
- Bei instrumentenspezifischen Fragen greift der Chatbot auf dieselbe AI Investment Engine / Scoring-Logik zurück, statt eigene, unbelegte Einschätzungen zu generieren — konsistent mit dem Prinzip „Scoring ist nicht frei erfunden".
- Unterliegt denselben Formulierungsregeln (keine Renditegarantien, Chancen/Risiko-Sprache) und darf keine Käufe/Verkäufe auslösen oder als direkte Handlungsanweisung empfehlen — nur als Analyse/Erklärung. Auch Halte-/Verkaufsantworten sind **Einschätzungen mit Reasoning**, keine Kauf-/Verkaufsanweisungen: der Chatbot sagt nie „Verkaufe X", sondern z. B. „Basierend auf aktuellen Daten würde ich Position X kritisch sehen, weil...". Endgültige Entscheidung bleibt beim Nutzer.

## Datenqualität & Vertrauen im Chatbot

Sobald der Chatbot personalisierte Portfolio-Einschätzungen (Guthaben, Halten/Verkaufen) gibt, steigt der Anspruch an Korrektheit stark — ein falscher oder veralteter Datenpunkt ist hier schädlicher als in einem generischen News-Feed. Das wird nicht durch „Training" des Modells sichergestellt, sondern durch Architektur, Prompting und Tests rund um das LLM:

- **Strikte Trennung Berechnung vs. Erklärung:** Das LLM rechnet nie selbst und erinnert sich nie an Zahlen. Guthaben, Gewinn/Verlust und Score werden deterministisch im Backend berechnet und dem LLM als strukturierter Kontext übergeben (z. B. via Function/Tool Calling gegen die eigene API). Das LLM formuliert daraus nur den Antworttext. Faustregel: Jede Zahl im Chat muss 1:1 aus einem Tool-Ergebnis stammen, nie aus dem Sprachmodell selbst generiert sein.
- **Aktualität sichtbar machen:** Jeder Datenpunkt bekommt einen Zeitstempel. Ab einem definierten Schwellenwert (z. B. Kursdaten älter als X Minuten) wird das im Chat explizit benannt statt veraltete Daten unkommentiert als aktuell darzustellen.
- **Guardrails im System-Prompt:** Explizite Regel, dass bei fehlendem oder unvollständigem Tool-Ergebnis offen kommuniziert wird („dazu liegen mir keine verlässlichen Daten vor") statt zu schätzen oder zu extrapolieren.
- **Validierung der Datenquelle:** Wo möglich, Datenquellen gegenlesen (z. B. Kurs von Anbieter A vs. B) und bei größeren Abweichungen warnen statt stillschweigend einen Wert anzuzeigen. Bei Depot-Daten (finAPI): Sync-Status prüfen und Nutzer transparent über den letzten erfolgreichen Abgleich informieren.
- **Automatisierte Test-Suite:** Testfälle mit bekanntem, korrektem Ergebnis (fester Testnutzer mit definiertem Portfolio → erwartete korrekte Antwort) bei jeder Änderung an Prompt/Logik automatisiert durchlaufen lassen (Regressionstests). Zusätzlich adversariale Tests mit lückenhaften/widersprüchlichen Daten, um zu prüfen, dass ehrlich auf fehlende Daten hingewiesen wird statt zu halluzinieren.
- **Audit-Log & manuelle Stichproben:** Chatbot-Antworten inkl. zugrunde liegender Rohdaten protokollieren, gerade in der frühen Testphase regelmäßig stichprobenartig gegen die Realität prüfen.
- **Unsicherheit kommunizieren statt kaschieren:** Halten/Verkaufen-Einschätzungen immer mit Datenbasis versehen (z. B. „basierend auf Score X, Stand von heute Morgen"), damit die Aussage für Nutzer und Betreiber nachvollziehbar bleibt.

## Benachrichtigungen

Tägliche automatische Zusammenfassung neuer Investmentmöglichkeiten via E-Mail und WhatsApp (Push Notifications später). Format: kurze Liste (Asset, Score, Risiko, Horizont) mit Link zu Detailanalyse in der Web-App.

## Architektur (High-Level)

```
User → Web Application → User Profile / Portfolio
                              │
                    AI Investment Engine
                              │
        ┌─────────────┬───────────────┬─────────────┐
   Market Data      News Data      Company Data
        └─────────────┴───────────────┴─────────────┘
                              │
                      Scoring Engine
                              │
                       AI Analysis
                              │
               Investment Opportunities
                              │
                  ┌───────────┴───────────┐
              WhatsApp                  Email
                              │
                        User entscheidet selbst
```

## MVP-Scope

**Enthalten:**
- Registrierung/Login, Nutzerprofil, Risikoprofil-Auswahl
- Aktien & Kryptowährungen als Asset-Klassen
- Tägliche Marktanalyse & AI Investment Score
- Investmentvorschläge mit Begründung, Haltedauer, Chancen/Risiken
- E-Mail- und WhatsApp-Benachrichtigung
- Dashboard mit vergangenen Empfehlungen
- Hauptseite mit Kursverläufen, News-Feed und Tagesüberblick
- Suchfeld für Finanzinstrumente mit Detailseite (Grafiken, Kennzahlen, Score, Risiko, News)
- Chatbot (instrumenten-/portfoliospezifisch und allgemeine Finanzfragen)
- Portfolio: manuelle Eingabe **und** Depot-Anbindung (read-only, zunächst zum Testen mit eigenen Accounts)
- Nutzer entscheidet selbst über jedes Investment

**Explizit nicht im MVP:**
- Automatische Orderausführung (grundsätzlich nie geplant)

## Empfohlene Plattformen / Tech-Stack

Übersicht der externen Dienste, die für die Umsetzung benötigt werden. Konkrete Auswahl kann sich noch ändern, dient als Ausgangspunkt.

- **Marktdaten (Aktien/ETFs):** z. B. Finnhub (großzügige Gratis-Stufe, Kurse/News/Sentiment), Twelve Data (Aktien, FX, Krypto vereinheitlicht), Tiingo (günstige historische EOD-Daten), Massive (ehem. Polygon.io, Echtzeit/High-Frequency).
- **Marktdaten (Krypto):** CoinGecko API oder CoinMarketCap.
- **News-Daten:** teils bereits in den Marktdaten-Paketen enthalten (z. B. Finnhub), sonst dedizierte News-API ergänzen.
- **LLM/KI-Analyse:** Claude API (Anthropic) — für Scoring-Reasoning, Chatbot, Text-Erklärungen. Kombiniert mit regelbasiertem/quantitativem Scoring, nicht als Ersatz dafür.
- **Depot-Anbindung (Deutschland):** **finAPI** — einer der größten deutschen Open-Banking-Anbieter, BaFin-lizenziert (Kontoinformationsdienst), deckt Girokonten, Depots, Kreditkarten über PSD2/XS2A ab. Zugriff strikt read-only nutzen. Alternative/Ergänzung: brokerize (fokussiert auf deutsche Online-Broker statt allgemeinem Banking).
- **Auth/User-Management:** fertiger Anbieter statt Eigenbau, z. B. Clerk, Auth0 oder Supabase Auth.
- **Benachrichtigungen:** E-Mail via Resend/Postmark/SendGrid; WhatsApp via Meta WhatsApp Business Cloud API oder vereinfachte Anbieter wie Twilio/360dialog.
- **Hosting/Datenbank:** noch offen, abhängig vom gewählten Framework.

## Marktabdeckung

Fokus liegt zunächst vollständig auf **Deutschland**: deutsche/europäische Börsen, EUR als Basiswährung, Depot-Anbindung über deutsche Anbieter (finAPI/brokerize), deutschsprachige News-Quellen.

Eine Erweiterung auf weitere Länder ist grundsätzlich denkbar, aber aktuell kein Thema — dafür keine zusätzliche Architektur oder Planung vorziehen.

## Hinweise für Claude Code

- Bei neuen Features immer gegen die Grundprinzipien oben prüfen (insbesondere: keine Order-Ausführung, keine Renditegarantien, immer Reasoning/Transparenz mitliefern).
- UI-Texte und generierte Analyse-Texte sollten die Formulierungsregeln befolgen — beim Review von Copy oder Prompt-Templates darauf achten.
- Scoring-Logik: quantitative Berechnung und LLM-Analyse als getrennte, nachvollziehbare Schritte implementieren, nicht als einzelnen LLM-Freitext-Call.
- Konkreter Tech-Stack (Frontend/Backend/DB, Marktdaten-Provider, LLM-Provider) ist in diesem Konzept noch nicht festgelegt — bei Bedarf nachfragen bzw. hier ergänzen, sobald entschieden.
- **Depot-Anbindung ist sicherheitskritisch:** Zugangsdaten/Tokens nie im Klartext speichern. Wenn der Anbieter OAuth unterstützt, OAuth statt Passwort-Speicherung verwenden. Zugriff strikt read-only implementieren — kein Endpoint/Feature darf Order- oder Transaktionsauslösung im angebundenen Depot ermöglichen.
