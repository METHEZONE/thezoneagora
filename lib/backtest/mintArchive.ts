import mintReal from "@/lib/data/mint/mint-real-data.json";
import { computeMetrics, computeScore, riskGradeOf, sparkOf, type AgentSummary, type BtMetrics, type RiskGrade, type ScoreBreakdown } from "@/lib/backtest/engine";
import { WINDOW_SPEC, type BacktestWindow } from "@/lib/backtest/klines";
import type { MintRealData, MintStrategySnapshot, MintTrade } from "@/lib/types/mint";

// ─────────────────────────────────────────────────────────────────────────────
// MINT = 실제 MK2 엔진(Mac mini · OKX 페이퍼 · 2026.04.17~) 아카이브.
// 다른 크립토 4종처럼 Binance 봉 위에서 다시 돌리는 게 아니라, 실제로 돈 기록(일별 자산곡선
// + 서브전략 10개 스냅샷 + 최근 체결 40건)을 그대로 창(1D~6M)으로 잘라 보여준다.
// 트랙·리더보드·상세가 전부 이 하나를 읽으므로 "트랙은 +221%인데 보드는 −10%" 같은 불일치가 없다.
// ─────────────────────────────────────────────────────────────────────────────

const DATA = mintReal as unknown as MintRealData;
const HOUR = 3600_000;

export interface MintArchiveResult {
  kind: "crypto";
  archive: true;
  agentId: "mint";
  strategy: "mk2-portfolio";
  symbol: "MULTI";
  window: BacktestWindow;
  capital: number;
  equityCurve: { t: number; equity: number }[];
  metrics: BtMetrics;
  score: ScoreBreakdown;
  riskGrade: RiskGrade;
  strategies: MintStrategySnapshot[];
  /** 창 안의 체결(최신순) — 아카이브에 남은 최근 40건 중 */
  trades: MintTrade[];
  generatedAt: string;
  /** 아카이브 전체 구간 */
  archiveFrom: number;
  archiveTo: number;
  totalDays: number;
  totalTrades: number;
}

export function mintArchiveResult(window: BacktestWindow, capital = 10_000): MintArchiveResult {
  const curve = DATA.equityCurve.map((p) => ({ t: Date.parse(p.ts), equity: p.equity }));
  const last = curve[curve.length - 1];
  const from = last.t - WINDOW_SPEC[window].hours * HOUR;
  // 창 시작 직전 점을 기준점으로 삼아 최소 2점을 보장한다(1D는 어제→오늘).
  let startIdx = curve.findIndex((p) => p.t >= from);
  if (startIdx < 0) startIdx = curve.length - 1;
  startIdx = Math.max(0, Math.min(startIdx, curve.length - 2));
  const base = curve[startIdx].equity;
  const factor = capital / base;
  const pts = curve.slice(startIdx).map((p) => ({ t: p.t, equity: Math.round(p.equity * factor * 100) / 100 }));

  const trades = DATA.recentTrades
    .filter((t) => Date.parse(t.ts) >= pts[0].t)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  const exits = trades.filter((t) => t.action === "exit");
  const pnlPcts = exits.map((t) => {
    const before = t.equity - t.pnl;
    return before > 0 ? (t.pnl / before) * 100 : 0;
  });
  const eq = pts.map((p) => p.equity);
  const metrics = computeMetrics({
    capital,
    equityCurve: eq,
    tradePnlPcts: pnlPcts,
    holdHoursList: [],
    buys: trades.length,
    sells: exits.length,
    rejected: 0,
    from: pts[0].t,
    to: last.t,
    exposureCount: eq.length,
    openPosition: true,
    candlesPerDay: 1,
  });
  const totalTrades = DATA.strategySnapshots.reduce((s, x) => s + x.season1Trades, 0);
  return {
    kind: "crypto",
    archive: true,
    agentId: "mint",
    strategy: "mk2-portfolio",
    symbol: "MULTI",
    window,
    capital,
    equityCurve: pts,
    metrics,
    score: computeScore(metrics),
    riskGrade: riskGradeOf(metrics.mddPct),
    strategies: [...DATA.strategySnapshots].sort((a, b) => b.seasonRoiPct - a.seasonRoiPct),
    trades,
    generatedAt: DATA.generatedAt,
    archiveFrom: curve[0].t,
    archiveTo: last.t,
    totalDays: curve.length - 1,
    totalTrades,
  };
}

export function mintArchiveSummary(window: BacktestWindow, capital = 10_000): AgentSummary {
  const r = mintArchiveResult(window, capital);
  return {
    kind: "crypto",
    agentId: r.agentId,
    strategy: r.strategy,
    symbol: r.symbol,
    window,
    metrics: r.metrics,
    score: r.score,
    riskGrade: r.riskGrade,
    spark: sparkOf(
      r.equityCurve.map((p) => p.equity),
      capital
    ),
  };
}

export function isMintArchive(r: { kind: string; archive?: boolean }): r is MintArchiveResult {
  return r.kind === "crypto" && r.archive === true;
}
