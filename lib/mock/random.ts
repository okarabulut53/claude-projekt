function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) | 0;
  }
  return mulberry32(seed);
}

export function generateHistory(
  seedText: string,
  days: number,
  startPrice: number,
  volatility: number,
) {
  const random = seededRandom(seedText);
  // Separate seeded stream (not interleaved with the price draws above) so adding volume can't
  // shift the existing deterministic price series — volume.ts's simulated-instrument factor is
  // additive, not a change to prices already relied on elsewhere.
  const volumeRandom = seededRandom(`${seedText}:volume`);
  const baseVolume = 500_000 + volumeRandom() * 4_500_000;
  const points: { date: string; price: number; volume: number }[] = [];
  let price = startPrice;
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const drift = (random() - 0.48) * volatility;
    price = Math.max(price * (1 + drift), 0.01);
    const volumeNoise = 0.6 + volumeRandom() * 0.8;
    points.push({
      date: date.toISOString(),
      price: Math.round(price * 100) / 100,
      volume: Math.round(baseVolume * volumeNoise),
    });
  }
  return points;
}
