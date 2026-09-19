import {
  DEVIATION_LIMIT_BPS,
  FEE_BPS,
  POSITION_FRACTION,
  RISK_LIMIT_BPS,
  STABLE_ARB_COOLDOWN_TICKS,
  STRATEGY_BASE_RISK_BPS,
  STRATEGY_CONFIGS,
  computeDeviationBps,
  computeVolatilityBps,
  decide,
  requiredSymbolsFor,
  type StrategyConfig,
  type StrategyExtra,
} from "@/lib/live/strategyLogic";
import type { LiveStrategyKind, SignalSide, TickerSymbol } from "@/lib/live/types";
import { WARMUP_CANDLES, WINDOW_SPEC, type BacktestWindow, type Candle } from "@/lib/backtest/klines";

/** 리더보드에 함께 서는 에이전트 종류. crypto는 Binance 실시세 리플레이, 나머지는
 *  lib/altstrat의 결정론적 페이퍼 시뮬레이션. */
export type AgentKind = "crypto" | "polymarket-copy" | "weather-arb" | "stocks";

// ─────────────────────────────────────────────────────────────────────────────
// 느린 시계 — 결정론적 백테스트 엔진.
//
// 라이브 엔진(LiveStrategyEngine)과 같은 decide()를 쓰되, 두 가지가 다르다:
//  1) 시그널 검증의 무작위 노이즈를 seeded PRNG로 바꿔 같은 입력 → 같은 결과.
//  2) 캔들 하나마다 시가평가 equity를 기록해 지표(MDD/승률/streak/보유시간)를 뽑는다.
// 자본은 비율 사이징이라 ROI는 자본 불변이지만, "$10,000 넣었으면 $X"를 그대로
// 보여주기 위해 요청 자본으로 실제 계산한다.
// ─────────────────────────────────────────────────────────────────────────────

export interface BtTrade {
  /** 창 기준 캔들 인덱스 (워밍업 제외) */
  index: number;
  t: number;
  side: SignalSide;
  price: number;
  quantity: number;
  notional: number;
  fee: number;
  /** SELL일 때 실현 손익(수수료 차감) */
  pnl: number | null;
  pnlPct: number | null;
  /** 진입 후 보유 시간(시간 단위), SELL에만 */
  holdHours: number | null;
  equityAfter: number;
  verdict: "VERIFIED" | "REJECTED";
  rejectReason?: string;
  riskScoreBps: number;
}

export interface BtMetrics {
  capital: number;
  finalEquity: number;
  pnl: number;
  roiPct: number;
  /** 최대 낙폭, 양수 % */
  mddPct: number;
  /** 라운드트립 기준 */
  roundTrips: number;
  wins: number;
  losses: number;
  winRatePct: number;
  bestTradePct: number | null;
  worstTradePct: number | null;
  avgTradePct: number | null;
  maxWinStreak: number;
  maxLoseStreak: number;
  avgHoldHours: number | null;
  /** 창 중 포지션 보유 비율 % */
  exposurePct: number;
  /** 하루 단위 수익 난 날 비율 % */
  profitableDaysPct: number;
  tradingDays: number;
  buys: number;
  sells: number;
  rejected: number;
  /** 최근 7일(168봉) 수익률 — 30D 창에서 '추세' 용 */
  recent7dRoiPct: number;
  /** 그냥 들고 있었으면 (buy & hold) */
  holdRoiPct: number;
  holdFinalEquity: number;
  /** 미실현 포지션이 남았는지 */
  openPosition: boolean;
  /** 창 시작/끝 시각 */
  from: number;
  to: number;
}

export interface ScoreBreakdown {
  /** 0~100 */
  total: number;
  /** 각 항목 0~가중치 만점 */
  returns: number; // /30
  riskAdjusted: number; // /30
  consistency: number; // /20
  trend: number; // /20
}

export type RiskGrade = "low" | "mid" | "high";

export interface BtResult {
  kind: "crypto";
  agentId: string;
  strategy: LiveStrategyKind;
  symbol: TickerSymbol;
  window: BacktestWindow;
  candles: Candle[];
  equityCurve: number[];
  holdCurve: number[];
  trades: BtTrade[];
  metrics: BtMetrics;
  score: ScoreBreakdown;
  riskGrade: RiskGrade;
}

