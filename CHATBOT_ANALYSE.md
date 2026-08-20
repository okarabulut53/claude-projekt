# FinaraAI — Stand der Investment-Analyst-Architektur

Kurze, ehrliche Bestandsaufnahme: was der Chatbot heute tatsächlich kann, was nicht, was
schwach ist, und was als Nächstes gebraucht wird. Bezieht sich auf den Code-Stand nach den
Etappen 1–8 (Kategorien-&-Vorlagen-UI, strukturierte Antwort-Karten statt Fließtext), der
FMP-Erweiterung (Fundamentaldaten, Sektor-Wiring) und der jüngsten Anschlussfragen-/
Fehlender-Ticker-Korrektur (siehe unten). Kein Marketing-Text — wo etwas simuliert, unvollständig
oder ungetestet ist, steht das hier auch so.

## Wo was steht (Referenz)

| Was | Datei |
|---|---|
| Formel Momentum-Score | `lib/analysis/momentum.ts` |
| Formel Risk-Score | `lib/analysis/risk.ts` |
| Gemeinsame Skalierungs-Mathematik | `lib/analysis/scale.ts` |
| Score-/Analyse-Typen | `lib/analysis/types.ts` |
| Strategien + ihre Gewichtungen (zentral) | `lib/strategy/config.ts` |
| Wie Scores zu einem Strategie-Ergebnis kombiniert werden | `lib/strategy/index.ts` |
| Standard-Strategie je Risikoprofil | `lib/orchestrator/index.ts` |
| System-Prompt / Regeln des Chatbots | `lib/finara-ai/client.ts` (`buildSystemPrompt`) |
| Tool-Definitionen + Dispatch (was der Bot abrufen/ausgeben kann) | `lib/finara-ai/tools.ts` |
| Export der letzten Analyse als CSV/Word/PowerPoint | `lib/finara-ai/exportData.ts`, `lib/finara-ai/export.ts` |
| Fundamentaldaten-Anbindung (FMP) | `lib/data-providers/fmp.ts` |
| Rate-Limit-Queue (Twelve Data 8/min, FMP 250/Tag) | `lib/market-data/rateLimitQueue.ts` |
| Kategorien & vorformulierte Prompt-Vorlagen | `lib/finara-ai/promptTemplates.ts` |
| UI: Kategorie-→-Vorlage-Picker im Chat-Eingabefeld | `components/chat/PromptTemplatePicker.tsx` |
| Ob der aktuell im Chart-Panel gezeigte Ticker mitgeschickt wird | `lib/chat/chartRelevance.ts` |
| Regelbasierter Fallback (ohne API-Key oder bei API-Fehler) | `lib/chat-engine.ts` |
| UI-Karten für strukturierte Analysen (10 Typen, siehe unten) | `components/chat/*Card.tsx` |
| Parsing/Dispatch der Karten im Chatverlauf | `components/chat/structuredMessage.ts`, `ChatPanel.tsx` |
| Automatisierte Tests | `lib/analysis/*.test.ts`, `lib/strategy/index.test.ts`, `lib/orchestrator/index.test.ts`, `lib/finara-ai/*.test.ts`, `lib/data-providers/fmp.test.ts`, `lib/market-data/rateLimitQueue.test.ts`, `lib/chat/chartRelevance.test.ts`, `components/chat/structuredMessage.test.ts` |

## Wie der „AI Score" gebildet wird — wichtig, denn es gibt aktuell ZWEI verschiedene

Das ist der häufigste Verwechslungspunkt im aktuellen Code, deshalb hier explizit: „AI Score"
bezeichnet zwei komplett unterschiedliche, unabhängige Dinge, die zufällig ähnlich heißen.
Unverändert gegenüber der letzten Analyse — weder die FMP-Erweiterung noch die
Anschlussfragen-Korrektur haben an der Scoring-Mathematik selbst etwas verändert.

### 1. Der alte, statische `aiOpportunity.aiScore` — NICHT berechnet

