import type { AgentKind, RiskGrade } from "@/lib/backtest/engine";
import type { BacktestWindow } from "@/lib/backtest/klines";

export const AGENT_NAME: Record<string, string> = {
  // 크립토 — Binance 실시세 리플레이
  mint: "MINT",
  axiom: "AXIOM",
  delphi: "DELPHI",
  atlas: "ATLAS",
  zephyr: "ZEPHYR",
  // 예측시장 카피트레이드
  pythia: "PYTHIA",
  augur: "AUGUR",
  // 날씨 아비트리지
  kestrel: "KESTREL",
  // 미국 주식
  sigma: "SIGMA",
  vega: "VEGA",
};

export const KIND_LABEL: Record<AgentKind, string> = {
  crypto: "크립토",
  "polymarket-copy": "예측시장 카피",
  "weather-arb": "날씨 아비트리지",
  stocks: "미국 주식",
};

export const KIND_SHORT: Record<AgentKind, string> = {
  crypto: "CRYPTO",
  "polymarket-copy": "POLYMARKET",
  "weather-arb": "WEATHER",
  stocks: "STOCKS",
};

export const KIND_ORDER: AgentKind[] = ["crypto", "polymarket-copy", "weather-arb", "stocks"];

/** 종류별 대표색 — 트랙 레인 태그·리더보드 필터 칩에 쓴다(캐릭터 색과는 별개). */
export const KIND_COLOR: Record<AgentKind, string> = {
  crypto: "#F6B73C",
  "polymarket-copy": "#C084FC",
  "weather-arb": "#7DD3FC",
  stocks: "#34D399",
};

export const STRATEGY_LABEL: Record<string, string> = {
  momentum: "모멘텀",
  contrarian: "역발상",
  grid: "그리드",
  breakout: "돌파",
  "stable-arb": "저빈도 차익",
  "mk2-portfolio": "MK2 10전략 실기록",
  "poly-copy-macro": "매크로·정치 지갑 카피",
  "poly-copy-sports": "스포츠·단기 지갑 카피",
  "weather-bracket-arb": "기온 브래킷 차익",
  "equity-momentum": "대형 테크 모멘텀",
  "etf-rotation": "ETF 주간 로테이션",
};

export const STRATEGY_ONELINER: Record<string, string> = {
  momentum: "단기 이동평균이 장기를 위로 뚫으면 사고, 아래로 꺾이면 판다.",
  contrarian: "급락하면 사고, 급등하면 판다. 남들이 팔 때 들어간다.",
  grid: "가격이 한 칸 내려오면 사고, 한 칸 오르면 판다. 잔잔한 장에서 조금씩 먹는다.",
  breakout: "최근 고점을 뚫으면 따라 사고, 저점을 깨면 나온다. 크게 움직일 때 먹는다.",
  "stable-arb": "SUI/BTC 비율이 평균에서 벗어나면 들어가고 되돌아오면 나온다. 드물게, 작게.",
  "mk2-portfolio":
    "Mac mini에서 논스톱으로 돌아가는 실제 MK2 엔진(OKX 페이퍼, BTC/ETH/XRP/DOGE × 15m/30m 서브전략 10개, 레버리지 ~10x)의 기록을 그대로 보여준다. 시뮬레이션이 아니라 아카이브.",
  "poly-copy-macro":
    "Polymarket에서 수익률 상위 매크로·정치 지갑 4개를 따라간다. 그 지갑이 YES/NO 지분을 사면 같은 확률가에 비례 진입, 정산(0 또는 1)까지 들고 가거나 확률이 움직이면 먼저 나온다.",
  "poly-copy-sports":
    "스포츠·크립토 가격 마켓처럼 하루 이틀 안에 끝나는 짧은 마켓만 카피한다. 지분 수가 많고 회전이 빠르다.",
  "weather-bracket-arb":
    "Kalshi의 '이 도시 최고기온이 A~B°F일까?' 브래킷 마켓에서 예보 모델 확률과 호가의 괴리가 8%p 넘을 때만 소액 베팅. 다음날 실제 기온으로 정산.",
  "equity-momentum":
    "대형 테크 7종 중 20거래일 수익률 상위·5일 양전환 종목을 정규장에서만 산다. 트레일링 스톱 −4.5%, 최대 12거래일 보유.",
  "etf-rotation": "매주 월요일 개장에 20일 수익률 상위 ETF 2개로 갈아탄다. 주식·채권·금·에너지 사이를 오간다.",
};

export const SYMBOL_LABEL: Record<string, string> = {
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
  SOLUSDT: "SOL",
  SUIUSDT: "SUI",
  POLYMARKET: "Polymarket",
  KALSHI: "Kalshi",
  "US-EQ": "US 주식",
  MULTI: "BTC·ETH·XRP·DOGE",
};

export function symbolLabel(sym: string): string {
  return SYMBOL_LABEL[sym] ?? sym.replace(/USDT$/, "");
}

/** 리더보드/시트에서 "무엇의 실데이터인지"를 한 줄로. */
export function sourceLine(kind: AgentKind, symbol: string): string {
  switch (kind) {
    case "crypto":
      return symbol === "MULTI" ? "OKX 실기록 아카이브 · MK2" : `${symbolLabel(symbol)} 실시세 리플레이 · 페이퍼`;
    case "polymarket-copy":
      return "Polymarket 지갑 카피 · 페이퍼";
    case "weather-arb":
      return "Kalshi 기온 마켓 · 페이퍼";
    case "stocks":
      return "미국 정규장 · 페이퍼";
  }
}

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

export const WINDOW_LABEL: Record<BacktestWindow, string> = {
  "1d": "1일",
  "7d": "7일",
  "30d": "30일",
  "90d": "3개월",
  "180d": "6개월",
};

export const WINDOW_SHORT: Record<BacktestWindow, string> = {
  "1d": "1D",
  "7d": "7D",
  "30d": "30D",
  "90d": "3M",
  "180d": "6M",
};

export function riskSentence(mddPct: number, windowLabel: string): string {
  if (mddPct < 0.6) return `${windowLabel} 동안 고점 대비 거의 안 흔들렸어요`;
  return `최악의 경우 ${windowLabel} 중 고점에서 −${mddPct.toFixed(1)}%까지 떨어진 적 있어요`;
}
