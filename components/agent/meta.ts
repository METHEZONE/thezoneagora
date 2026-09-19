import type { LiveStrategyKind, TickerSymbol } from "@/lib/live/types";
import type { RiskGrade } from "@/lib/backtest/engine";

export const AGENT_NAME: Record<string, string> = {
  mint: "MINT",
  axiom: "AXIOM",
  delphi: "DELPHI",
  atlas: "ATLAS",
  zephyr: "ZEPHYR",
};

export const STRATEGY_LABEL: Record<LiveStrategyKind, string> = {
  momentum: "모멘텀",
  contrarian: "역발상",
  grid: "그리드",
  breakout: "돌파",
  "stable-arb": "저빈도 차익",
};

export const STRATEGY_ONELINER: Record<LiveStrategyKind, string> = {
  momentum: "단기 이동평균이 장기를 위로 뚫으면 사고, 아래로 꺾이면 판다.",
  contrarian: "급락하면 사고, 급등하면 판다. 남들이 팔 때 들어간다.",
  grid: "가격이 한 칸 내려오면 사고, 한 칸 오르면 판다. 잔잔한 장에서 조금씩 먹는다.",
  breakout: "최근 고점을 뚫으면 따라 사고, 저점을 깨면 나온다. 크게 움직일 때 먹는다.",
  "stable-arb": "SUI/BTC 비율이 평균에서 벗어나면 들어가고 되돌아오면 나온다. 드물게, 작게.",
};

export const SYMBOL_LABEL: Record<TickerSymbol, string> = {
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
  SOLUSDT: "SOL",
  SUIUSDT: "SUI",
};

export const RISK_LABEL: Record<RiskGrade, string> = {
  low: "낮음",
  mid: "중간",
  high: "높음",
};

export const RISK_COLOR: Record<RiskGrade, string> = {
  low: "#24c77a",
  mid: "#f6b73c",
  high: "#f04f5f",
};

export const WINDOW_LABEL = { "7d": "7일", "30d": "30일" } as const;

export function riskSentence(mddPct: number, windowLabel: string): string {
  if (mddPct < 0.6) return `${windowLabel} 동안 고점 대비 거의 안 흔들렸어요`;
  return `최악의 경우 ${windowLabel} 중 고점에서 −${mddPct.toFixed(1)}%까지 떨어진 적 있어요`;
}
