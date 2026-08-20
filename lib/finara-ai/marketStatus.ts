/**
 * Pure, serverside market-hours calculation — deliberately not a call to Finnhub's
 * /stock/market-status endpoint (that endpoint is plan-gated on several free-tier setups and
 * would add a 5th external dependency for something regular trading-hours arithmetic already
 * answers). US/XETRA session windows are hardcoded per the product spec; DST is handled by
 * reading the exchange's local wall-clock time via Intl (so 9:30 ET is correctly 13:30 or 14:30
 * UTC depending on the time of year) rather than a fixed UTC offset. Exchange holidays are NOT
 * modeled — there's no holiday-calendar data source wired up, so e.g. a US market holiday still
 * reports "open" if it falls on a weekday during session hours. That's a known, documented gap,
 * not a silent wrong answer dressed up as authoritative.
 */

export type MarketStatusValue = "open" | "closed" | "pre-market" | "after-hours" | "24-7";

export interface MarketStatusResult {
  exchange: "US" | "XETRA" | "CRYPTO";
  status: MarketStatusValue;
  /** "HH:MM" in the exchange's local time (or the instant's UTC time for crypto). */
  localTime: string;
  /** Minutes until the next open/close transition. Null for 24/7 crypto markets. */
  minutesToNextChange: number | null;
  /** Human-readable German label for the next transition, e.g. "Handelsschluss in 12 Min (16:00 ET)". Null for crypto. */
  nextChangeLabel: string | null;
  /** No exchange-holiday calendar is wired up — a holiday during session hours still reports "open". */
  holidaysNotModeled: true;
  asOf: string;
}

interface SessionConfig {
  timeZone: string;
  label: string;
  preMarketOpen: number;
  open: number;
  close: number;
  afterHoursClose: number;
}

// Minutes-of-day (exchange-local wall clock).
const SESSIONS: Record<"US" | "XETRA", SessionConfig> = {
  US: { timeZone: "America/New_York", label: "ET", preMarketOpen: 4 * 60, open: 9 * 60 + 30, close: 16 * 60, afterHoursClose: 20 * 60 },
  XETRA: { timeZone: "Europe/Berlin", label: "CET", preMarketOpen: 9 * 60, open: 9 * 60, close: 17 * 60 + 30, afterHoursClose: 17 * 60 + 30 },
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function minutesOfDayToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function localWallClock(timeZone: string, at: Date): { minutes: number; weekday: number; hhmm: string; year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    minutes: hour * 60 + minute,
    weekday: WEEKDAY_INDEX[get("weekday")],
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** UTC offset (in minutes, e.g. -240 for EDT) the given timeZone observes on `atUtc`'s date. */
function utcOffsetMinutes(timeZone: string, atUtc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(atUtc);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-]\d+)(?::(\d+))?/.exec(raw);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

/** Converts a wall-clock instant in `timeZone` (given as calendar date + minutes-of-day) to a
 *  real UTC Date. Uses the offset at local noon on that date as an approximation — safe here
 *  because both exchanges' DST transitions happen at 1-2am local, well outside the 4am-8pm
 *  window these calculations ever target. */
function zonedWallClockToUtc(year: number, month: number, day: number, minutesOfDay: number, timeZone: string): Date {
  const noonGuess = new Date(Date.UTC(year, month - 1, day, 12, 0));
  const offset = utcOffsetMinutes(timeZone, noonGuess);
  return new Date(Date.UTC(year, month - 1, day, 0, minutesOfDay, 0) - offset * 60_000);
}

export function computeMarketStatus(exchange: "US" | "XETRA" | "CRYPTO", at: Date = new Date()): MarketStatusResult {
  if (exchange === "CRYPTO") {
    return {
      exchange,
      status: "24-7",
      localTime: at.toISOString().slice(11, 16),
      minutesToNextChange: null,
      nextChangeLabel: null,
      holidaysNotModeled: true,
      asOf: at.toISOString(),
    };
  }

  const config = SESSIONS[exchange];
  const { minutes, weekday, hhmm, year, month, day } = localWallClock(config.timeZone, at);
  const isWeekday = weekday >= 1 && weekday <= 5;
  const isRegularSession = isWeekday && minutes >= config.open && minutes < config.close;
  const isPreMarket = isWeekday && minutes >= config.preMarketOpen && minutes < config.open;
  const isAfterHours = isWeekday && minutes >= config.close && minutes < config.afterHoursClose;

  let status: MarketStatusValue = "closed";
  if (isRegularSession) status = "open";
  else if (isPreMarket) status = "pre-market";
  else if (isAfterHours) status = "after-hours";

  let minutesToNextChange: number;
  let nextChangeLabel: string;

  if (status === "open") {
    const closeInstant = zonedWallClockToUtc(year, month, day, config.close, config.timeZone);
    minutesToNextChange = Math.max(0, Math.round((closeInstant.getTime() - at.getTime()) / 60_000));
    nextChangeLabel = `Handelsschluss in ${minutesToNextChange} Min (${minutesOfDayToHhmm(config.close)} ${config.label})`;
  } else {
    // Scan forward for the next weekday's regular-session open (weekends only — no holiday data).
    let found: { instant: Date } | null = null;
    for (let offset = 0; offset <= 7 && !found; offset++) {
      const candidateDate = new Date(Date.UTC(year, month - 1, day + offset, 12, 0));
      const candidateWeekday = WEEKDAY_INDEX[new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone, weekday: "short" }).format(candidateDate)];
      if (candidateWeekday < 1 || candidateWeekday > 5) continue;
      const candidateOpen = zonedWallClockToUtc(year, month, day + offset, config.open, config.timeZone);
      if (candidateOpen.getTime() > at.getTime()) found = { instant: candidateOpen };
    }
    minutesToNextChange = found ? Math.round((found.instant.getTime() - at.getTime()) / 60_000) : 0;
    nextChangeLabel = `Nächste Handelsöffnung in ${minutesToNextChange} Min (${minutesOfDayToHhmm(config.open)} ${config.label})`;
  }

  return { exchange, status, localTime: hhmm, minutesToNextChange, nextChangeLabel, holidaysNotModeled: true, asOf: at.toISOString() };
}
