/**
 * Kategorien & Vorlagen für den Prompt-Picker im Chat (analog zu WarrenAI/Investing.com):
 * der Nutzer klickt Kategorie → Unterfrage, die Vorlage wird ins Eingabefeld eingesetzt
 * (nicht automatisch abgeschickt). Templates mit {ticker}/{ticker1}/{ticker2} verlangen vorher
 * eine Instrument-Eingabe, siehe PromptTemplatePicker.tsx.
 */
export interface PromptTemplate {
  label: string;
  prompt: string;
  /**
   * Set when this template structurally leads into a documented finara data gap (see
   * CLAUDE.md's "Data layer" section and lib/finara-ai/client.ts's "Fragen zu Kennzahlen, die bei
   * finara aktuell nicht verfügbar sind" rule) — FinaraAI will honestly answer "nicht verfügbar"
   * rather than fabricate a number, but a user clicking the button has no way to know that in
   * advance. PromptTemplatePicker.tsx shows this as a greyed-out state with a tooltip instead of
   * silently leading nowhere. The template stays clickable — the honest "not available" answer is
   * itself useful, this is a heads-up, not a hard block.
   */
  unavailableReason?: string;
}

export interface PromptCategory {
  id: string;
  label: string;
  templates: PromptTemplate[];
}

