import { describe, expect, it } from "vitest";
import { computeMarketStatus } from "./marketStatus";

describe("computeMarketStatus", () => {
  it("reports 'schließt in X Minuten' for a simulated timestamp shortly before the US close", () => {
    // 2026-08-20 is a Thursday. 15:45 ET during EDT (UTC-4) = 19:45 UTC, 15 minutes before the
    // 16:00 ET regular-session close.
    const at = new Date("2026-08-20T19:45:00.000Z");

    const result = computeMarketStatus("US", at);

    expect(result.status).toBe("open");
    expect(result.minutesToNextChange).toBe(15);
    expect(result.nextChangeLabel).toMatch(/Handelsschluss in 15 Min \(16:00 ET\)/);
  });

  it("reports the next opening time when the US market is closed on a weekend", () => {
    // 2026-08-22 is a Saturday, 12:00 ET (UTC-4) = 16:00 UTC.
    const at = new Date("2026-08-22T16:00:00.000Z");

    const result = computeMarketStatus("US", at);

    expect(result.status).toBe("closed");
    expect(result.nextChangeLabel).toMatch(/Nächste Handelsöffnung/);
    expect(result.minutesToNextChange).toBeGreaterThan(0);
  });

  it("reports XETRA as open during its own session window, independent of the US session", () => {
    // 2026-08-20 (Thursday), 10:00 CEST (UTC+2) = 08:00 UTC — inside XETRA's 9:00-17:30 CET
    // session but before the US market has even opened.
    const at = new Date("2026-08-20T08:00:00.000Z");

    const result = computeMarketStatus("XETRA", at);

    expect(result.status).toBe("open");
    expect(result.nextChangeLabel).toMatch(/Handelsschluss.*17:30 CET/);
  });

  it("reports crypto markets as always-open 24/7 with no next-change timer", () => {
    const result = computeMarketStatus("CRYPTO", new Date("2026-08-22T16:00:00.000Z"));

    expect(result.status).toBe("24-7");
    expect(result.minutesToNextChange).toBeNull();
    expect(result.nextChangeLabel).toBeNull();
  });

  it("flags that exchange holidays are not modeled, on every result", () => {
    expect(computeMarketStatus("US", new Date()).holidaysNotModeled).toBe(true);
  });
});
