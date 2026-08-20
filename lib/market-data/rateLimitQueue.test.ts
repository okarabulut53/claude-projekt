import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetTwelveDataRateLimitStateForTests,
  markTwelveDataRateLimited,
  runTwelveDataRateLimited,
  wasTwelveDataRateLimitedRecently,
} from "./rateLimitQueue";

beforeEach(() => {
  vi.useFakeTimers();
  __resetTwelveDataRateLimitStateForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runTwelveDataRateLimited", () => {
  it("runs up to 8 calls immediately within one rolling window", async () => {
    const order: number[] = [];
    const tasks = Array.from({ length: 8 }, (_, i) => runTwelveDataRateLimited(async () => order.push(i)));
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all(tasks);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("queues the 9th call instead of firing it in parallel with the first 8", async () => {
    const order: number[] = [];
    const first8 = Array.from({ length: 8 }, (_, i) => runTwelveDataRateLimited(async () => order.push(i)));
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all(first8);

    let ninthRan = false;
    const ninth = runTwelveDataRateLimited(async () => {
      ninthRan = true;
      order.push(8);
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(ninthRan).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    await ninth;
    expect(ninthRan).toBe(true);
    expect(order[8]).toBe(8);
  });

  it("preserves FIFO order across a burst larger than the window capacity", async () => {
    const order: number[] = [];
    const tasks = Array.from({ length: 10 }, (_, i) => runTwelveDataRateLimited(async () => order.push(i)));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.all(tasks);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("still runs a later call even if an earlier queued call rejects", async () => {
    const results: string[] = [];
    const failing = runTwelveDataRateLimited(async () => {
      throw new Error("boom");
    });
    // Attach the rejection assertion synchronously, before advancing timers lets it actually
    // reject — otherwise Node flags it as an (unhandled-at-the-time) rejection even though it's
    // awaited a line later.
    const failingAssertion = expect(failing).rejects.toThrow("boom");
    const succeeding = runTwelveDataRateLimited(async () => {
      results.push("ok");
    });
    await vi.advanceTimersByTimeAsync(0);
    await failingAssertion;
    await succeeding;
    expect(results).toEqual(["ok"]);
  });
});

describe("markTwelveDataRateLimited / wasTwelveDataRateLimitedRecently", () => {
  it("is false before any rate limit hit", () => {
    expect(wasTwelveDataRateLimitedRecently()).toBe(false);
  });

  it("is true shortly after a rate limit hit", () => {
    markTwelveDataRateLimited();
    expect(wasTwelveDataRateLimitedRecently()).toBe(true);
  });

  it("expires after the given window", async () => {
    markTwelveDataRateLimited();
    await vi.advanceTimersByTimeAsync(90_001);
    expect(wasTwelveDataRateLimitedRecently(90_000)).toBe(false);
  });
});