Kommt aus `lib/mock/opportunities.ts`, wird auf Dashboard, Watchlist und in den
Opportunity-Cards angezeigt, und liegt auch als Feld in `get_instrument`s Antwort. Das ist eine
**fest im Code hinterlegte Zahl pro Symbol** (NVDA immer 87, SAP immer 78, …) — keine Formel,
keine Berechnung, ändert sich nie, egal was der Kurs macht. Der System-Prompt weist Claude
explizit an, diesen Wert nicht mit dem echten Score zu verwechseln.

### 2. Der echte Score aus `get_analysis` — so wird er gebildet

Kein einzelner „AI Score", sondern mehrere unabhängige 0–100-Scores (Momentum, Risk, Technical,
Volume, Sentiment, Analyst Consensus, Market Environment) plus ein daraus kombinierter
Strategie-Score. Alle Schritte sind reiner, deterministischer Code — kein LLM ist an der
Berechnung beteiligt. Die Fundamentaldaten aus `get_fundamentals` (KGV, PEG, KUV, …) sind davon
bewusst getrennt — sie fließen NICHT in den Score ein, sondern werden bei vollständig abgedeckten
Symbolen (NVDA/MSFT/TSLA) als eigenständiges Gegenargument im Prompt eingeordnet (siehe unten).

- **Momentum-Score** (`lib/analysis/momentum.ts`): 30-/10-Tage-Kursänderung, RSI(14),
  MACD(12,26,9)-Histogramm, gemittelt über die tatsächlich verfügbaren Faktoren.
- **Risk-Score** (`lib/analysis/risk.ts`): annualisierte Volatilität + maximaler Drawdown.
  **Wichtig: höherer Wert = geringeres Risiko**, wie bei allen weiteren Scores gilt „höher =
  günstiger".
- **Technical/Volume/Sentiment/AnalystConsensus/MarketEnvironment**: bilden zusammen mit
  Momentum/Risk die „Intraday"-Strategie. MarketEnvironment ist strukturell IMMER `unavailable`
  (keine VIX-/Marktumfeld-Datenquelle angebunden) — bewusst so, um keinen erfundenen
  Näherungswert zu liefern.
- **Strategie-Score** (`lib/strategy/config.ts` + `lib/strategy/index.ts`): Momentum/Balanced/
  Intraday gewichten die Einzel-Scores unterschiedlich zu einem `compositeScore`. Fehlt ein
  Einzel-Score, wird die Gewichtung auf die verbleibenden neu normiert statt den fehlenden Wert
  als 0 zu zählen.

Es gibt also **keinen einzelnen finalen „AI Score"** im neuen System — nur diese Bausteine.

## ✅ Was der Chatbot bereits kann

- **Echtes Tool-Calling gegen die Anthropic API**, bis zu 5 Runden pro Antwort, 11 Daten-Tools
  (`get_portfolio_summary`, `get_opportunities`, `get_instrument`, `get_analysis`, `get_ranking`,
  `explain_term`, `get_market_overview`, `get_news`, `get_watchlist`, `get_fundamentals`,
  `export_analysis`) + 9 Präsentations-Tools.