export const promptCategories: PromptCategory[] = [
  {
    id: "aktienauswahl",
    label: "Aktienauswahl & -analyse",
    templates: [
      {
        label: "Bullen oder Bären",
        prompt:
          "Erstelle eine Bullen-vs-Bären-Analyse für {ticker}: liste die 3-4 stärksten Argumente für eine positive Entwicklung und die 3-4 stärksten Argumente für eine negative Entwicklung auf.",
      },
      {
        label: "SWOT-Analyse",
        prompt: "Erstelle eine SWOT-Analyse für {ticker} (Stärken, Schwächen, Chancen, Risiken).",
      },
      {
        label: "Welches sind die fünf besten Wachstumsaktien?",
        prompt: "Nenne aus deiner Kandidatenliste die 5 Instrumente mit dem stärksten Wachstumsprofil (Umsatzwachstum, EPS-Wachstum).",
      },
      {
        label: "Beste Dividendenaktien über 4%",
        prompt: "Zeige Instrumente aus deiner Kandidatenliste mit einer Dividendenrendite über 4%, sortiert absteigend.",
      },
      {
        label: "Analyse des PEG-Verhältnisses",
        prompt: "Analysiere das PEG-Verhältnis von {ticker} und ordne es ein.",
      },
      {
        label: "Analystenkonsens",
        prompt: "Zeige den aktuellen Analystenkonsens für {ticker} (Buy/Hold/Sell-Verteilung, Kursziele).",
      },
      {
        label: "Anlagerisiken",
        prompt: "Nenne die wichtigsten Anlagerisiken von {ticker} (unternehmensspezifisch, sektorspezifisch, makroökonomisch).",
      },
      {
        label: "Schuldenanalyse",
        prompt: "Führe eine Schuldenanalyse für {ticker} durch: Verschuldungsgrad, Zinsdeckung, Fälligkeitsstruktur.",
      },
      {
        label: "Bewertungsanalyse",
        prompt: "Erstelle eine Bewertungsanalyse für {ticker} anhand von KGV, PEG und KUV und ordne sie ein.",
      },
      {
        label: "KUV-Analyse",
        prompt: "Analysiere das Kurs-Umsatz-Verhältnis (KUV) von {ticker} und ordne es ein.",
      },
      {
        label: "EPS-Wachstum",
        prompt: "Zeige das aktuelle EPS von {ticker} sowie die Analysten-Konsensschätzung für die kommenden Geschäftsjahre und ordne den Wachstumstrend ein.",
      },
    ],
  },
  {
    id: "markttrends",
    label: "Markttrends",
    templates: [
      {
        label: "Marktvolatilität",
        prompt: "Wie ist die aktuelle Marktvolatilität einzuordnen (z.B. VIX-Niveau)?",
      },
      {
        label: "Trends bei US-Indizes",
        prompt: "Fasse die aktuellen Trends bei S&P 500, Nasdaq und Dow Jones zusammen.",
      },
      {
        label: "Forex-Trends",
        prompt: "Welche Trends zeigen sich aktuell bei den wichtigsten Währungspaaren?",
        unavailableReason: "Benötigt Forex-/Währungspaar-Daten, bei finara aktuell nicht angebunden.",
      },
      {
        label: "Markttreiber",
        prompt: "Was sind aktuell die wichtigsten Treiber der Marktbewegungen?",
      },
    ],
  },
  {
    id: "technische-einblicke",
    label: "Technische Einblicke",
    templates: [
      {
        label: "Technische Zusammenfassung",
        prompt: "Erstelle eine technische Zusammenfassung für {ticker} (alle Indikatoren gebündelt).",
      },
      {
        label: "RSI-Analyse",
        prompt: "Führe eine detaillierte RSI-Analyse für {ticker} durch, inkl. Einordnung von überkauft/überverkauft.",
      },
      {
        label: "Unterstützungs- und Widerstandsniveaus",
        prompt: "Bestimme die wichtigsten Unterstützungs- und Widerstandsniveaus für {ticker}.",
      },
      {
        label: "Gleitende Durchschnitte",
        prompt: "Analysiere die gleitenden Durchschnitte (SMA 20/50/200) von {ticker} und deren aktuelle Signale.",
      },
      {
        label: "Technischer Vergleich",
        prompt: "Vergleiche {ticker1} und {ticker2} anhand ihrer technischen Indikatoren.",
      },
    ],
  },
  {
    id: "watchlist",
    label: "Watchlist-Einblicke",
    templates: [
      {
        label: "Risikoanalyse zur Watchlist",
        prompt: "Analysiere das Risiko meiner gesamten Watchlist (Konzentration, Korrelation, Volatilität).",
      },
      {
        label: "News zur Watchlist",
        prompt: "Zeige aktuelle Nachrichten zu den Instrumenten meiner Watchlist.",
      },
      {
        label: "Sektorallokation",
        prompt: "Zeige die Sektorverteilung meiner Watchlist.",
        unavailableReason: "Benötigt Sektor-Klassifikationsdaten, bei finara aktuell nicht angebunden.",
      },
      {
        label: "Chance-Risiko-Analyse",
        prompt: "Bewerte das Chance-Risiko-Verhältnis meiner gesamten Watchlist.",
      },
    ],
  },
  {
    id: "screener",
    label: "Screener",
    templates: [
      {
        label: "Momentum-Aktien",
        prompt: "Zeige aus deiner Kandidatenliste die Instrumente mit dem stärksten positiven Momentum (RSI, MACD).",
      },
      {
        label: "Unterbewertete Aktien",
        prompt: "Zeige aus deiner Kandidatenliste Instrumente, die nach KGV und PEG aktuell unterbewertet erscheinen.",
        unavailableReason: "Fundamentaldaten sind aktuell nur für einzelne Symbole (NVDA, MSFT, TSLA) verfügbar, nicht als Filter über die gesamte Kandidatenliste — die Antwort wird sich auf einzelne Instrumente beschränken müssen.",
      },
      {
        label: "Defensive Aktien",
        prompt: "Zeige aus deiner Kandidatenliste defensive Instrumente mit geringer Volatilität.",
      },
    ],
  },
  {
    id: "nachrichten",
    label: "Nachrichten",
    templates: [
      {
        label: "Neues von der Zentralbank",
        prompt: "Fasse die neuesten Zentralbank-Nachrichten und deren mögliche Marktauswirkungen zusammen.",
      },
      {
        label: "Aktiennachrichten",
        prompt: "Fasse die wichtigsten aktuellen Nachrichten zu {ticker} zusammen.",
      },
      {
        label: "Zusammenfassung der Marktnachrichten",
        prompt: "Fasse die wichtigsten aktuellen Marktnachrichten insgesamt zusammen.",
      },
    ],
  },
];
