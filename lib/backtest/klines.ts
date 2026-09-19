import type { TickerSymbol } from "@/lib/live/types";

// 느린 시계용 캔들 소스. lib/live/klines.ts(1분봉 120개, 실시간 시그널 리플레이)와
// 달리 여기는 "지난 1일~6개월 동안 이 전략이 실제로 어땠나"를 재생하기 위해
// 창 크기에 맞는 봉(15m/1h/4h/8h)을 통째로 받아온다. OHLC 전체를 보존한다(차트용).

export type BacktestWindow = "1d" | "7d" | "30d" | "90d" | "180d";

export const WINDOWS: BacktestWindow[] = ["1d", "7d", "30d", "90d", "180d"];

export type CandleInterval = "15m" | "1h" | "4h" | "8h";

export interface WindowSpec {
  /** 창 길이(시간) */
  hours: number;
  /** Binance klines interval. 1,000개 제한 안에서 창 전체가 들어오도록 창이 길수록 봉이 굵어진다. */
  interval: CandleInterval;
  /** 봉 하나가 덮는 시간 */
  candleHours: number;
  /** 창 안의 봉 개수 (워밍업 제외) */
  candles: number;
  /** 사람이 읽는 봉 이름 */
  intervalLabel: string;
}

function spec(hours: number, interval: CandleInterval, candleHours: number, intervalLabel: string): WindowSpec {
  return { hours, interval, candleHours, candles: Math.round(hours / candleHours), intervalLabel };
}

export const WINDOW_SPEC: Record<BacktestWindow, WindowSpec> = {
  "1d": spec(24, "15m", 0.25, "15분봉"),
  "7d": spec(24 * 7, "1h", 1, "1시간봉"),
  "30d": spec(24 * 30, "1h", 1, "1시간봉"),
  "90d": spec(24 * 90, "4h", 4, "4시간봉"),
  "180d": spec(24 * 180, "8h", 8, "8시간봉"),
};

export const WINDOW_HOURS: Record<BacktestWindow, number> = Object.fromEntries(
  WINDOWS.map((w) => [w, WINDOW_SPEC[w].hours])
) as Record<BacktestWindow, number>;

export function isBacktestWindow(v: unknown): v is BacktestWindow {
  return typeof v === "string" && (WINDOWS as string[]).includes(v);
}

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

async function fetchOne(symbol: TickerSymbol, interval: CandleInterval, limit: number): Promise<Candle[]> {
  let lastError: unknown;
  for (const base of ENDPOINTS) {
    try {
      const url = `${base}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${symbol} ${interval} klines HTTP ${res.status} (${base})`);
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
  const { candles, interval } = WINDOW_SPEC[window];
  const limit = candles + WARMUP_CANDLES;
  const unique = Array.from(new Set(symbols));
  const results = await Promise.all(unique.map((s) => fetchOne(s, interval, limit)));
  const out: Partial<Record<TickerSymbol, Candle[]>> = {};
  unique.forEach((s, i) => {
    out[s] = results[i];
  });
  // 심볼 간 길이를 맞춘다(거래소가 심볼별로 한두 개 덜 줄 수 있음) — 뒤에서 자름.
  const minLen = Math.min(...results.map((r) => r.length));
  for (const s of unique) out[s] = out[s]!.slice(-minLen);
  return out as Record<TickerSymbol, Candle[]>;
}
