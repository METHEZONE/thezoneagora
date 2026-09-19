import type { BacktestWindow } from "@/lib/backtest/klines";
import type { AgentKind, BtMetrics, RiskGrade, ScoreBreakdown } from "@/lib/backtest/engine";

// ─────────────────────────────────────────────────────────────────────────────
// 대체 전략(크립토 외) 도메인 타입.
//
// 크립토 5종은 Binance 실시세 위에서 BUY/SELL 왕복으로만 움직이지만, 예측시장·날씨·주식은
// "포지션"의 생김새 자체가 다르다:
//   · Polymarket 카피 — YES/NO 지분을 확률가(0~1)로 사고, 마켓이 정산(0 또는 1)되거나
//     확률이 움직였을 때 빠져나온다. 손익은 지분 × (정산가 − 진입확률).
//   · 날씨 아비트리지 — Kalshi식 "도시 X의 최고기온이 A~B°F일까?" 브래킷 마켓. 예보 모델
//     확률과 마켓 가격의 괴리(edge)가 있을 때만 소액 베팅, 다음날 정산.
//   · 미국 주식 — 정규장(09:30~16:00 ET)에만 체결, 주말·야간엔 시가평가가 멈춘다.
// 그래서 결과 타입도 종류별로 나누고, 공통 지표(BtMetrics/점수)만 같은 그릇에 담는다.
// ─────────────────────────────────────────────────────────────────────────────

export type AltKind = Exclude<AgentKind, "crypto">;

export type Verdict = "VERIFIED" | "REJECTED";

export interface AltAgentConfig {
  agentId: string;
  kind: AltKind;
  /** 리더보드 "심볼" 자리에 들어가는 거래 무대 라벨 */
  venue: string;
  /** 서브 전략 라벨(칩) */
  strategy: string;
  /** 시드 — 같은 시드면 누가 봐도 같은 곡선 */
  seed: number;
}

export interface EquityPoint {
  t: number;
  equity: number;
}

// ── Polymarket 카피트레이드 ───────────────────────────────────────────────────
export type PolyStatus = "open" | "won" | "lost" | "exited";

export interface PolyPosition {
  id: string;
  /** 마켓 질문 */
  market: string;
  category: string;
  side: "YES" | "NO";
  /** 진입 확률가(0~1) */
  entryProb: number;
  /** 현재(또는 청산) 확률가 */
  currentProb: number;
  /** 보유 지분 수 (1지분 = 정산 시 $1) */
  shares: number;
  /** 투입 금액 */
  stake: number;
  openedAt: number;
  closedAt: number | null;
  status: PolyStatus;
  /** 청산·정산 후 실현 손익. open이면 시가평가 미실현 손익 */
  pnl: number;
  /** 어느 지갑을 따라갔는지 */
  copiedFrom: string;
  verdict: Verdict;
  rejectReason?: string;
  riskScoreBps: number;
}

export interface CopiedWallet {
  address: string;
  label: string;
  /** 이 지갑의 최근 30일 손익(표시용) */
  pnl30d: number;
  winRatePct: number;
  /** 우리가 배분하는 비중 */
  weightPct: number;
  positions: number;
}

// ── 날씨 아비트리지 ──────────────────────────────────────────────────────────
export type WeatherStatus = "pending" | "win" | "loss";

export interface WeatherPosition {
  id: string;
  ticker: string;
  question: string;
  city: string;
  /** 마켓 대상일 (YYYY-MM-DD) */
  date: string;
  bracketLo: number;
  bracketHi: number;
  side: "YES" | "NO";
  /** 마켓 가격(확률) */
  entryPrice: number;
  /** 예보 모델 최고기온(°F) */
  forecastTemp: number;
  /** 모델이 본 YES 확률 */
  modelProb: number;
  /** 모델 확률 − 마켓 가격(우리 side 기준) */
  edge: number;
  betUsd: number;
  shares: number;
  openedAt: number;
  resolvedAt: number | null;
  status: WeatherStatus;
  /** 실제 최고기온 (정산 후) */
  actualTemp: number | null;
  pnl: number;
  verdict: Verdict;
  rejectReason?: string;
  riskScoreBps: number;
}

// ── 미국 주식 ────────────────────────────────────────────────────────────────
export interface StockTrade {
  id: string;
  t: number;
  side: "BUY" | "SELL";
  ticker: string;
  sector: string;
  price: number;
  shares: number;
  notional: number;
  /** SELL일 때 실현 손익 */
  pnl: number | null;
  pnlPct: number | null;
  /** SELL일 때 보유 거래일 수 */
  holdDays: number | null;
  reason: string;
  equityAfter: number;
  verdict: Verdict;
  rejectReason?: string;
  riskScoreBps: number;
}

export interface StockHolding {
  ticker: string;
  sector: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  openedAt: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  /** 포트폴리오 비중 % */
  weightPct: number;
}

// ── 결과 ────────────────────────────────────────────────────────────────────
interface AltResultBase {
  agentId: string;
  window: BacktestWindow;
  venue: string;
  strategy: string;
  capital: number;
  /** 창 안의 시가평가 자산 곡선 (시간 단위 샘플) */
  equityCurve: EquityPoint[];
  metrics: BtMetrics;
  score: ScoreBreakdown;
  riskGrade: RiskGrade;
  /** 시뮬레이션 기준 시각 */
  asOf: number;
}

export interface PolyResult extends AltResultBase {
  kind: "polymarket-copy";
  open: PolyPosition[];
  closed: PolyPosition[];
  wallets: CopiedWallet[];
}

export interface WeatherResult extends AltResultBase {
  kind: "weather-arb";
  pending: WeatherPosition[];
  resolved: WeatherPosition[];
  /** 도시별 요약 (정산 건수·승률) */
  cities: { city: string; trades: number; wins: number; pnl: number }[];
}

export interface StocksResult extends AltResultBase {
  kind: "stocks";
  holdings: StockHolding[];
  trades: StockTrade[];
  /** 벤치마크(SPY) 곡선 — equityCurve와 같은 길이 */
  benchCurve: number[];
  benchLabel: string;
  sectorExposure: { sector: string; weightPct: number }[];
  cashPct: number;
}

export type AltResult = PolyResult | WeatherResult | StocksResult;
