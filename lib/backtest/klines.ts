import type { TickerSymbol } from "@/lib/live/types";

// 느린 시계용 캔들 소스. lib/live/klines.ts(1분봉 120개, 실시간 시그널 리플레이)와
// 달리 여기는 "지난 7일/30일 동안 이 전략이 실제로 어땠나"를 재생하기 위해
// 1시간봉을 창 크기만큼 통째로 받아온다. OHLC 전체를 보존한다(차트용).

export type BacktestWindow = "7d" | "30d";

export const WINDOW_HOURS: Record<BacktestWindow, number> = {
  "7d": 24 * 7,
  "30d": 24 * 30,
};

/** 전략 워밍업(최대 lookback 20) 여유. 창 앞에 붙여 받아오고 창 시작 시점부터만 성과를 셈. */
export const WARMUP_CANDLES = 24;

export interface Candle {
  /** open time, ms epoch */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

const ENDPOINTS = [
  "https://api.binance.com/api/v3/klines",
  "https://api.binance.us/api/v3/klines",
];

async function fetchOne(symbol: TickerSymbol, limit: number): Promise<Candle[]> {
  let lastError: unknown;
  for (const base of ENDPOINTS) {
    try {
      const url = `${base}?symbol=${symbol}&interval=1h&limit=${limit}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${symbol} 1h klines HTTP ${res.status} (${base})`);
      const rows = (await res.json()) as unknown[][];
      const candles = rows.map((r) => ({
        t: Number(r[0]),
        o: Number(r[1]),
        h: Number(r[2]),
        l: Number(r[3]),
        c: Number(r[4]),
      }));
      if (candles.length === 0 || candles.some((c) => Number.isNaN(c.c))) {
        throw new Error(`${symbol} klines 파싱 실패`);
      }
      return candles;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${symbol} klines 실패`);
}

export async function fetchHourlyCandles(
  symbols: TickerSymbol[],
  window: BacktestWindow
): Promise<Record<TickerSymbol, Candle[]>> {
  const limit = WINDOW_HOURS[window] + WARMUP_CANDLES;
  const unique = Array.from(new Set(symbols));
  const results = await Promise.all(unique.map((s) => fetchOne(s, limit)));
  const out: Partial<Record<TickerSymbol, Candle[]>> = {};
  unique.forEach((s, i) => {
    out[s] = results[i];
  });
  // 심볼 간 길이를 맞춘다(거래소가 심볼별로 한두 개 덜 줄 수 있음) — 뒤에서 자름.
  const minLen = Math.min(...results.map((r) => r.length));
  for (const s of unique) out[s] = out[s]!.slice(-minLen);
  return out as Record<TickerSymbol, Candle[]>;
}
