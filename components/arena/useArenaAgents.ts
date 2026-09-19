"use client";

/**
 * design/agora-arena.html의 목업 AGENTS 배열 대신, 실제 LiveStrategyEngine을 구독해
 * 화면에 필요한 형태(ArenaAgent)로 매핑한다.
 * - ret: 엔진 roiPct 그대로
 * - mdd: equitySeries에서 계산한 최대 낙폭(%)
 * - sharpe: equitySeries 틱 간격을 실측해 연환산한 진짜 Sharpe(무위험수익률 0 가정).
 *   실제 자산운용사가 raw PnL이 아니라 변동성 대비 수익으로 전략을 평가하는 것과
 *   같은 원칙 — lib/data/metrics.ts의 구 Derby v1 computeSharpe는 일봉(252일) 가정이라
 *   틱 단위 라이브 곡선에는 못 쓴다.
 * - score(AGORA 점수): 50 + sharpe*15, 1~99로 클램프 — "위험조정 성과" 원칙 그대로
 *   Sharpe 기반으로 교체(예전엔 ret/mdd 선형조합 근사치였다).
 * - backers/aum/win: 그럴듯한 시드값 + 틱마다 소폭 증가(mock, 원본 tick()의 25% 확률 로직 재현)
 */

import { useEffect, useRef, useState } from "react";
import { getLiveStrategyEngine } from "@/lib/live/LiveStrategyEngine";
import type { LiveAgentState } from "@/lib/live/types";
import { AGENTS as SEED_AGENTS } from "@/lib/data/seed/seasons";
import { characterFor } from "@/components/arena/characters";

export interface ArenaAgent {
  id: string;
  name: string;
  strat: string;
  /** 전 에이전트가 실시간 시세를 추종하는 페이퍼 트레이딩이라 항상 true — UI에서
   *  REAL/SIM을 가르는 용도가 아니라 "실데이터 기반" 배지를 다는 데 쓴다. */
  real: boolean;
  /** 실제로 추종하는 실시간 시세 심볼 (Binance 티커) — "무엇의 실데이터인지" 사용자에게 명시. */
  symbol: string;
  accent: string;
  ret: number;
  mdd: number;
  /** 연환산 Sharpe (무위험수익률 0). 변동성 대비 수익 — raw ROI보다 이걸로 줄 세운다. */
  sharpe: number;
  win: number;
  backers: number;
  aum: number;
  hist: number[];
  score: number;
}

const AGENT_ORDER = ["mint", "axiom", "delphi", "atlas", "zephyr"];

const MOCK_SEED: Record<string, { backers: number; aum: number; win: number }> = {
  mint: { backers: 214, aum: 48_200, win: 64 },
  axiom: { backers: 151, aum: 31_400, win: 57 },
  delphi: { backers: 128, aum: 26_800, win: 71 },
  atlas: { backers: 64, aum: 15_200, win: 49 },
  zephyr: { backers: 37, aum: 8_600, win: 44 },
};

function stratLabel(tagline: string): string {
  return tagline.split(".")[0]?.trim() || tagline;
}

function computeMddPct(series: { equity: number }[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of series) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const dd = ((peak - p.equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return Math.max(0.5, Math.round(maxDd * 10) / 10);
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** 틱 간격을 실측해 연환산하는 진짜 Sharpe. 일봉 가정(252일)이 아니라 실제
 *  equitySeries의 평균 샘플 간격으로 연간 기간 수를 구한다 — PriceFeed가
 *  7초든 30초든 이 값은 항상 올바르게 연환산된다. */
function computeSharpe(series: { ts: number; equity: number }[]): number {
  if (series.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].equity;
    if (prev > 0) returns.push(series[i].equity / prev - 1);
  }
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;

  const spanMs = series[series.length - 1].ts - series[0].ts;
  const avgIntervalMs = spanMs / (series.length - 1);
  if (avgIntervalMs <= 0) return 0;
  const periodsPerYear = MS_PER_YEAR / avgIntervalMs;

  return (mean / sd) * Math.sqrt(periodsPerYear);
}

function scoreOf(sharpe: number): number {
  return Math.max(1, Math.min(99, Math.round(50 + sharpe * 15)));
}

function buildAgent(
  state: LiveAgentState,
  mock: { backers: number; aum: number; win: number }
): ArenaAgent {
  const seed = SEED_AGENTS.find((a) => a.id === state.agentId);
  const ret = Math.round(state.roiPct * 100) / 100;
  const mdd = computeMddPct(state.equitySeries);
  const sharpe = Math.round(computeSharpe(state.equitySeries) * 100) / 100;
  const hist =
    state.equitySeries.length >= 2
      ? state.equitySeries.map((p) => ((p.equity - 10_000) / 10_000) * 100)
      : [ret, ret];
  return {
    id: state.agentId,
    name: (seed?.name ?? state.agentId).toUpperCase(),
    strat: seed ? stratLabel(seed.tagline) : state.strategy,
    real: seed?.isReal ?? true,
    symbol: state.symbol.replace(/USDT$/, ""),
    accent: characterFor(state.agentId).accent,
    ret,
    mdd,
    sharpe,
    win: mock.win,
    backers: mock.backers,
    aum: mock.aum,
    hist,
    score: scoreOf(sharpe),
  };
}

export function useArenaAgents(): ArenaAgent[] {
  const engine = getLiveStrategyEngine();
  const mockRef = useRef<Record<string, { backers: number; aum: number; win: number }>>(
    Object.fromEntries(AGENT_ORDER.map((id) => [id, { ...MOCK_SEED[id] }]))
  );
  const [snapshotAgents, setSnapshotAgents] = useState<LiveAgentState[]>(
    () => engine.getSnapshot().agents
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe((tick) => {
      for (const state of tick.agents) {
        const mock = mockRef.current[state.agentId];
        if (!mock) continue;
        if (Math.random() < 0.25) mock.backers += Math.floor(Math.random() * 3);
        if (Math.random() < 0.25) mock.aum += Math.floor(Math.random() * 900);
      }
      setSnapshotAgents(tick.agents);
    });
    return unsubscribe;
  }, [engine]);

  const byId = new Map(snapshotAgents.map((s) => [s.agentId, s]));
  return AGENT_ORDER.map((id) => buildAgent(byId.get(id)!, mockRef.current[id]));
}
