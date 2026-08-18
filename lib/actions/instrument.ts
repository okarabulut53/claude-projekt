"use server";

import { requireUserId } from "@/lib/current-user";
import { getInstrument } from "@/lib/mock/instruments";
import { Instrument } from "@/lib/types";

export async function fetchInstrumentQuote(symbol: string): Promise<Instrument | null> {
  await requireUserId();
  const instrument = await getInstrument(symbol);
  return instrument ?? null;
}
