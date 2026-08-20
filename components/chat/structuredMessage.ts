/**
 * Structured chat messages (present_market_analysis/present_score_analysis/present_ranking) are
 * normally stored as a single JSON string with nothing else — client.ts's terminal tool-call
 * return produces exactly that. But the model doesn't always actually invoke the presentation
 * tool: observed live (see the Intraday-Score/Ranking extension's verification) that for a
 * ranking request, Claude sometimes writes the intended present_ranking JSON out as its own text
 * answer, followed by additional prose commentary, instead of issuing a real tool call — so the
 * stored content is `{...json...}` + trailing text, which plain JSON.parse rejects (trailing
 * non-whitespace after a valid value is a syntax error). Falling back to a plain-text bubble in
 * that case would show the user raw, broken-looking JSON. Extracting the leading balanced JSON
 * object and parsing just that (dropping the trailing prose) is a strictly better outcome than
 * showing the raw text — the card still renders correctly from real, non-fabricated numbers.
 */
export function extractLeadingJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escapeNext) escapeNext = false;
      else if (ch === "\\") escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Tries a strict JSON.parse of the whole string first (the expected shape for a real tool
 *  call), then falls back to extracting just the leading JSON object. */
export function parseStructuredMessage(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return extractLeadingJsonObject(content);
  }
}

/** Reads the optional suggestedFollowUp field generically off whichever present_*-tool JSON
 *  produced this message — every card type carries the same field (see tools.ts's
 *  SUGGESTED_FOLLOW_UP_PROPERTY), so this doesn't need a per-card-type parser like the others. */
export function parseSuggestedFollowUp(content: string): string | null {
  const parsed = parseStructuredMessage(content) as { suggestedFollowUp?: unknown } | null;
  return parsed && typeof parsed.suggestedFollowUp === "string" && parsed.suggestedFollowUp.trim()
    ? parsed.suggestedFollowUp.trim()
    : null;
}
