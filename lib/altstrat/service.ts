import { sparkOf, type AgentSummary } from "@/lib/backtest/engine";
import type { BacktestWindow } from "@/lib/backtest/klines";
import { ALT_CONFIGS, altConfigFor } from "@/lib/altstrat/configs";
import { altAsOf, runAlt } from "@/lib/altstrat/simulate";
import type { AltResult } from "@/lib/altstrat/types";

// 서버리스 인스턴스 메모리 캐시. 시뮬레이션은 시간 단위로만 바뀌므로 asOf(정시)를 키에 넣으면
// 같은 시간 안에서는 재계산이 없다.
const cache = new Map<string, AltResult>();

export function altResult(agentId: string, window: BacktestWindow, capital = 10_000): AltResult {
  const cfg = altConfigFor(agentId);
  if (!cfg) throw new Error(`알 수 없는 에이전트: ${agentId}`);
  const key = `${agentId}:${window}:${capital}:${altAsOf()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = runAlt(cfg, window, capital);
  if (cache.size > 200) cache.clear();
  cache.set(key, r);
  return r;
}

export function summarizeAltResult(r: AltResult): AgentSummary {
  return {
    kind: r.kind,
    agentId: r.agentId,
    strategy: r.strategy,
    symbol: r.venue,
    window: r.window,
    metrics: r.metrics,
    score: r.score,
    riskGrade: r.riskGrade,
    spark: sparkOf(
      r.equityCurve.map((p) => p.equity),
      r.capital
    ),
  };
}

export function altSummaries(window: BacktestWindow, capital = 10_000): AgentSummary[] {
  return ALT_CONFIGS.map((c) => summarizeAltResult(altResult(c.agentId, window, capital)));
}

export function isAltAgent(agentId: string): boolean {
  return !!altConfigFor(agentId);
}
