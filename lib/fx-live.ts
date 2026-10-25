export type LiveFxQuote = {
  gbpToZarRate: number;
  asOf: string;
  source: string;
};

/** Fetch GBP→ZAR from Frankfurter for a day (`YYYY-MM-DD`) or `latest`. */
export async function fetchGbpToZarQuote(day: string): Promise<LiveFxQuote> {
  const res = await fetch(`https://api.frankfurter.app/${day}?from=GBP&to=ZAR`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Live FX unavailable (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    date?: string;
    rates?: { ZAR?: number };
  };
  const rate = json.rates?.ZAR;
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Live FX response missing ZAR rate");
  }
  return {
    gbpToZarRate: Math.round(rate * 10000) / 10000,
    asOf: json.date ?? (day === "latest" ? new Date().toISOString().slice(0, 10) : day),
    source: "frankfurter.app",
  };
}

/** Fetch current GBP→ZAR from Frankfurter (no API key). */
export async function fetchLiveGbpToZarQuote(): Promise<LiveFxQuote> {
  return fetchGbpToZarQuote("latest");
}