// mulberry32 — 시드 하나로 결정론적 [0,1) 난수.
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function verifyDeterministic(
  strategy: LiveStrategyKind,
  prices: number[],
  rng: () => number
): { verdict: "VERIFIED" | "REJECTED"; riskScoreBps: number; reason?: string } {
  const base = STRATEGY_BASE_RISK_BPS[strategy];
  const volTerm = Math.min(1500, computeVolatilityBps(prices) * 60);
  const noise = rng() * 5000;
  const riskScoreBps = Math.round(Math.min(10_000, Math.max(0, base + volTerm + noise)));
  if (riskScoreBps > RISK_LIMIT_BPS) {
    return { verdict: "REJECTED", riskScoreBps, reason: "위험도 상한 초과" };
  }
  const deviationBps = computeDeviationBps(prices);
  if (deviationBps > DEVIATION_LIMIT_BPS) {
    return {
      verdict: "REJECTED",
      riskScoreBps,
      reason: `가격 편차 임계치 초과 (${(deviationBps / 100).toFixed(2)}%)`,
    };
  }
  return { verdict: "VERIFIED", riskScoreBps };
}

export function configFor(agentId: string): StrategyConfig | undefined {
  return STRATEGY_CONFIGS.find((c) => c.agentId === agentId);
}

