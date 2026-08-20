import { describe, expect, it } from "vitest";
import { isChartContextRelevant } from "./chartRelevance";

describe("isChartContextRelevant", () => {
  it("regression: a topic-shift follow-up after a strategy explanation must NOT pull in the chart ticker", () => {
    // Live-observed bug (see CHATBOT_ANALYSE.md): user got a Momentum/Balanced/Intraday strategy
    // explanation, then asked "gib mir Beispiele" while SAP happened to be shown in the chart
    // panel — the bot ignored the actual conversation and answered with a full SAP analysis
    // instead. The message names no instrument and has no deictic-plus-instrument-question
    // pattern, so the chart image must not be attached.
    expect(isChartContextRelevant("gib mir Beispiele", "SAP", "SAP SE")).toBe(false);
  });

  it("attaches when the message explicitly names the charted instrument's symbol", () => {
    expect(isChartContextRelevant("Wie sieht NVDA aktuell aus?", "NVDA", "NVIDIA Corp.")).toBe(true);
  });

  it("attaches when the message explicitly names the charted instrument by name", () => {
    expect(isChartContextRelevant("Was hältst du von Siemens?", "SIE", "Siemens AG")).toBe(true);
  });

  it("does NOT attach when the message names a different instrument than the one charted", () => {
    expect(isChartContextRelevant("Wie sieht NVDA aus?", "SAP", "SAP SE")).toBe(false);
  });

  it("attaches on a deictic follow-up combined with an instrument-shaped question", () => {
    expect(isChartContextRelevant("wie sieht's aktuell aus?", "SAP", "SAP SE")).toBe(true);
    expect(isChartContextRelevant("zeig mir eine Analyse dazu", "TSLA", "Tesla Inc.")).toBe(true);
  });

  it("does NOT attach for a plain educational question with no instrument or deictic reference", () => {
    expect(isChartContextRelevant("Was ist RSI?", "SAP", "SAP SE")).toBe(false);
  });

  it("does NOT attach for a general portfolio question unrelated to the chart", () => {
    expect(isChartContextRelevant("Wie hoch ist mein Gesamtportfolio-Wert?", "NVDA", "NVIDIA Corp.")).toBe(false);
  });

  it("does not false-positive on 'Sie' (formal address) colliding with the SIE ticker", () => {
    // "SIE" (Siemens) is matched case-sensitively for exactly this reason — a capitalized German
    // "Sie" (formal you/they) must not be read as a Siemens mention.
    expect(isChartContextRelevant("Können Sie mir das erklären?", "SAP", "SAP SE")).toBe(false);
  });

  it("attaches when both the charted instrument and another instrument are named together", () => {
    expect(isChartContextRelevant("Vergleiche SAP und NVDA", "SAP", "SAP SE")).toBe(true);
  });
});
