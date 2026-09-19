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
import mintReal from "@/lib/data/mint/mint-real-data.json";
import { ALT_CONFIGS } from "@/lib/altstrat/configs";
import type { AgentKind, AgentSummary } from "@/lib/backtest/engine";
import type { ReplayBoard } from "@/lib/backtest/service";
import { STRATEGY_LABEL } from "@/components/agent/meta";

// MINT는 라이브 컨트래리언 시뮬레이션이 아니라 실제 MK2 엔진(Mac mini, OKX 페이퍼
// 트레이딩, 2026.04.17~09.19, 879건)의 아카이브 자산곡선을 그대로 보여준다.
// lib/data/mint/mint-real-data.json의 equityCurve는 $10,000 균등가중 10전략
// 포트폴리오 기준(components/landing/mint.ts와 동일 소스) — 레이스 트랙/리더보드도
// 같은 숫자를 써야 "MINT가 달린 155일" 섹션과 아레나가 서로 다른 값을 보여주지 않는다.
const MINT_HIST = mintReal.equityCurve.map((p) => ((p.equity - 10_000) / 10_000) * 100);
const MINT_RET = Math.round(MINT_HIST[MINT_HIST.length - 1] * 100) / 100;
const MINT_MDD = (() => {
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of mintReal.equityCurve) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const dd = ((peak - p.equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return Math.max(0.5, Math.round(maxDd * 10) / 10);
})();
const MINT_SHARPE = (() => {
  const series = mintReal.equityCurve.map((p) => ({ ts: Date.parse(p.ts), equity: p.equity }));
  if (series.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].equity;
    if (prev > 0) returns.push(series[i].equity / prev - 1);
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  const spanMs = series[series.length - 1].ts - series[0].ts;
  const avgIntervalMs = spanMs / (series.length - 1);
  if (avgIntervalMs <= 0) return 0;
  const MS_PER_YEAR_LOCAL = 365.25 * 24 * 60 * 60 * 1000;
  const periodsPerYear = MS_PER_YEAR_LOCAL / avgIntervalMs;
  return Math.round((mean / sd) * Math.sqrt(periodsPerYear) * 100) / 100;
})();

export interface ArenaAgent {
  id: string;
  name: string;
  /** crypto / polymarket-copy / weather-arb / stocks */
  kind: AgentKind;
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

const CRYPTO_ORDER = ["mint", "axiom", "delphi", "atlas", "zephyr"];
const ALT_ORDER = ALT_CONFIGS.map((c) => c.agentId);
export const AGENT_ORDER = [...CRYPTO_ORDER, ...ALT_ORDER];

const MOCK_SEED: Record<string, { backers: number; aum: number; win: number }> = {
  mint: { backers: 214, aum: 48_200, win: 64 },
  axiom: { backers: 151, aum: 31_400, win: 57 },
  delphi: { backers: 128, aum: 26_800, win: 71 },
  atlas: { backers: 64, aum: 15_200, win: 49 },
  zephyr: { backers: 37, aum: 8_600, win: 44 },
  pythia: { backers: 96, aum: 19_400, win: 58 },
  augur: { backers: 73, aum: 12_100, win: 53 },
  kestrel: { backers: 41, aum: 6_900, win: 25 },
  sigma: { backers: 88, aum: 17_300, win: 42 },
  vega: { backers: 59, aum: 11_800, win: 56 },
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
  const isMint = state.agentId === "mint";
  const ret = isMint ? MINT_RET : Math.round(state.roiPct * 100) / 100;
  const mdd = isMint ? MINT_MDD : computeMddPct(state.equitySeries);
  const sharpe = isMint ? MINT_SHARPE : Math.round(computeSharpe(state.equitySeries) * 100) / 100;
  const hist = isMint
    ? MINT_HIST
    : state.equitySeries.length >= 2
      ? state.equitySeries.map((p) => ((p.equity - 10_000) / 10_000) * 100)
      : [ret, ret];
  return {
    id: state.agentId,
    name: (seed?.name ?? state.agentId).toUpperCase(),
    kind: "crypto",
    strat: seed ? stratLabel(seed.tagline) : state.strategy,
    real: seed?.isReal ?? true,
    symbol: isMint ? "MULTI" : state.symbol.replace(/USDT$/, ""),
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
  const crypto = CRYPTO_ORDER.map((id) => buildAgent(byId.get(id)!, mockRef.current[id]));
  // 대체 전략 5종은 브라우저 라이브 엔진이 없다 — 숫자는 느린 시계(/api/replay)에서
  // mergeBoard()로 덧입힌다. 여기서는 캐릭터/백커 같은 정적 껍데기만 만든다.
  const alt = ALT_CONFIGS.map<ArenaAgent>((cfg) => {
    const seed = SEED_AGENTS.find((a) => a.id === cfg.agentId);
    const mock = mockRef.current[cfg.agentId];
    return {
      id: cfg.agentId,
      name: (seed?.name ?? cfg.agentId).toUpperCase(),
      kind: cfg.kind,
      strat: STRATEGY_LABEL[cfg.strategy] ?? cfg.strategy,
      real: false,
      symbol: cfg.venue,
      accent: characterFor(cfg.agentId).accent,
      ret: 0,
      mdd: 0.5,
      sharpe: 0,
      win: mock.win,
      backers: mock.backers,
      aum: mock.aum,
      hist: [0, 0],
      score: 50,
    };
  });
  return [...crypto, ...alt];
}

/**
 * 느린 시계(리플레이 보드) 숫자를 아레나 에이전트에 덧입힌다.
 * 트랙 위치·티커·상세 시트·리더보드가 전부 같은 창(1D~6M)의 같은 숫자를 쓰게 하는 단일 지점.
 * 보드가 아직 없으면(로딩/에러) 크립토는 라이브 값, 대체 전략은 0으로 둔다.
 */
export function mergeBoard(agents: ArenaAgent[], board: ReplayBoard | null | undefined): ArenaAgent[] {
  if (!board) return agents;
  const byId = new Map<string, AgentSummary>(board.agents.map((a) => [a.agentId, a]));
  return agents.map((a) => {
    const b = byId.get(a.id);
    if (!b) return a;
    return {
      ...a,
      kind: b.kind,
      ret: Math.round(b.metrics.roiPct * 100) / 100,
      mdd: Math.max(0.5, Math.round(b.metrics.mddPct * 10) / 10),
      hist: b.spark.length >= 2 ? b.spark : a.hist,
      score: b.score.total,
      win: b.metrics.roundTrips ? Math.round(b.metrics.winRatePct) : a.win,
    };
  });
}
