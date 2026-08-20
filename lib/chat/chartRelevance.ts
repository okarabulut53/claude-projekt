/**
 * Decides whether the chart image currently shown in the chart panel should be attached to an
 * outgoing chat message. Previously ChatPanel.tsx attached it to EVERY message regardless of
 * relevance, relying only on a prompt-level rule (buildSystemPrompt's "Umgang mit kurzen/
 * mehrdeutigen Anschlussfragen" section) to tell Claude not to over-weight it — live-observed bug:
 * user asked for examples following a strategy explanation ("gib mir Beispiele"), and the model
 * answered with a full analysis of the unrelated ticker sitting in the chart panel instead. This
 * is the technical fix: don't send the image/ticker label at all unless the message itself gives
 * a reason to think it's relevant.
 *
 * Deliberately a small, self-contained heuristic rather than importing lib/mock/instruments.ts's
 * seed list — that module pulls in server-only market-data fetch code (Finnhub/Twelve Data
 * clients) that has no business in the client bundle. KNOWN_INSTRUMENTS mirrors that seed list's
 * symbols/names; keep the two in sync by hand if instruments are added or renamed there.
 */
interface KnownInstrument {
  symbol: string;
  aliases: string[];
}

const KNOWN_INSTRUMENTS: KnownInstrument[] = [
  { symbol: "SAP", aliases: ["sap se"] },
  { symbol: "SIE", aliases: ["siemens"] },
  { symbol: "ALV", aliases: ["allianz"] },
  { symbol: "DTE", aliases: ["deutsche telekom", "telekom"] },
  { symbol: "NVDA", aliases: ["nvidia"] },
  { symbol: "MSFT", aliases: ["microsoft"] },
  { symbol: "TSLA", aliases: ["tesla"] },
  { symbol: "ASML", aliases: ["asml"] },
  { symbol: "IUSA", aliases: ["ishares core s&p 500", "ishares s&p 500"] },
  { symbol: "EXW1", aliases: ["ishares core dax"] },
  { symbol: "VWCE", aliases: ["vanguard ftse all-world", "all-world etf"] },
  { symbol: "BTC", aliases: ["bitcoin"] },
  { symbol: "ETH", aliases: ["ethereum"] },
  { symbol: "SOL", aliases: ["solana"] },
];

// Ticker symbols are matched case-sensitively (all-caps) on purpose: several of them collide with
// common German words in lowercase/titlecase form — "SIE" (Siemens) vs. "Sie"/"sie" (the formal
// "you"/"they" pronoun) is the sharpest example. Case-insensitive matching would treat almost
// every formally-worded message as "mentions Siemens".
function messageMentionsSymbol(message: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(message);
}

function messageMentionsInstrument(message: string, instrument: KnownInstrument): boolean {
  if (messageMentionsSymbol(message, instrument.symbol)) return true;
  const lower = message.toLowerCase();
  return instrument.aliases.some((alias) => lower.includes(alias));
}

// "das"/"es"/"dazu" etc. only signal a reference to *something* — combined with a word that
// suggests the something is a chart/instrument (not, say, a strategy or a glossary term), it's a
// reasonable guess that the user means the currently-charted instrument.
const DEICTIC_PATTERN =
  /\b(das|es|dazu|davon|aktuell|derzeit|im\s+chart|im\s+diagramm|diese[rs]?\s+(?:aktie|wert|papier|titel|instrument))\b/i;
const INSTRUMENT_QUESTION_PATTERN =
  /\b(wie\s+sieht.*aus|analyse|trend|einschätzung|einschaetzung|kurs|chart|entwicklung|verlauf|performance|bewertung|chance|risiko)\b/i;

/**
 * @param message the outgoing user message, unmodified
 * @param chartSymbol the symbol currently shown in the chart panel
 * @param chartName the instrument's display name, if available (improves name-based matching)
 */
export function isChartContextRelevant(message: string, chartSymbol: string, chartName?: string): boolean {
  const chartInstrument = KNOWN_INSTRUMENTS.find((i) => i.symbol === chartSymbol) ?? {
    symbol: chartSymbol,
    aliases: chartName ? [chartName.toLowerCase()] : [],
  };

  const mentionsChart = messageMentionsInstrument(message, chartInstrument);
  const mentionsOtherInstrument = KNOWN_INSTRUMENTS.some(
    (i) => i.symbol !== chartSymbol && messageMentionsInstrument(message, i),
  );

  // An explicit mention of a different instrument means the message is about that instrument, not
  // the one currently in the chart panel — attaching the chart image here would show the wrong
  // chart, not just an irrelevant one.
  if (mentionsOtherInstrument && !mentionsChart) return false;
  if (mentionsChart) return true;

  return DEICTIC_PATTERN.test(message) && INSTRUMENT_QUESTION_PATTERN.test(message);
}
