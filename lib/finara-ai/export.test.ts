import { describe, expect, it } from "vitest";
import { exportToCsv, exportToDocx, exportToPptx } from "./export";
import { ExportableAnalysis, findExportableAnalysis } from "./exportData";
import { ChatMessage } from "@/lib/types";

const sample: ExportableAnalysis = {
  instrument: "SAP",
  typ: "Score-Analyse",
  datum: "2026-08-20T10:00:00.000Z",
  rows: [
    { faktor: "RSI(14)", wert: "54,2", score: "", begruendung: "neutral" },
    { faktor: "Technical", wert: "", score: "56", begruendung: "leicht positiv" },
  ],
  gesamtscore: "78",
  konfidenz: "mittel",
  bullCase: "Starkes Momentum",
  baseCase: "Seitwärts",
  bearCase: "Überkauft",
  summary: "Gemischtes Bild.",
};

// zip-based formats (docx/pptx) always start with the "PK" local-file-header signature.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b]);

describe("exportToCsv", () => {
  it("produces a header row plus one row per factor", () => {
    const csv = exportToCsv(sample).toString("utf-8");
    expect(csv).toContain("Faktor,Wert,Score,Begründung");
    expect(csv).toContain("RSI(14)");
    expect(csv).toContain("leicht positiv");
  });

  it("quotes values containing commas", () => {
    const withComma: ExportableAnalysis = { ...sample, rows: [{ faktor: "A, B", wert: "", score: "", begruendung: "x" }] };
    const csv = exportToCsv(withComma).toString("utf-8");
    expect(csv).toContain('"A, B"');
  });
});

describe("exportToDocx", () => {
  it("produces a real, non-empty zip-based .docx buffer", async () => {
    const buffer = await exportToDocx(sample);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2)).toEqual(ZIP_SIGNATURE);
  });
});

describe("exportToPptx", () => {
  it("produces a real, non-empty zip-based .pptx buffer", async () => {
    const buffer = await exportToPptx(sample);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2)).toEqual(ZIP_SIGNATURE);
  });
});

function assistantMessage(content: unknown): ChatMessage {
  return { id: "m1", threadId: "t1", role: "assistant", content: JSON.stringify(content), createdAt: "2026-08-20T10:00:00.000Z" };
}

describe("findExportableAnalysis", () => {
  it("finds the most recent structured analysis matching the instrument", () => {
    const history: ChatMessage[] = [
      assistantMessage({ type: "score_analysis", symbol: "NVDA", technicalIndicators: [], factors: [], confidence: "hoch", overallScore: 84 }),
      { id: "u1", threadId: "t1", role: "user", content: "und SAP?", createdAt: "2026-08-20T10:01:00.000Z" },
      assistantMessage({
        type: "swot_analysis",
        symbol: "SAP",
        strengths: ["Stark"],
        weaknesses: ["Schwach"],
        opportunities: ["Chance"],
        risks: ["Risiko"],
        summary: "Fazit",
      }),
    ];
    const result = findExportableAnalysis(history, "SAP");
    expect(result?.instrument).toBe("SAP");
    expect(result?.typ).toBe("SWOT-Analyse");
    expect(result?.rows).toHaveLength(4);
  });

  it("returns null when no analysis for that instrument exists", () => {
    const history: ChatMessage[] = [assistantMessage({ type: "score_analysis", symbol: "NVDA" })];
    expect(findExportableAnalysis(history, "TSLA")).toBeNull();
  });

  it("falls back to the most recent ranking when no single-instrument analysis matches", () => {
    const history: ChatMessage[] = [
      assistantMessage({
        type: "ranking",
        period: "heute",
        candidatesTotal: 2,
        scopeNote: "Testumfang",
        rows: [{ rank: 1, symbol: "NVDA", name: "NVIDIA", assetClass: "stock", compositeScore: 84, driver: "Momentum" }],
      }),
    ];
    const result = findExportableAnalysis(history, "meine Watchlist");
    expect(result?.typ).toBe("Score-Ranking");
    expect(result?.rows).toHaveLength(1);
  });
});
