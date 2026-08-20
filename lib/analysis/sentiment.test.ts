import { describe, expect, it } from "vitest";
import { computeSentimentScore } from "./sentiment";

describe("computeSentimentScore", () => {
  it("is unavailable when no news items are given", () => {
    const result = computeSentimentScore([]);
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.unavailableReason).toMatch(/Keine News-Treffer/);
  });

  it("is unavailable when news items contain no recognized keyword", () => {
    const result = computeSentimentScore([{ title: "Quartalsbericht veröffentlicht", summary: "Zahlen liegen vor." }]);
    expect(result.availability).toBe("unavailable");
    expect(result.unavailableReason).toMatch(/keiner enthält ein erkanntes Sentiment-Schlagwort/);
  });

  it("scores clearly above neutral (50) for unambiguously positive news", () => {
    const result = computeSentimentScore([
      { title: "Unternehmen übertrifft Erwartungen deutlich", summary: "Starkes Wachstum, Rekordgewinn und positive Analysten-Reaktion." },
    ]);
    expect(result.availability).toBe("available");
    expect(result.score!).toBeGreaterThan(50);
  });

  it("scores clearly below neutral (50) for unambiguously negative news", () => {
    const result = computeSentimentScore([
      { title: "Unternehmen verfehlt Erwartungen deutlich", summary: "Rückgang, Verlust und Warnung vor weiterer Krise." },
    ]);
    expect(result.availability).toBe("available");
    expect(result.score!).toBeLessThan(50);
  });

  it("scores exactly neutral (50) when positive and negative hits balance out", () => {
    const result = computeSentimentScore([{ title: "Wachstum trotz Verlust", summary: "Gemischtes Bild aus Gewinn und Rückgang." }]);
    expect(result.availability).toBe("available");
    expect(result.score).toBe(50);
  });

  it("aggregates across multiple news items, not just the first", () => {
    const result = computeSentimentScore([
      { title: "Stabiler Ausblick", summary: "Keine besonderen Ereignisse." },
      { title: "Rekordgewinn übertrifft Erwartungen", summary: "Starkes Wachstum bestätigt." },
    ]);
    expect(result.availability).toBe("available");
    expect(result.score!).toBeGreaterThan(50);
  });
});