export function riskGradeOf(mddPct: number): RiskGrade {
  if (mddPct <= 5) return "low";
  if (mddPct <= 12) return "mid";
  return "high";
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function computeScore(m: BtMetrics): ScoreBreakdown {
  const returns = clamp01((m.roiPct + 10) / 30) * 30;
  const mdd = Math.max(0.5, m.mddPct);
  const calmar = m.roiPct / mdd;
  const riskAdjusted = clamp01((calmar + 1) / 4) * 30;
  const consistency =
    m.roundTrips === 0
      ? 0.25 * 20
      : (0.5 * (m.winRatePct / 100) + 0.5 * (m.profitableDaysPct / 100)) * 20;
  const trend = clamp01((m.recent7dRoiPct + 5) / 15) * 20;
  const total = Math.round(returns + riskAdjusted + consistency + trend);
  return {
    total: Math.max(0, Math.min(100, total)),
    returns: Math.round(returns * 10) / 10,
    riskAdjusted: Math.round(riskAdjusted * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    trend: Math.round(trend * 10) / 10,
  };
}

/**
 * 한 에이전트를 주어진 캔들(워밍업 포함, 시간순)로 재생한다.
 * histories의 각 심볼 배열은 같은 길이여야 한다.
 */
export function runBacktest(
  cfg: StrategyConfig,
  histories: Record<TickerSymbol, Candle[]> | Partial<Record<TickerSymbol, Candle[]>>,
  window: BacktestWindow,
  capital: number
): BtResult {
  const main = histories[cfg.symbol];
  if (!main || main.length <= WARMUP_CANDLES + 2) {
    throw new Error(`${cfg.symbol} 캔들이 부족합니다`);
  }
  const symbols = requiredSymbolsFor(cfg);
  const closes: Partial<Record<TickerSymbol, number[]>> = {};
  for (const s of symbols) closes[s] = (histories[s] ?? []).map((c) => c.c);

  const rng = seededRandom(hashString(`${cfg.agentId}:${window}:${main[0].t}`));
  const candleHours = WINDOW_SPEC[window].candleHours;
  const extra: StrategyExtra = { cooldownTicks: 0, anchorPrice: null };
  const total = main.length;
  const start = WARMUP_CANDLES; // 창 시작 인덱스

  let equity = capital;
  let position: { quantity: number; entryPrice: number; baseEquityAtEntry: number; entryIndex: number } | null =
    null;
  const trades: BtTrade[] = [];
  const equityCurve: number[] = [];
  const holdCurve: number[] = [];
  const windowCandles: Candle[] = [];
  const p0 = main[start].c;
  let exposureCount = 0;

  for (let i = 0; i < total; i++) {
    const price = main[i].c;
    const upToNow: Partial<Record<TickerSymbol, number[]>> = {};
    for (const s of symbols) upToNow[s] = closes[s]!.slice(0, i + 1);
    if (extra.cooldownTicks > 0) extra.cooldownTicks -= 1;

    const inWindow = i >= start;
    const hasPosition = position !== null;
    const side = decide(cfg, extra, hasPosition, position, price, upToNow);

    // 워밍업 구간에서는 지표만 데우고 거래는 하지 않는다(그리드 anchor 등은 갱신됨).
    if (side && inWindow) {
      const v = verifyDeterministic(cfg.strategy, upToNow[cfg.symbol] ?? [], rng);
      const idx = i - start;
      if (v.verdict === "REJECTED") {
        trades.push({
          index: idx,
          t: main[i].t,
          side,
          price,
          quantity: 0,
          notional: 0,
          fee: 0,
          pnl: null,
          pnlPct: null,
          holdHours: null,
          equityAfter: position
            ? position.baseEquityAtEntry + position.quantity * (price - position.entryPrice)
            : equity,
          verdict: "REJECTED",
          rejectReason: v.reason,
          riskScoreBps: v.riskScoreBps,
        });
      } else if (side === "BUY" && !position) {
        const fraction = POSITION_FRACTION[cfg.strategy];
        const notional = equity * fraction;
        const fee = notional * (FEE_BPS / 10_000);
        const baseEquityAtEntry = equity - fee;
        const quantity = notional / price;
        position = { quantity, entryPrice: price, baseEquityAtEntry, entryIndex: i };
        equity = baseEquityAtEntry;
        trades.push({
          index: idx,
          t: main[i].t,
          side: "BUY",
          price,
          quantity,
          notional,
          fee,
          pnl: null,
          pnlPct: null,
          holdHours: null,
          equityAfter: equity,
          verdict: "VERIFIED",
          riskScoreBps: v.riskScoreBps,
        });
      } else if (side === "SELL" && position) {
        const realized = position.quantity * (price - position.entryPrice);
        const fee = position.quantity * price * (FEE_BPS / 10_000);
        const before = position.baseEquityAtEntry;
        equity = before + realized - fee;
        const pnl = equity - before;
        trades.push({
          index: idx,
          t: main[i].t,
          side: "SELL",
          price,
          quantity: position.quantity,
          notional: position.quantity * price,
          fee,
          pnl,
          pnlPct: (pnl / before) * 100,
          holdHours: (i - position.entryIndex) * candleHours,
          equityAfter: equity,
          verdict: "VERIFIED",
          riskScoreBps: v.riskScoreBps,
        });
        position = null;
        if (cfg.strategy === "stable-arb") extra.cooldownTicks = STABLE_ARB_COOLDOWN_TICKS;
      }
    }

    if (inWindow) {
      const marked = position
        ? position.baseEquityAtEntry + position.quantity * (price - position.entryPrice)
        : equity;
      equityCurve.push(marked);
      holdCurve.push((capital * price) / p0);
      windowCandles.push(main[i]);
      if (position) exposureCount += 1;
    }
  }

  const metrics = computeMetrics({
    capital,
    equityCurve,
    holdCurve,
    tradePnlPcts: trades.filter((t) => t.side === "SELL" && t.verdict === "VERIFIED").map((t) => t.pnlPct ?? 0),
    holdHoursList: trades.filter((t) => t.side === "SELL" && t.verdict === "VERIFIED").map((t) => t.holdHours ?? 0),
    buys: trades.filter((t) => t.side === "BUY" && t.verdict === "VERIFIED").length,
    sells: trades.filter((t) => t.side === "SELL" && t.verdict === "VERIFIED").length,
    rejected: trades.filter((t) => t.verdict === "REJECTED").length,
    from: windowCandles[0]?.t ?? 0,
    to: windowCandles[windowCandles.length - 1]?.t ?? 0,
    exposureCount,
    openPosition: position !== null,
    candlesPerDay: 24 / candleHours,
  });
  const score = computeScore(metrics);

  return {
    kind: "crypto",
    agentId: cfg.agentId,
    strategy: cfg.strategy,
    symbol: cfg.symbol,
    window,
    candles: windowCandles,
    equityCurve,
    holdCurve,
    trades,
    metrics,
    score,
    riskGrade: riskGradeOf(metrics.mddPct),
  };
}

export interface MetricsInput {
  capital: number;
  equityCurve: number[];
  /** 벤치마크(그냥 들고 있기) 곡선. 없으면 자본 그대로(=0%)로 본다. */
  holdCurve?: number[];
  /** 청산된 거래별 손익 % (시간순) */
  tradePnlPcts: number[];
  /** 청산된 거래별 보유 시간(시간 단위) */
  holdHoursList: number[];
  buys: number;
  sells: number;
  rejected: number;
  from: number;
  to: number;
  exposureCount: number;
  openPosition: boolean;
  /** equityCurve 샘플 하나가 덮는 시간의 역수 — 1시간봉이면 24, 4시간봉이면 6 */
  candlesPerDay: number;
}

/** equity 곡선 + 거래 요약으로 공통 지표를 뽑는다. 크립토 리플레이와 대체 전략
 *  시뮬레이션이 같은 함수를 써야 AGORA 점수가 종류를 가리지 않고 공정해진다. */
export function computeMetrics(args: MetricsInput): BtMetrics {
  const { capital, equityCurve, tradePnlPcts: pcts, holdHoursList: holds, buys, sells, rejected, exposureCount, openPosition } = args;
  const holdCurve = args.holdCurve ?? equityCurve.map(() => capital);
  const candlesPerDay = Math.max(1, Math.round(args.candlesPerDay));
  const finalEquity = equityCurve[equityCurve.length - 1] ?? capital;
  const pnl = finalEquity - capital;
  const roiPct = (pnl / capital) * 100;

  let peak = equityCurve[0] ?? capital;
  let mdd = 0;
  for (const e of equityCurve) {
    if (e > peak) peak = e;
    if (peak > 0) mdd = Math.max(mdd, ((peak - e) / peak) * 100);
  }

  const wins = pcts.filter((p) => p > 0).length;
  const losses = pcts.length - wins;
  let maxWin = 0;
  let maxLose = 0;
  let curWin = 0;
  let curLose = 0;
  for (const p of pcts) {
    if (p > 0) {
      curWin += 1;
      curLose = 0;
    } else {
      curLose += 1;
      curWin = 0;
    }
    maxWin = Math.max(maxWin, curWin);
    maxLose = Math.max(maxLose, curLose);
  }
  // 일 단위 수익 난 날 비율
  let profitableDays = 0;
  let dayCount = 0;
  for (let i = candlesPerDay; i <= equityCurve.length; i += candlesPerDay) {
    // 하루의 시작점(i-candlesPerDay)과 다음 날 시작점(i, 마지막이면 끝점)을 비교한다.
    const a = equityCurve[i - candlesPerDay];
    const b = equityCurve[Math.min(i, equityCurve.length - 1)];
    if (a !== undefined && b !== undefined) {
      dayCount += 1;
      if (b > a) profitableDays += 1;
    }
  }

  const n = equityCurve.length;
  const idx7 = Math.max(0, n - 7 * candlesPerDay);
  const recent7dRoiPct = n > 1 ? ((equityCurve[n - 1] - equityCurve[idx7]) / equityCurve[idx7]) * 100 : 0;
  const holdFinal = holdCurve[holdCurve.length - 1] ?? capital;

  return {
    capital,
    finalEquity,
    pnl,
    roiPct,
    mddPct: Math.round(mdd * 100) / 100,
    roundTrips: pcts.length,
    wins,
    losses,
    winRatePct: pcts.length ? Math.round((wins / pcts.length) * 1000) / 10 : 0,
    bestTradePct: pcts.length ? Math.max(...pcts) : null,
    worstTradePct: pcts.length ? Math.min(...pcts) : null,
    avgTradePct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    maxWinStreak: maxWin,
    maxLoseStreak: maxLose,
    avgHoldHours: holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : null,
    exposurePct: n ? Math.round((exposureCount / n) * 1000) / 10 : 0,
    profitableDaysPct: dayCount ? Math.round((profitableDays / dayCount) * 1000) / 10 : 0,
    tradingDays: dayCount,
    buys,
    sells,
    rejected,
    recent7dRoiPct,
    holdRoiPct: ((holdFinal - capital) / capital) * 100,
    holdFinalEquity: holdFinal,
    openPosition,
    from: args.from,
    to: args.to,
  };
}

/** 리더보드용 경량 요약 (캔들/거래 전체는 빼고 스파크라인만). */
export interface AgentSummary {
  kind: AgentKind;
  agentId: string;
  /** crypto면 LiveStrategyKind, 그 외엔 대체 전략 서브타입 문자열 */
  strategy: string;
  /** crypto면 Binance 티커, 그 외엔 거래 무대(POLYMARKET/KALSHI/US-EQ 등) */
  symbol: string;
  window: BacktestWindow;
  metrics: BtMetrics;
  score: ScoreBreakdown;
  riskGrade: RiskGrade;
  /** 24포인트로 다운샘플한 equity 스파크라인 (ROI %) */
  spark: number[];
}

export function sparkOf(equityCurve: number[], capital: number, points = 32): number[] {
  const n = equityCurve.length;
  if (n === 0) return [];
  const spark: number[] = [];
  for (let k = 0; k < points; k++) {
    const i = Math.min(n - 1, Math.round((k / (points - 1)) * (n - 1)));
    spark.push(((equityCurve[i] - capital) / capital) * 100);
  }
  return spark;
}

export function summarize(r: BtResult): AgentSummary {
  const spark = sparkOf(r.equityCurve, r.metrics.capital);
  return {
    kind: "crypto",
    agentId: r.agentId,
    strategy: r.strategy,
    symbol: r.symbol,
    window: r.window,
    metrics: r.metrics,
    score: r.score,
    riskGrade: r.riskGrade,
    spark,
  };
}