- **10 strukturierte Antwort-Karten statt Fließtext** für alle instrumenten-/marktbezogenen
  Anfragetypen: `MarketAnalysisCard`, `ScoreAnalysisCard`, `RankingCard`, `SwotAnalysisCard`,
  `BullBearAnalysisCard`, `MarketOverviewCard`, `NewsSummaryCard`, `WatchlistOverviewCard`,
  `FundamentalsCard` und `ExportReadyCard` (Export ist terminal auf Erfolg, kein
  Präsentations-Tool — siehe „Export" unten).
- **Fundamentaldaten (Financial Modeling Prep)** — `get_fundamentals`/`present_fundamentals_analysis`:
  KGV, PEG, KUV, Verschuldungsgrad, Dividendenrendite, freier Cashflow je Aktie, EPS,
  Marktkapitalisierung, Sektor, Analysten-Konsensschätzungen. Volle Kennzahlen-Abdeckung nur für
  NVDA/MSFT/TSLA (`FUNDAMENTALS_COVERED_SYMBOLS` in `fmp.ts`); alle anderen Aktien bekommen
  `limitedCoverage:true` mit echtem Sektor/Marktkapitalisierung (FMPs ungegatetes
  `/profile`-Endpoint) und ehrlichem „nicht verfügbar" für die Kennzahlen, die diese
  Plan-Stufe nicht hergibt. Krypto/ETFs bekommen `found:false`, da die Kennzahlen dort
  konzeptionell nicht gelten.
- **Sektor-Anreicherung in Watchlist/Portfolio** — `get_watchlist` liefert ein `sector`-Feld je
  Aktienposition, `get_portfolio_summary` eine `sectorAllocation` + `sectorUnclassifiedNote` für
  ETFs/Krypto/nicht abgedeckte Aktien. Rein Chat-Tool-seitig (`computeSectorAllocation` in
  `tools.ts`) — Dashboard/Portfolio-Seite zeigen weiterhin keine Sektor-Aufteilung.
- **Bewertung + Score kombiniert** bei voll abgedeckten Symbolen — eine Score-/SWOT-/Bullen-
  Bären-/Markteinschätzungs-Anfrage zu NVDA/MSFT/TSLA ruft zusätzlich `get_fundamentals` auf und
  ordnet ein hohes KGV/PEG bei starkem Score explizit als Gegenargument ein (und umgekehrt).
- **Export der letzten Analyse als CSV/Word/PowerPoint** (`export_analysis`) — findet die zuletzt
  in diesem Gespräch erstellte strukturierte Analyse zu einem Instrument und liefert die fertige
  Datei direkt als Data-URL zurück (terminal, geht nicht nochmal durchs Modell, damit ein
  mehrere-KB-langer Base64-String nicht vom Modell abgetippt/beschädigt wird).
- **Kategorien-&-Vorlagen-Picker** (`promptTemplates.ts` + `PromptTemplatePicker.tsx`): 6
  Kategorien mit ~30 vorformulierten Prompt-Vorlagen. Vorlagen, die strukturell in eine bekannte
  Datenlücke laufen (PEG bei nicht abgedeckten Symbolen, Wettbewerbsvergleich, …), sind über
  `unavailableReason` als greyed-out mit Tooltip gekennzeichnet, bleiben aber klickbar.
- **Chart-Bild-Anhang ist tatsächlich bedingt, nicht nur per Prompt-Regel** —
  `lib/chat/chartRelevance.ts`s `isChartContextRelevant()` entscheidet CLIENT-SEITIG in
  `ChatPanel.tsx`, ob das aktuell im Chart-Panel gezeigte Instrument als Bild + Symbolmarkierung
  überhaupt mitgeschickt wird (explizite Ticker-/Namensnennung oder ein deiktisches Wort wie
  "das"/"es"/"aktuell" gepaart mit einer instrumentenbezogenen Frage). Das war im vorherigen Stand
  noch eine reine Prompt-Regel bei technisch immer mitgeschicktem Bild — jetzt technisch entkoppelt.
- **Umgang mit kurzen/mehrdeutigen Anschlussfragen** — Prioritätslogik im Prompt: (1) passt die
  Antwort zu einer selbst angebotenen Option → dieser folgen, (2) sonst erkennbar auf den Inhalt
  der vorherigen Antwort bezogen → darauf beziehen, (3) sonst kurz nachfragen statt zu raten.
- **Strukturierte Ausgabe gilt jetzt nachweislich auch für Anschlussfragen** (neueste Korrektur,
  siehe „Live gefundener und behobener Bug" unten) — eine Rückfrage wie „wieso MSFT?" zu einem
  Instrument aus einem vorherigen `present_ranking` löst jetzt erneut `get_analysis` +
  `present_score_analysis` aus statt eines Fließtext-Absatzes.
- **Ehrliche Rückfrage statt generischer Ausweichantwort bei fehlendem Ticker** (gleiche
  Korrektur) — eine Analyse-/Score-Anfrage ohne erkennbares Instrument ("analysiere mit score")
  führt jetzt zu einer konkreten Rückfrage ("Für welches Instrument möchtest du eine
  Score-Analyse? (z. B. SAP, MSFT, NVDA)") statt zur festen `chat-engine.ts`-Fallback-Antwort.
- **Bildungs-/Definitionsfragen als eigener Anfragetyp**, mit Abgrenzung zu Fragen, die wie eine
  Bildungsfrage klingen, aber tatsächlich eine personalisierte Empfehlung wollen.
- **Anti-Halluzinations-Regeln**, mehrfach abgesichert und per Guardrail-Tests
  (`client.test.ts`, aktuell über 20 Guardrail-Assertions plus ein behavioraler Test-Block, der
  den Anthropic-SDK-Client direkt mockt) gegen versehentliches Löschen geschützt.

## ❌ Was der Chatbot nicht kann

- **Fundamentaldaten nur für 3 Symbole vollständig** — NVDA/MSFT/TSLA haben KGV/PEG/KUV/
  Verschuldungsgrad/Dividendenrendite/EPS/Cashflow/Analystenschätzungen; jede andere Aktie
  bekommt nur Sektor + Marktkapitalisierung, Krypto/ETFs gar nichts davon (konzeptionell nicht
  anwendbar). Ein höherer FMP-Tarif oder ein Zweitanbieter würde das erweitern, ist aber noch
  nicht entschieden.
- **Keine Bewertungsmodelle, die Bilanzdaten voraussetzen** — EV/EBITDA, EV/EBIT, DCF,
  Sum-of-the-Parts, Dividend-Discount-Model. Der Bot sagt das ehrlich und bietet die vorhandenen
  KGV/PEG/KUV-Kennzahlen als Alternative an (sofern das Symbol abgedeckt ist), statt ein Modell
  vorzutäuschen.
- **Kein VIX/Volatilitätsindex, keine Forex-/Währungspaar-Daten.** Genau wie MarketEnvironment
  strukturell `unavailable` — bewusst nicht durch eine erfundene Näherung ersetzt.
- **Nur 8 Symbole mit echten Live-Kurs-/News-Daten**: SAP, NVDA, MSFT, TSLA, ASML, BTC, ETH, SOL
  (Finnhub/Twelve Data). Jedes andere Symbol läuft auf deterministischen Simulationsdaten — das
  gilt unabhängig von der Fundamentaldaten-Abdeckung, die eine eigene, engere Symbolmenge hat.
- **Kein Quality-, Growth-, Valuation- oder echter Portfolio-Fit-Score** — nur die in „Wie der AI
  Score gebildet wird" gelisteten Kategorien existieren.
- **Keine Kursziele, keine Renditeprognosen** — bewusst, nicht als Lücke zu verstehen
  (Compliance-Entscheidung, siehe `Proejkt.md`).
- **Keine qualitative Unternehmensanalyse** (Management, Governance, Moats, Pricing Power,
  Netzwerkeffekte) und **kein Wettbewerbsvergleich über den 2-Symbol-Fundamentaldaten-Vergleich
  hinaus** (Marktanteile, vollständiges Branchen-Ranking) — beides mangels angebundener
  Research-/Peer-Datenquelle, der Bot benennt das ehrlich statt aus Weltwissen zu urteilen.
- **Keine „Quartalsdaten"-Kategorie im Vorlagen-Picker.** War in der ursprünglichen
  Kategorienliste genannt, aber ohne konkrete Vorlagen spezifiziert und deshalb bewusst
  weggelassen — könnte von Nutzern trotzdem erwartet werden.
- **Kein Tool-Ergebnis-Gedächtnis zwischen Chat-Turns** (bewusst so gebaut, siehe Prompt-Regel zu
  Nachfragen) — jede Anschlussfrage löst einen neuen vollständigen Tool-Aufruf aus.

## ⚠️ Was schwach ist

- **Live gefundener und behobener Bug (aktuellste Runde): Anschlussfragen zu einem
  Ranking-Instrument und Analyse-Anfragen ohne Ticker.** Eine Rückfrage wie „wieso MSFT?" nach
  einem `present_ranking`-Ergebnis wurde in Fließtext beantwortet statt über die gleiche
  `present_score_analysis`-Karte wie bei einer direkten Einzelanalyse — der Prompt verlangte
  strukturierte Ausgabe zwar für die *erste* Frage zu einem Instrument, aber nicht explizit für
  eine Anschlussfrage zu einem bereits genannten Ergebnis. Und „analysiere mit score" ohne
  erkennbaren Ticker landete (je nach Umständen) exakt bei `chat-engine.ts`s fester
  Fallback-Formulierung statt bei einer echten, kontextbezogenen Rückfrage der Claude-Anbindung.
  Behoben durch zwei neue, explizite Prompt-Regeln in `buildSystemPrompt()`
  ("Strukturierte Ausgabe ist verpflichtend, auch bei Anschlussfragen" /
  "Fehlender Ticker bei Analyse-/Score-Anfrage") plus Guardrail- und Verhaltens-Tests in
  `client.test.ts`. **Wichtig zum Reproduzieren, falls die generische
  `chat-engine.ts`-Formulierung nochmal auftaucht:** die kann nur aus zwei Stellen in `client.ts`
  kommen — fehlender `CLAUDE_CHATBOT_API_KEY`, oder eine geworfene Exception im
  `try`-Block (geloggt als `[FinaraAI] Anthropic call failed, ...`). Mit gültigem Key im Log
  nachsehen statt einen Prompt-/Routing-Fehler zu vermuten.
- **Frühere, weiterhin gültige Lektion: neue `present_*`-Tools müssen an zwei Stellen
  eingetragen werden.** `client.ts`s Anthropic-Loop erkennt einen `present_*`-Aufruf als „das ist
  die finale Karte" über die `presentationTypes`-Map. Ein Tool, das nur ins `presentationTools`-
  Array, aber nicht in diese Map eingetragen wird, fällt auf `runFinanceTool`s
  `"Unbekanntes Tool."`-Fallback zurück — bereits einmal live passiert (5 Etappe-8-Tools). Ein
  bidirektionaler Test in `client.test.ts` fängt das jetzt ohne Live-API-Call ab, aber es bleibt
  ein Punkt, an dem ein neues Tool durch reines Vergessen unbemerkt durchrutschen kann, wenn der
  Test nicht mitgepflegt wird.
- **Automatisierte Tests decken die Prompt-Regeln nur als Text-Guardrails ab, nicht als echtes
  Modellverhalten.** Die meisten `client.test.ts`-Tests prüfen per Regex, dass eine Regel im
  System-Prompt-Text noch vorhanden ist — nicht, dass ein echtes Modell sich auch daran hält. Die
  neuen Tests zur Anschlussfragen-/Fehlender-Ticker-Korrektur ergänzen erstmals einen
  Verhaltens-Test-Block, der den Anthropic-SDK-Client direkt mockt (`vi.mock("@anthropic-ai/sdk")`)
  und die echte Routing-Logik in `generateFinaraReply()` prüft — das validiert aber weiterhin nur
  den Code-Pfad bei einer gemockten Modell-Antwort, nicht das tatsächliche Sprachverständnis eines
  echten Claude-Aufrufs. Für Etappe-8-Karten/-Tools (`get_market_overview`, `get_news`,
  `get_watchlist`, die Karten-Parser) existiert weiterhin kein automatisierter Test — nur manuelle
  Verifikation im Browser laut `CHATBOT_TODO.txt`.
- **Mehrere Vorlagen-Buttons führen strukturell in bekannte Datenlücken** (DCF, EV/EBITDA,
  Wettbewerbsvergleich, Makroanalyse pro Instrument) — jetzt zwar über `unavailableReason` als
  greyed-out mit Tooltip gekennzeichnet, aber der Bot antwortet dort weiterhin nur mit ehrlichem
  „nicht verfügbar", nie mit dem eigentlich gewünschten Ergebnis.
- **Score-/Datenkonventionen mussten bereits mehrfach aus Erfahrung nachgeschärft werden** — die
  Regel „Risk-Score: höher = risikoärmer" wurde einmal live falsch interpretiert, bevor sie
  explizit im Prompt stand; die Anschlussfragen-/Fehlender-Ticker-Lücke ist ein weiteres Beispiel.
  Zeigt weiterhin: jede nicht-triviale Konvention muss dort stehen, wo das Modell sie tatsächlich
  sieht, sonst wird sie irgendwann live falsch gehandhabt.
- **Kein Zusammenspiel mit Dashboard/OpportunityCards/Portfolio-Sektoransicht.** Die dort
  angezeigten `aiScore`-Werte sind weiterhin die alten statischen Platzhalterzahlen, und die neue
  Sektorallokation existiert nur im Chat-Tool, nicht auf der Portfolio-Seite selbst.
- **Rate-Limit-Absicherung existiert (`rateLimitQueue.ts`), ist aber ein gemeinsamer Engpass.**
  Twelve Data 8 Anfragen/Minute und FMP 250/Tag gelten prozessweit, nicht pro Nutzer — durch
  `watchlistOnly`-Rankings, Sektor-Anreicherung und Bewertungs-Kombination potenziell mehr
  gleichzeitige Anfragen an beide Anbieter als noch vor der FMP-Erweiterung.
- **Der Tool-Katalog pro Anthropic-Request ist auf 20 Tools gewachsen** (11 Daten-Tools + 9
  Präsentations-Tools). Größere Tool-Definitionen pro Request kosten mehr Input-Tokens; noch nicht
  gemessen, ob das für Kosten/Latenz relevant wird.

## Was als Nächstes gebraucht wird — priorisiert

1. **Mehr Verhaltens-Tests statt nur Prompt-Guardrails** — der neue gemockte
   `generateFinaraReply()`-Test-Block (siehe oben) ist als Muster da; auf weitere Anfragetypen
   ausweiten (SWOT-/Bullen-Bären-/Markttrend-/News-Routing, `export_analysis`-Terminalpfad), damit
   ein künftiger Prompt-Edit nicht nur textlich, sondern auch am tatsächlichen Code-Pfad geprüft
   wird.
2. **Rechtliche Prüfung des sichtbaren Scores** — weiterhin ungeklärt.
3. **Score-/Sektor-Integration in Dashboard/Watchlist/Portfolio-Seiten**, damit die echte Analyse
   und die Sektorallokation nicht nur im Chat sichtbar sind.
4. **Entscheidung: höherer FMP-Tarif oder Zweitanbieter**, um die Fundamentaldaten-Abdeckung über
   NVDA/MSFT/TSLA hinaus zu erweitern.
5. **Analyse-spezifisches Caching über die bestehende 90s-Cache-Schicht hinaus prüfen**, sobald
   mehrere Nutzer gleichzeitig regelmäßig `get_analysis`/`get_ranking`/`get_fundamentals`
   aufrufen — der gemeinsame Rate-Limit-Engpass ist real, nicht nur theoretisch.
6. **Mehr live angebundene Symbole**, falls gewünscht — aktuell hart auf 8 (Marktdaten) bzw. 3
   (volle Fundamentaldaten) begrenzt.
7. **Automatisierter End-to-End-Test des echten Tool-Loops** über den `client.test.ts`-Mock-Ansatz
   hinaus — mit 20 Tools im Katalog wäre ein Regressionsfall wie die
   Präsentations-Tool-Erkennung oder die Anschlussfragen-Lücke künftig noch zuverlässiger vor dem
   Live-Test auffindbar.
