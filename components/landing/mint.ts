// MINT 아카이브(lib/data/mint/mint-real-data.json, generatedAt 2026-06-23)에서
// 랜딩이 쓰는 모든 수치를 파생한다. 여기 없는 숫자는 랜딩에 등장하지 않는다.

import raw from "@/lib/data/mint/mint-real-data.json";

export const BASE_CAPITAL = 10_000;

export interface MintDay {
  day: number;
  /** "06.01" 형식 */
  label: string;
  /** "2026.06.01" 형식 */
  full: string;
  equity: number;
}

export const DAYS: MintDay[] = raw.equityCurve.map((p) => ({
  day: p.dayIndex,
  label: p.ts.slice(5, 10).replace("-", "."),
  full: p.ts.slice(0, 10).replaceAll("-", "."),
  equity: p.equity,
}));

export const LAST_DAY = DAYS[DAYS.length - 1].day;
export const START = DAYS[0];
export const END = DAYS[DAYS.length - 1];
export const FINAL_ROI_PCT = ((END.equity - BASE_CAPITAL) / BASE_CAPITAL) * 100;

/** 일별 곡선 기준 최대 낙폭(%). 음수로 반환 (예: -12.2). */
export const DAILY_MDD_PCT = (() => {
  let peak = -Infinity;
  let mdd = 0;
  for (const d of DAYS) {
    if (d.equity > peak) peak = d.equity;
    const dd = ((d.equity - peak) / peak) * 100;
    if (dd < mdd) mdd = dd;
  }
  return mdd;
})();

/** 진행도(0~1)를 일 수(0~22 실수)로 사상. */
export function dayAt(progress: number): number {
  return Math.min(Math.max(progress, 0), 1) * LAST_DAY;
}

/** 일 수(실수)에서 곡선을 선형 보간한 자산. */
export function equityAt(dayFloat: number): number {
  const d = Math.min(Math.max(dayFloat, 0), LAST_DAY);
  const i = Math.min(Math.floor(d), LAST_DAY - 1);
  const t = d - i;
  return DAYS[i].equity + (DAYS[i + 1].equity - DAYS[i].equity) * t;
}

export interface Strat {
  name: string;
  roiPct: number;
  trades: number;
  winRate: number;
}

export const STRATS: Strat[] = [...raw.strategySnapshots]
  .sort((a, b) => b.seasonRoiPct - a.seasonRoiPct)
  .map((s) => ({
    name: s.strategy,
    roiPct: s.seasonRoiPct,
    trades: s.season1Trades,
    winRate: s.season1WinRate,
  }));

export const RECENT_TRADES_COUNT = raw.recentTrades.length;
export const RECENT_WINS = raw.recentTrades.filter((t) => t.pnl > 0).length;
export const RECENT_WIN_RATE_PCT = (RECENT_WINS / RECENT_TRADES_COUNT) * 100;

export const KALSHI = {
  totalTrades: raw.kalshiSummary.total_trades,
  roiPct: raw.kalshiSummary.roi_pct,
  winRate: raw.kalshiSummary.win_rate,
};

// ---- 스크럽 테이프: 일별 마감 + 굵직한 실제 체결을 시간순으로 섞는다 ----

export interface TapeEvent {
  /** 시즌 시작(06-01 00:00) 기준 경과 일수. 스크럽 진행도와 비교한다. */
  t: number;
  kind: "day" | "trade";
  date: string;
  title: string;
  /** trade: 체결 손익 / day: 전일 대비 변화 */
  delta: number;
  /** trade: 청산 사유 / day: 마감 자산 */
  note: string;
}

const SEASON_START_MS = Date.parse("2026-06-01T00:00:00Z");
const DAY_MS = 86_400_000;

const dayEvents: TapeEvent[] = DAYS.slice(1).map((d, i) => ({
  t: d.day,
  kind: "day",
  date: d.label,
  title: `${d.day + 1}일차 마감`,
  delta: d.equity - DAYS[i].equity,
  note: `$${d.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
}));

const SIDE_KO: Record<string, string> = { long: "롱", short: "숏" };

// 최근 40건 중 손익 절대값이 큰 순서로 10건. -7,212.98 ETH-15m 손절도 자연히 포함된다.
const tradeEvents: TapeEvent[] = [...raw.recentTrades]
  .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
  .slice(0, 10)
  .map((t) => ({
    // 마지막 날(06.23) 체결은 곡선 끝점(22.0)을 넘으므로 끝점으로 클램프해 스크럽 끝에서 드러난다.
    t: Math.min((Date.parse(t.ts) - SEASON_START_MS) / DAY_MS, LAST_DAY),
    kind: "trade" as const,
    date: t.ts.slice(5, 10).replace("-", "."),
    title: `${t.strategy} ${SIDE_KO[t.side] ?? t.side} 청산`,
    delta: t.pnl,
    // 원본 사유의 대시/기호는 표시용으로 다듬는다 (데이터 자체는 그대로).
    note: t.reason.replace(/\s[–—-]\s/g, ' · ').replace(/≤/g, '<='),
  }));

const KIND_ORDER: Record<TapeEvent["kind"], number> = { day: 0, trade: 1 };

// 같은 시각이면 일별 마감이 먼저, 그 위로 그날의 체결이 쌓인다.
export const TAPE: TapeEvent[] = [...dayEvents, ...tradeEvents].sort(
  (a, b) => a.t - b.t || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
);

// ---- 포맷터 ----

export function fmtUsd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtSigned(v: number): string {
  const s = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return v >= 0 ? `+${s}` : `-${s}`;
}

export function fmtSignedPct(v: number, digits = 2): string {
  const s = Math.abs(v).toFixed(digits);
  return v >= 0 ? `+${s}%` : `-${s}%`;
}
