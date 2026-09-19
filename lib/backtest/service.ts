import { STRATEGY_CONFIGS, requiredSymbolsFor } from "@/lib/live/strategyLogic";
import type { TickerSymbol } from "@/lib/live/types";
import { fetchHourlyCandles, isBacktestWindow, type BacktestWindow, type Candle } from "@/lib/backtest/klines";
import {
  configFor,
  runBacktest,
  summarize,
  type AgentSummary,
  type BtResult,
} from "@/lib/backtest/engine";
import { altResult, altSummaries, isAltAgent } from "@/lib/altstrat/service";
import type { AltResult } from "@/lib/altstrat/types";
import { mintArchiveResult, mintArchiveSummary, type MintArchiveResult } from "@/lib/backtest/mintArchive";

export type AnyResult = BtResult | AltResult | MintArchiveResult;

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
  return isBacktestWindow(v) ? v : "30d";
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
): Promise<AnyResult> {
  if (isAltAgent(agentId)) return altResult(agentId, window, capital);
  // MINT는 실제 MK2 아카이브 — 리플레이가 아니라 기록 그 자체.
  if (agentId === "mint") return mintArchiveResult(window, capital);
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
  // MINT(실제 MK2 아카이브) + 크립토 리플레이 4 + 대체 전략 5(예측시장 카피 2 · 날씨 1 · 주식 2) = 10.
  const mint = mintArchiveSummary(window, capital);
  const crypto = STRATEGY_CONFIGS.filter((c) => c.agentId !== "mint").map((cfg) =>
    summarize(runBacktest(cfg, candles, window, capital))
  );
  const alt = altSummaries(window, capital);
  return { window, capital, generatedAt: Date.now(), agents: [mint, ...crypto, ...alt] };
}
