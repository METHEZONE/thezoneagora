import { STRATEGY_CONFIGS, requiredSymbolsFor } from "@/lib/live/strategyLogic";
import type { TickerSymbol } from "@/lib/live/types";
import { fetchHourlyCandles, type BacktestWindow, type Candle } from "@/lib/backtest/klines";
import {
  configFor,
  runBacktest,
  summarize,
  type AgentSummary,
  type BtResult,
} from "@/lib/backtest/engine";

export const DEFAULT_CAPITAL = 10_000;

// 서버리스 인스턴스 안에서만 유효한 짧은 캐시. 1시간봉은 정각마다만 바뀌므로 5분이면
// 충분하고, 심사 데모 중 Binance 호출 폭주를 막는다.
const CACHE_TTL_MS = 5 * 60 * 1000;
const candleCache = new Map<string, { at: number; data: Record<TickerSymbol, Candle[]> }>();

async function candlesFor(window: BacktestWindow): Promise<Record<TickerSymbol, Candle[]>> {
  const key = window;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const symbols = STRATEGY_CONFIGS.flatMap((c) => requiredSymbolsFor(c));
  const data = await fetchHourlyCandles(symbols, window);
  candleCache.set(key, { at: Date.now(), data });
  return data;
}

export function parseWindow(v: string | null | undefined): BacktestWindow {
  return v === "7d" ? "7d" : "30d";
}

export function parseCapital(v: string | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 100) return DEFAULT_CAPITAL;
  return Math.min(10_000_000, Math.round(n));
}

export async function backtestAgent(
  agentId: string,
  window: BacktestWindow,
  capital = DEFAULT_CAPITAL
): Promise<BtResult> {
  const cfg = configFor(agentId);
  if (!cfg) throw new Error(`알 수 없는 에이전트: ${agentId}`);
  const candles = await candlesFor(window);
  return runBacktest(cfg, candles, window, capital);
}

export interface ReplayBoard {
  window: BacktestWindow;
  capital: number;
  generatedAt: number;
  agents: AgentSummary[];
}

export async function replayAll(window: BacktestWindow, capital = DEFAULT_CAPITAL): Promise<ReplayBoard> {
  const candles = await candlesFor(window);
  const agents = STRATEGY_CONFIGS.map((cfg) => summarize(runBacktest(cfg, candles, window, capital)));
  return { window, capital, generatedAt: Date.now(), agents };
}
