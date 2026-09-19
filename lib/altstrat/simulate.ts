import { computeMetrics, computeScore, riskGradeOf } from "@/lib/backtest/engine";
import { WINDOW_SPEC, type BacktestWindow } from "@/lib/backtest/klines";
import { clamp, normCdf, rngAt, type Rng } from "@/lib/altstrat/rng";
import type {
  AltAgentConfig,
  AltResult,
  CopiedWallet,
  EquityPoint,
  PolyPosition,
  PolyResult,
  StockHolding,
  StockTrade,
  StocksResult,
  WeatherPosition,
  WeatherResult,
} from "@/lib/altstrat/types";

// ─────────────────────────────────────────────────────────────────────────────
// 대체 전략 결정론적 페이퍼 시뮬레이션.
//
// 원칙
//  · 시간 격자는 1시간. ORIGIN부터 asOf(정시로 내림)까지 한 번에 굴린 "마스터 곡선"을
//    창(1일~6개월)으로 잘라 보여준다 → 1D 곡선의 끝과 7D 곡선의 끝이 항상 같다.
//  · 모든 난수는 (시드, 시각, 소금)에서 나온다. 같은 시각을 다시 계산하면 같은 값.
//    새 시간이 붙을 때만 곡선이 자란다 — 실시세 리플레이와 같은 "느린 시계" 감각.
//  · 손익 계산은 각 무대의 실제 규칙을 따른다(정산가 0/1, 브래킷 정산, 정규장 시간).
//  · Agora 검증 게이트(위험도 상한 → REJECTED)도 그대로 태운다. 거부된 판단은 로그에 남는다.
// ─────────────────────────────────────────────────────────────────────────────

const HOUR = 3600_000;
const ORIGIN = Date.UTC(2026, 2, 16, 0, 0, 0); // 2026-03-16 — 6개월 창을 항상 덮는다
const RISK_LIMIT_BPS = 7000;
const CAPITAL = 10_000;

export function altAsOf(now = Date.now()): number {
  return Math.floor(now / HOUR) * HOUR;
}

// ── Polymarket ──────────────────────────────────────────────────────────────

const MACRO_MARKETS: { q: string; cat: string }[] = [
  { q: "Fed가 10월 FOMC에서 금리를 인하할까?", cat: "매크로" },
  { q: "미국 9월 CPI(전년비)가 3.0%를 넘을까?", cat: "매크로" },
  { q: "11월 1일 전 미국 연방정부 셧다운이 발생할까?", cat: "정치" },
  { q: "미 대법원이 이번 회기에 관세 권한 사건을 심리할까?", cat: "정치" },
  { q: "10월 말 미국 10년물 금리가 4.0% 아래일까?", cat: "매크로" },
  { q: "OpenAI가 연내 새 플래그십 모델을 공개할까?", cat: "테크" },
  { q: "Apple이 10월 이벤트를 개최할까?", cat: "테크" },
  { q: "이번 달 미국 실업률이 4.5%를 넘을까?", cat: "매크로" },
  { q: "EU가 연내 디지털 유로 법안을 통과시킬까?", cat: "정치" },
  { q: "TikTok 미국 사업 매각이 10월 안에 종결될까?", cat: "테크" },
  { q: "OPEC+가 다음 회의에서 증산을 결정할까?", cat: "매크로" },
  { q: "이번 주 WTI 원유가 배럴당 $70을 넘을까?", cat: "매크로" },
  { q: "미국 하원이 이번 달 예산결의안을 통과시킬까?", cat: "정치" },
  { q: "NVIDIA 분기 매출이 가이던스를 상회할까?", cat: "테크" },
  { q: "BOJ가 연내 추가 금리 인상을 단행할까?", cat: "매크로" },
  { q: "ECB가 10월 회의에서 금리를 동결할까?", cat: "매크로" },
  { q: "SpaceX Starship 다음 시험비행이 성공할까?", cat: "테크" },
  { q: "미 상원이 이번 달 스테이블코인 법안 표결에 들어갈까?", cat: "정치" },
];

const SPORTS_MARKETS: { q: string; cat: string }[] = [
  { q: "LA 레이커스 vs 보스턴 — 레이커스 승?", cat: "NBA" },
  { q: "맨체스터 시티 vs 아스날 — 무승부?", cat: "축구" },
  { q: "이번 주말 EPL 토트넘 승리?", cat: "축구" },
  { q: "캔자스시티 치프스가 이번 주 경기에서 이길까?", cat: "NFL" },
  { q: "ETH가 다음 주 금요일 $4,500 위에서 마감할까?", cat: "크립토가격" },
  { q: "BTC가 이번 주 $120k를 터치할까?", cat: "크립토가격" },
  { q: "SOL이 이번 달 $250을 넘을까?", cat: "크립토가격" },
  { q: "다저스가 이번 시리즈를 스윕할까?", cat: "MLB" },
  { q: "이번 주말 북미 박스오피스 1위는 신작일까?", cat: "엔터" },
  { q: "UFC 메인이벤트가 1라운드에 끝날까?", cat: "격투" },
  { q: "F1 다음 그랑프리 — 베르스타펜 폴 포지션?", cat: "F1" },
  { q: "골든스테이트가 홈에서 15점차 이상으로 이길까?", cat: "NBA" },
  { q: "리버풀이 이번 라운드에서 무실점 승리할까?", cat: "축구" },
  { q: "SUI가 이번 주 $4.00을 회복할까?", cat: "크립토가격" },
  { q: "빌리 아일리시 신곡이 빌보드 1위로 데뷔할까?", cat: "엔터" },
  { q: "필라델피아 이글스 -6.5 커버?", cat: "NFL" },
];

const WALLETS_MACRO: Omit<CopiedWallet, "pnl30d" | "winRatePct" | "positions">[] = [
  { address: "0x8f3a…c21d", label: "theo.eth · 매크로 전문", weightPct: 35 },
  { address: "0x41b7…9e02", label: "quietwhale · 정치 마켓", weightPct: 30 },
  { address: "0xd2c9…77af", label: "rates_nerd", weightPct: 20 },
  { address: "0x0be4…13c8", label: "fomc_watcher", weightPct: 15 },
];

const WALLETS_SPORTS: Omit<CopiedWallet, "pnl30d" | "winRatePct" | "positions">[] = [
  { address: "0x6a11…4d90", label: "courtside · NBA 스프레드", weightPct: 30 },
  { address: "0xf70e…2b6c", label: "xg_model · 축구 xG", weightPct: 30 },
  { address: "0x93cd…e5a1", label: "perp_hedger · 크립토 가격", weightPct: 25 },
  { address: "0x2e58…8fb3", label: "sunday_ticket", weightPct: 15 },
];

interface PolyParams {
  markets: { q: string; cat: string }[];
  wallets: typeof WALLETS_MACRO;
  /** 시간당 새 포지션 제안 확률 */
  lambda: number;
  /** 1회 투입 비중 */
  stakeFrac: number;
  maxOpen: number;
  /** 우리 side가 맞을 확률에 더해지는 평균 엣지 */
  meanEdge: number;
  /** 보유 시간 중앙값(시간) */
  medianHoldH: number;
  /** 정산 전 조기 청산 비율 */
  earlyExitRate: number;
  baseRiskBps: number;
}

const POLY_PARAMS: Record<string, PolyParams> = {
  pythia: {
    markets: MACRO_MARKETS,
    wallets: WALLETS_MACRO,
    lambda: 1 / 9,
    stakeFrac: 0.05,
    maxOpen: 6,
    meanEdge: 0.045,
    medianHoldH: 96,
    earlyExitRate: 0.3,
    baseRiskBps: 2400,
  },
  augur: {
    markets: SPORTS_MARKETS,
    wallets: WALLETS_SPORTS,
    lambda: 1 / 5,
    stakeFrac: 0.03,
    maxOpen: 8,
    meanEdge: 0.028,
    medianHoldH: 36,
    earlyExitRate: 0.25,
    baseRiskBps: 3000,
  },
};

interface PolyRuntime extends PolyPosition {
  closeH: number;
  /** 정산/청산 확률가 (won=1, lost=0, exited=q) */
  target: number;
  openH: number;
}

function probPath(q0: number, target: number, progress: number, noise: number): number {
  // 정산이 가까워질수록 확률이 결과 쪽으로 가속 이동(예측시장 특유의 막판 점프).
  const x = clamp(progress, 0, 1);
  const f = x < 0.7 ? (0.25 * x) / 0.7 : 0.25 + 0.75 * ((x - 0.7) / 0.3) ** 2;
  return clamp(q0 + (target - q0) * f + noise, 0.02, 0.98);
}

function simulatePoly(cfg: AltAgentConfig, asOf: number): { curve: EquityPoint[]; positions: PolyRuntime[] } {
  const P = POLY_PARAMS[cfg.agentId];
  const totalH = Math.floor((asOf - ORIGIN) / HOUR);
  let cash = CAPITAL;
  const all: PolyRuntime[] = [];
  const open: PolyRuntime[] = [];
  const curve: EquityPoint[] = [];
  let seq = 0;

  for (let h = 0; h <= totalH; h++) {
    const t = ORIGIN + h * HOUR;
    const r = rngAt(cfg.seed, h, "poly");

    // 1) 열린 포지션 시가평가 / 정산
    for (let i = open.length - 1; i >= 0; i--) {
      const p = open[i];
      const progress = (h - p.openH) / Math.max(1, p.closeH - p.openH);
      p.currentProb = probPath(p.entryProb, p.target, progress, r.normal() * 0.025);
      p.pnl = p.shares * (p.currentProb - p.entryProb);
      if (h >= p.closeH) {
        p.currentProb = p.target;
        p.pnl = p.shares * (p.target - p.entryProb);
        p.status = p.target >= 0.999 ? "won" : p.target <= 0.001 ? "lost" : "exited";
        p.closedAt = t;
        cash += p.shares * p.target;
        open.splice(i, 1);
      }
    }

    // 2) 새 포지션 제안 (따라가는 지갑이 진입)
    if (r.chance(P.lambda) && open.length < P.maxOpen) {
      const m = r.pick(P.markets);
      const wallet = r.pick(P.wallets);
      const side: "YES" | "NO" = r.chance(0.55) ? "YES" : "NO";
      const q0 = clamp(0.12 + r.next() * 0.76, 0.08, 0.92);
      const volTerm = Math.round(clamp((0.5 - Math.abs(q0 - 0.5)) * 2, 0, 1) * 1400); // 50:50에 가까울수록 위험
      const riskScoreBps = Math.round(clamp(P.baseRiskBps + volTerm + r.next() * 4800, 0, 10_000));
      const equity = cash + open.reduce((s, p) => s + p.shares * p.currentProb, 0);
      const stake = Math.min(cash * 0.95, equity * P.stakeFrac);
      const id = `${cfg.agentId}-${seq++}`;
      const base = {
        id,
        market: m.q,
        category: m.cat,
        side,
        entryProb: Math.round(q0 * 100) / 100,
        currentProb: Math.round(q0 * 100) / 100,
        openedAt: t,
        closedAt: null,
        copiedFrom: wallet.address,
        openH: h,
      };
      if (riskScoreBps > RISK_LIMIT_BPS) {
        all.push({
          ...base,
          shares: 0,
          stake: 0,
          status: "exited",
          pnl: 0,
          verdict: "REJECTED",
          rejectReason: "위험도 상한 초과 (50:50 근처 · 유동성 얕음)",
          riskScoreBps,
          closeH: h,
          target: q0,
          closedAt: t,
        });
      } else if (stake >= 20) {
        const edge = P.meanEdge + r.normal() * 0.1;
        const pWin = clamp(q0 + edge, 0.03, 0.97);
        const early = r.chance(P.earlyExitRate);
        const holdH = Math.max(6, Math.round(P.medianHoldH * Math.exp(r.normal() * 0.7)));
        let target: number;
        if (early) target = clamp(q0 + edge * 0.6 + r.normal() * 0.12, 0.03, 0.97);
        else target = r.chance(pWin) ? 1 : 0;
        const shares = stake / q0;
        cash -= stake;
        const pos: PolyRuntime = {
          ...base,
          shares: Math.round(shares * 100) / 100,
          stake: Math.round(stake * 100) / 100,
          status: "open",
          pnl: 0,
          verdict: "VERIFIED",
          riskScoreBps,
          closeH: h + holdH,
          target,
        };
        open.push(pos);
        all.push(pos);
      }
    }

    const mtm = cash + open.reduce((s, p) => s + p.shares * p.currentProb, 0);
    curve.push({ t, equity: mtm });
  }
  return { curve, positions: all };
}

// ── 날씨 아비트리지 (Kalshi 브래킷) ────────────────────────────────────────

interface City {
  name: string;
  code: string;
  /** 월별(1~12) 평년 최고기온 °F */
  normals: number[];
}

const CITIES: City[] = [
  { name: "New York", code: "NY", normals: [39, 42, 50, 62, 71, 80, 85, 83, 76, 65, 54, 44] },
  { name: "Chicago", code: "CHI", normals: [32, 36, 47, 59, 70, 80, 84, 82, 75, 63, 48, 36] },
  { name: "Miami", code: "MIA", normals: [76, 78, 80, 83, 87, 89, 91, 91, 89, 86, 81, 78] },
  { name: "Austin", code: "AUS", normals: [62, 66, 73, 80, 87, 93, 97, 98, 91, 82, 71, 63] },
  { name: "Los Angeles", code: "LAX", normals: [68, 68, 70, 73, 74, 78, 83, 84, 83, 79, 73, 67] },
  { name: "Denver", code: "DEN", normals: [45, 47, 55, 61, 71, 83, 90, 88, 79, 65, 53, 44] },
  { name: "Seattle", code: "SEA", normals: [47, 50, 54, 59, 66, 70, 76, 77, 71, 60, 51, 46] },
  { name: "Phoenix", code: "PHX", normals: [67, 71, 77, 86, 95, 104, 106, 105, 100, 89, 76, 66] },
];

const TRUE_SIGMA = 4.0; // 실제 오차 σ — 모델은 약간 과신한다
const MIN_EDGE = 0.08;

function bracketProb(forecast: number, lo: number, hi: number, sigma: number): number {
  return normCdf((hi + 1 - forecast) / sigma) - normCdf((lo - forecast) / sigma);
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

interface WeatherRuntime extends WeatherPosition {
  resolveH: number;
}

function simulateWeather(cfg: AltAgentConfig, asOf: number): { curve: EquityPoint[]; positions: WeatherRuntime[] } {
  const totalH = Math.floor((asOf - ORIGIN) / HOUR);
  let cash = CAPITAL;
  const all: WeatherRuntime[] = [];
  const pending: WeatherRuntime[] = [];
  const curve: EquityPoint[] = [];
  let seq = 0;

  for (let h = 0; h <= totalH; h++) {
    const t = ORIGIN + h * HOUR;
    const d = new Date(t);
    const utcHour = d.getUTCHours();

    // 정산: 대상일 다음날 06:00 UTC (실제 최고기온은 컨센서스 예보 기준으로 흩어진다)
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (h >= p.resolveH) {
        const rr = rngAt(cfg.seed, p.resolveH, `resolve:${p.id}`);
        const actual = Math.round((p.forecastTemp + rr.normal() * TRUE_SIGMA) * 10) / 10;
        // (모델 예보 기준 — 컨센서스와의 차이는 모델 오차에 이미 포함)
        const inBracket = actual >= p.bracketLo && actual < p.bracketHi + 1;
        const yesWins = inBracket;
        const won = p.side === "YES" ? yesWins : !yesWins;
        p.actualTemp = actual;
        p.status = won ? "win" : "loss";
        // Kalshi 수수료: 이익의 7% 상당
        const gross = p.shares - p.betUsd;
        const fee = won ? gross * 0.07 : 0;
        p.pnl = won ? Math.round((gross - fee) * 100) / 100 : -p.betUsd;
        p.resolvedAt = t;
        if (won) cash += p.shares - fee;
        pending.splice(i, 1);
      }
    }

    // 스캔: 매일 14:00 UTC (미국 오전) 내일 최고기온 마켓
    if (utcHour === 14) {
      const dayKey = Math.floor(t / (24 * HOUR));
      const targetDate = t + 24 * HOUR;
      const month = new Date(targetDate).getUTCMonth();
      const equity = cash + pending.reduce((s, p) => s + p.betUsd, 0);
      // 바이너리 마켓 유동성이 얕아 판돈은 자본에 비례해 키우지 않는다(하루 최대 $300).
      let dailyBudget = Math.min(equity * 0.02, 300);
      for (const city of CITIES) {
        const rc = rngAt(cfg.seed, dayKey, `city:${city.code}`);
        const normal = city.normals[month];
        // 컨센서스 예보(마켓이 아는 것)와, 우리 모델 예보(약간 다른 앙상블)를 구분한다.
        const forecast = Math.round((normal + clamp(rc.normal() * 6, -11, 11)) * 10) / 10;
        const modelForecast = Math.round((forecast + rc.normal() * 1.3) * 10) / 10;
        const modelSigma = 2.6 + rc.next() * 1.2; // 모델 확신도는 날마다 다르다
        const center = Math.floor(forecast);
        const offsets = [-4, -2, 0, 2, 4];
        let placed = 0;
        for (const off of offsets) {
          if (placed >= 2 || dailyBudget < 20) break;
          const lo = center + off - 1;
          const hi = lo + 1; // 2°F 브래킷 (예: 74-75°)
          const model = bracketProb(modelForecast, lo, hi, modelSigma);
          // 마켓은 컨센서스 예보와 실제 오차(TRUE_SIGMA)를 대체로 알고 있고 거기에 호가 잡음이 얹힌다 —
          // 모델이 보는 "엣지"의 상당 부분은 모델의 과신이다(실제 Kalshi 기록이 그랬다).
          const fair = bracketProb(forecast, lo, hi, TRUE_SIGMA);
          const market = clamp(fair * (1 + rc.normal() * 0.12) + rc.normal() * 0.015, 0.03, 0.9);
          let side: "YES" | "NO" | null = null;
          let entry = 0;
          let edge = 0;
          if (model - market > MIN_EDGE) {
            side = "YES";
            entry = market;
            edge = model - market;
          } else if (market - model > MIN_EDGE) {
            side = "NO";
            entry = 1 - market;
            edge = market - model;
          }
          if (!side) continue;
          const riskScoreBps = Math.round(clamp(1800 + edge * 9000 + rc.next() * 2500, 0, 10_000));
          const id = `${cfg.agentId}-${seq++}`;
          const ticker = `KXHIGH${city.code}-${ymd(targetDate).replace(/-/g, "").slice(2)}-B${lo}.5`;
          const question = `${city.name} 최고기온이 ${ymd(targetDate).slice(5).replace("-", "/")}에 ${lo}~${hi}°F일까?`;
          const base = {
            id,
            ticker,
            question,
            city: city.name,
            date: ymd(targetDate),
            bracketLo: lo,
            bracketHi: hi,
            side,
            entryPrice: Math.round(entry * 100) / 100,
            forecastTemp: modelForecast,
            modelProb: Math.round((side === "YES" ? model : 1 - model) * 1000) / 1000,
            edge: Math.round(edge * 1000) / 1000,
            openedAt: t,
            resolvedAt: null,
            actualTemp: null,
            riskScoreBps,
            resolveH: h + 40, // 대상일 다음날 06:00 UTC(15:00 KST) — 그날 최고기온이 확정된 뒤
          };
          if (riskScoreBps > RISK_LIMIT_BPS) {
            all.push({
              ...base,
              betUsd: 0,
              shares: 0,
              status: "loss",
              pnl: 0,
              verdict: "REJECTED",
              rejectReason: "엣지 과대 — 호가 신뢰도 낮음(유동성 부족)",
            });
            continue;
          }
          const bet = Math.round(clamp(15 + edge * 120, 15, 45));
          if (bet > dailyBudget || bet > cash) continue;
          const shares = Math.round((bet / entry) * 100) / 100;
          cash -= bet;
          dailyBudget -= bet;
          placed += 1;
          const pos: WeatherRuntime = {
            ...base,
            betUsd: bet,
            shares,
            status: "pending",
            pnl: 0,
            verdict: "VERIFIED",
          };
          pending.push(pos);
          all.push(pos);
        }
      }
    }

    // 바이너리 마켓은 정산 전까지 원가로 본다(계단형 곡선).
    const mtm = cash + pending.reduce((s, p) => s + p.betUsd, 0);
    curve.push({ t, equity: mtm });
  }
  return { curve, positions: all };
}

// ── 미국 주식 ────────────────────────────────────────────────────────────────

interface Ticker {
  sym: string;
  sector: string;
  px: number;
  /** 일간 변동성 */
  dvol: number;
  /** 일간 드리프트 */
  drift: number;
}

const TECH: Ticker[] = [
  { sym: "NVDA", sector: "반도체", px: 178, dvol: 0.031, drift: 0.0011 },
  { sym: "AAPL", sector: "하드웨어", px: 238, dvol: 0.016, drift: 0.0004 },
  { sym: "MSFT", sector: "소프트웨어", px: 512, dvol: 0.015, drift: 0.0005 },
  { sym: "TSLA", sector: "자동차", px: 421, dvol: 0.038, drift: 0.0006 },
  { sym: "AMZN", sector: "커머스", px: 231, dvol: 0.019, drift: 0.0005 },
  { sym: "META", sector: "플랫폼", px: 742, dvol: 0.021, drift: 0.0006 },
  { sym: "AMD", sector: "반도체", px: 159, dvol: 0.033, drift: 0.0007 },
];

const ETFS: Ticker[] = [
  { sym: "SPY", sector: "미국 대형주", px: 662, dvol: 0.009, drift: 0.0004 },
  { sym: "QQQ", sector: "나스닥100", px: 598, dvol: 0.012, drift: 0.0005 },
  { sym: "IWM", sector: "소형주", px: 241, dvol: 0.014, drift: 0.0002 },
  { sym: "TLT", sector: "장기국채", px: 89, dvol: 0.010, drift: 0.0000 },
  { sym: "GLD", sector: "금", px: 338, dvol: 0.009, drift: 0.0005 },
  { sym: "XLE", sector: "에너지", px: 88, dvol: 0.015, drift: 0.0001 },
];

const BENCH: Ticker = { sym: "SPY", sector: "미국 대형주", px: 662, dvol: 0.009, drift: 0.0004 };
const BARS_PER_DAY = 7; // 13:30~20:00 UTC → 14..20시 봉
const TRADING_HOURS_UTC = new Set([14, 15, 16, 17, 18, 19, 20]);

function isTradingHour(t: number): boolean {
  const d = new Date(t);
  const wd = d.getUTCDay();
  return wd >= 1 && wd <= 5 && TRADING_HOURS_UTC.has(d.getUTCHours());
}

/** 종목별 가격 경로 — 약한 추세 지속(AR(1) φ=0.18)을 넣어 모멘텀이 아주 조금 먹힌다. */
function buildPricePath(tk: Ticker, totalH: number, seed: number): Float64Array {
  const path = new Float64Array(totalH + 1);
  let px = tk.px * Math.exp(-tk.drift * 120); // 6개월 전 가격으로 되감기
  let prevRet = 0;
  const hv = tk.dvol / Math.sqrt(BARS_PER_DAY);
  let firstBarOfDay = true;
  for (let h = 0; h <= totalH; h++) {
    const t = ORIGIN + h * HOUR;
    if (isTradingHour(t)) {
      const r = rngAt(seed, h, `px:${tk.sym}`);
      const gap = firstBarOfDay ? r.normal() * tk.dvol * 0.55 : 0;
      const shock = r.normal() * hv;
      const ret = tk.drift / BARS_PER_DAY + 0.18 * prevRet + shock + gap;
      px *= Math.exp(ret);
      prevRet = ret - gap;
      firstBarOfDay = false;
    } else if (new Date(t).getUTCHours() === 21) {
      firstBarOfDay = true;
    }
    path[h] = px;
  }
  return path;
}

interface StockPos {
  ticker: Ticker;
  shares: number;
  entryPrice: number;
  openH: number;
  peak: number;
  tradingBarsHeld: number;
}

function simulateStocks(
  cfg: AltAgentConfig,
  asOf: number
): { curve: EquityPoint[]; trades: StockTrade[]; holdings: StockPos[]; bench: Float64Array; paths: Map<string, Float64Array> } {
  const universe = cfg.agentId === "sigma" ? TECH : ETFS;
  const totalH = Math.floor((asOf - ORIGIN) / HOUR);
  const paths = new Map<string, Float64Array>();
  for (const tk of universe) paths.set(tk.sym, buildPricePath(tk, totalH, cfg.seed));
  const bench = paths.get("SPY") ?? buildPricePath(BENCH, totalH, cfg.seed);

  let cash = CAPITAL;
  const pos = new Map<string, StockPos>();
  const trades: StockTrade[] = [];
  const curve: EquityPoint[] = [];
  const FEE = 0.0005;
  const momentum = cfg.agentId === "sigma";
  const maxSlots = momentum ? 3 : 2;
  const slotFrac = momentum ? 0.3 : 0.45;
  let seq = 0;
  let lastRotationWeek = -1;

  const mtmAt = (h: number) => {
    let v = cash;
    for (const p of pos.values()) v += p.shares * paths.get(p.ticker.sym)![h];
    return v;
  };

  for (let h = 0; h <= totalH; h++) {
    const t = ORIGIN + h * HOUR;
    if (isTradingHour(t)) {
      const r = rngAt(cfg.seed, h, "stk");
      const lookback = momentum ? 20 * BARS_PER_DAY : 20 * BARS_PER_DAY;
      const retOver = (sym: string, bars: number) => {
        const path = paths.get(sym)!;
        // bars(거래봉) 만큼 뒤 — 거래시간 봉만 세기 위해 대략 bars*24/7 시간 뒤로
        const back = Math.round((bars * 24) / BARS_PER_DAY);
        const i0 = Math.max(0, h - back);
        return path[h] / path[i0] - 1;
      };

      // 청산 판단
      for (const [sym, p] of Array.from(pos.entries())) {
        const px = paths.get(sym)![h];
        p.peak = Math.max(p.peak, px);
        p.tradingBarsHeld += 1;
        let reason: string | null = null;
        if (momentum) {
          if (px < p.peak * 0.955) reason = "트레일링 스톱 −4.5%";
          else if (p.tradingBarsHeld >= 12 * BARS_PER_DAY) reason = "최대 보유일(12일) 도달";
          else if (retOver(sym, 20 * BARS_PER_DAY) < -0.01 && p.tradingBarsHeld > BARS_PER_DAY) reason = "20일 모멘텀 소멸";
        }
        if (reason) {
          const notional = p.shares * px;
          const fee = notional * FEE;
          const cost = p.shares * p.entryPrice;
          const pnl = notional - fee - cost;
          cash += notional - fee;
          pos.delete(sym);
          trades.push({
            id: `${cfg.agentId}-${seq++}`,
            t,
            side: "SELL",
            ticker: sym,
            sector: p.ticker.sector,
            price: Math.round(px * 100) / 100,
            shares: Math.round(p.shares * 1000) / 1000,
            notional: Math.round(notional),
            pnl: Math.round(pnl * 100) / 100,
            pnlPct: Math.round((pnl / cost) * 10000) / 100,
            holdDays: Math.round((p.tradingBarsHeld / BARS_PER_DAY) * 10) / 10,
            reason,
            equityAfter: Math.round(mtmAt(h) * 100) / 100,
            verdict: "VERIFIED",
            riskScoreBps: 0,
          });
        }
      }

      // 진입 판단
      if (momentum) {
        if (pos.size < maxSlots && h > lookback) {
          const ranked = universe
            .filter((tk) => !pos.has(tk.sym))
            .map((tk) => ({ tk, m: retOver(tk.sym, 20 * BARS_PER_DAY), s: retOver(tk.sym, 5 * BARS_PER_DAY) }))
            .filter((x) => x.m > 0.03 && x.s > 0)
            .sort((a, b) => b.m - a.m);
          const cand = ranked[0];
          if (cand && r.chance(0.35)) {
            const px = paths.get(cand.tk.sym)![h];
            const vol = cand.tk.dvol;
            const riskScoreBps = Math.round(clamp(2200 + vol * 90_000 + r.next() * 3200, 0, 10_000));
            const equity = mtmAt(h);
            const notional = Math.min(cash * 0.98, equity * slotFrac);
            if (riskScoreBps > RISK_LIMIT_BPS) {
              trades.push({
                id: `${cfg.agentId}-${seq++}`,
                t,
                side: "BUY",
                ticker: cand.tk.sym,
                sector: cand.tk.sector,
                price: Math.round(px * 100) / 100,
                shares: 0,
                notional: 0,
                pnl: null,
                pnlPct: null,
                holdDays: null,
                reason: `20일 +${(cand.m * 100).toFixed(1)}% 모멘텀`,
                equityAfter: Math.round(equity * 100) / 100,
                verdict: "REJECTED",
                rejectReason: "위험도 상한 초과 (변동성 급등)",
                riskScoreBps,
              });
            } else if (notional > 200) {
              const fee = notional * FEE;
              const shares = (notional - fee) / px;
              cash -= notional;
              pos.set(cand.tk.sym, { ticker: cand.tk, shares, entryPrice: px, openH: h, peak: px, tradingBarsHeld: 0 });
              trades.push({
                id: `${cfg.agentId}-${seq++}`,
                t,
                side: "BUY",
                ticker: cand.tk.sym,
                sector: cand.tk.sector,
                price: Math.round(px * 100) / 100,
                shares: Math.round(shares * 1000) / 1000,
                notional: Math.round(notional),
                pnl: null,
                pnlPct: null,
                holdDays: null,
                reason: `20일 +${(cand.m * 100).toFixed(1)}% 모멘텀 · 5일 양전환`,
                equityAfter: Math.round(mtmAt(h) * 100) / 100,
                verdict: "VERIFIED",
                riskScoreBps,
              });
            }
          }
        }
      } else {
        // ETF 로테이션: 매주 월요일 첫 봉에 20일 수익률 상위 2개로 교체
        const d = new Date(t);
        const week = Math.floor((t - ORIGIN) / (7 * 24 * HOUR));
        if (d.getUTCDay() === 1 && d.getUTCHours() === 14 && week !== lastRotationWeek && h > lookback) {
          lastRotationWeek = week;
          const ranked = universe
            .map((tk) => ({ tk, m: retOver(tk.sym, 20 * BARS_PER_DAY) }))
            .sort((a, b) => b.m - a.m);
          const want = ranked.slice(0, maxSlots).filter((x) => x.m > -0.02).map((x) => x.tk.sym);
          // 빠지는 것 청산
          for (const [sym, p] of Array.from(pos.entries())) {
            if (want.includes(sym)) continue;
            const px = paths.get(sym)![h];
            const notional = p.shares * px;
            const fee = notional * FEE;
            const cost = p.shares * p.entryPrice;
            const pnl = notional - fee - cost;
            cash += notional - fee;
            pos.delete(sym);
            trades.push({
              id: `${cfg.agentId}-${seq++}`,
              t,
              side: "SELL",
              ticker: sym,
              sector: p.ticker.sector,
              price: Math.round(px * 100) / 100,
              shares: Math.round(p.shares * 1000) / 1000,
              notional: Math.round(notional),
              pnl: Math.round(pnl * 100) / 100,
              pnlPct: Math.round((pnl / cost) * 10000) / 100,
              holdDays: Math.round((p.tradingBarsHeld / BARS_PER_DAY) * 10) / 10,
              reason: "주간 로테이션 — 상위권 이탈",
              equityAfter: Math.round(mtmAt(h) * 100) / 100,
              verdict: "VERIFIED",
              riskScoreBps: 0,
            });
          }
          // 새로 들어오는 것 매수
          for (const sym of want) {
            if (pos.has(sym)) continue;
            const tk = universe.find((x) => x.sym === sym)!;
            const px = paths.get(sym)![h];
            const equity = mtmAt(h);
            const notional = Math.min(cash * 0.98, equity * slotFrac);
            const riskScoreBps = Math.round(clamp(1600 + tk.dvol * 90_000 + r.next() * 3000, 0, 10_000));
            const m = ranked.find((x) => x.tk.sym === sym)!.m;
            if (riskScoreBps > RISK_LIMIT_BPS) {
              trades.push({
                id: `${cfg.agentId}-${seq++}`,
                t,
                side: "BUY",
                ticker: sym,
                sector: tk.sector,
                price: Math.round(px * 100) / 100,
                shares: 0,
                notional: 0,
                pnl: null,
                pnlPct: null,
                holdDays: null,
                reason: `로테이션 진입 (20일 +${(m * 100).toFixed(1)}%)`,
                equityAfter: Math.round(equity * 100) / 100,
                verdict: "REJECTED",
                rejectReason: "위험도 상한 초과",
                riskScoreBps,
              });
              continue;
            }
            if (notional < 200) continue;
            const fee = notional * FEE;
            const shares = (notional - fee) / px;
            cash -= notional;
            pos.set(sym, { ticker: tk, shares, entryPrice: px, openH: h, peak: px, tradingBarsHeld: 0 });
            trades.push({
              id: `${cfg.agentId}-${seq++}`,
              t,
              side: "BUY",
              ticker: sym,
              sector: tk.sector,
              price: Math.round(px * 100) / 100,
              shares: Math.round(shares * 1000) / 1000,
              notional: Math.round(notional),
              pnl: null,
              pnlPct: null,
              holdDays: null,
              reason: `주간 로테이션 — 20일 +${(m * 100).toFixed(1)}% 상위`,
              equityAfter: Math.round(mtmAt(h) * 100) / 100,
              verdict: "VERIFIED",
              riskScoreBps,
            });
          }
        }
      }
    }
    curve.push({ t, equity: mtmAt(h) });
  }
  return { curve, trades, holdings: Array.from(pos.values()), bench, paths };
}

// ── 창 슬라이스 + 지표 ───────────────────────────────────────────────────────

function windowBounds(window: BacktestWindow, asOf: number): { from: number; startIdx: number } {
  const hours = WINDOW_SPEC[window].hours;
  const from = asOf - hours * HOUR;
  const startIdx = Math.max(0, Math.round((from - ORIGIN) / HOUR));
  return { from: ORIGIN + startIdx * HOUR, startIdx };
}

function rebase(curve: EquityPoint[], startIdx: number, capital: number): { pts: EquityPoint[]; factor: number } {
  const base = curve[startIdx]?.equity ?? CAPITAL;
  const factor = capital / base;
  const pts = curve.slice(startIdx).map((p) => ({ t: p.t, equity: Math.round(p.equity * factor * 100) / 100 }));
  return { pts, factor };
}

export function runAlt(cfg: AltAgentConfig, window: BacktestWindow, capital = CAPITAL, now = Date.now()): AltResult {
  const asOf = altAsOf(now);
  const { from, startIdx } = windowBounds(window, asOf);
  const scale = (v: number, f: number) => Math.round(v * f * 100) / 100;

  if (cfg.kind === "polymarket-copy") {
    const sim = simulatePoly(cfg, asOf);
    const { pts, factor } = rebase(sim.curve, startIdx, capital);
    const inWin = sim.positions.filter((p) => (p.closedAt ?? asOf) >= from);
    const scaled = inWin.map<PolyPosition>((p) => ({
      id: p.id,
      market: p.market,
      category: p.category,
      side: p.side,
      entryProb: p.entryProb,
      currentProb: Math.round(p.currentProb * 100) / 100,
      shares: scale(p.shares, factor),
      stake: scale(p.stake, factor),
      openedAt: p.openedAt,
      closedAt: p.closedAt,
      status: p.status,
      pnl: scale(p.pnl, factor),
      copiedFrom: p.copiedFrom,
      verdict: p.verdict,
      rejectReason: p.rejectReason,
      riskScoreBps: p.riskScoreBps,
    }));
    const open = scaled.filter((p) => p.status === "open");
    const closed = scaled.filter((p) => p.status !== "open").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
    const settled = closed.filter((p) => p.verdict === "VERIFIED");
    const pnlPcts = settled.map((p) => (p.stake > 0 ? (p.pnl / p.stake) * 100 : 0));
    const holds = settled.map((p) => ((p.closedAt ?? asOf) - p.openedAt) / HOUR);
    const eq = pts.map((p) => p.equity);
    const exposure = eq.length; // 예측시장은 거의 항상 포지션 보유
    const metrics = computeMetrics({
      capital,
      equityCurve: eq,
      tradePnlPcts: pnlPcts,
      holdHoursList: holds,
      buys: settled.length + open.filter((p) => p.verdict === "VERIFIED").length,
      sells: settled.length,
      rejected: scaled.filter((p) => p.verdict === "REJECTED").length,
      from,
      to: asOf,
      exposureCount: Math.round(exposure * 0.92),
      openPosition: open.length > 0,
      candlesPerDay: 24,
    });
    const P = POLY_PARAMS[cfg.agentId];
    const wallets: CopiedWallet[] = P.wallets.map((w, i) => {
      const mine = scaled.filter((p) => p.copiedFrom === w.address && p.verdict === "VERIFIED");
      const done = mine.filter((p) => p.status !== "open");
      const wins = done.filter((p) => p.pnl > 0).length;
      const r = rngAt(cfg.seed, Math.floor(asOf / (24 * HOUR)), `wallet:${i}`);
      return {
        ...w,
        pnl30d: Math.round((12_000 + r.normal() * 9_000) * (w.weightPct / 25)),
        winRatePct: done.length ? Math.round((wins / done.length) * 100) : Math.round(52 + r.next() * 14),
        positions: mine.length,
      };
    });
    return {
      kind: "polymarket-copy",
      agentId: cfg.agentId,
      window,
      venue: cfg.venue,
      strategy: cfg.strategy,
      capital,
      equityCurve: pts,
      metrics,
      score: computeScore(metrics),
      riskGrade: riskGradeOf(metrics.mddPct),
      asOf,
      open,
      closed,
      wallets,
    } satisfies PolyResult;
  }

  if (cfg.kind === "weather-arb") {
    const sim = simulateWeather(cfg, asOf);
    const { pts, factor } = rebase(sim.curve, startIdx, capital);
    const inWin = sim.positions.filter((p) => (p.resolvedAt ?? asOf) >= from);
    const scaled = inWin.map<WeatherPosition>((p) => ({
      id: p.id,
      ticker: p.ticker,
      question: p.question,
      city: p.city,
      date: p.date,
      bracketLo: p.bracketLo,
      bracketHi: p.bracketHi,
      side: p.side,
      entryPrice: p.entryPrice,
      forecastTemp: p.forecastTemp,
      modelProb: p.modelProb,
      edge: p.edge,
      betUsd: scale(p.betUsd, factor),
      shares: scale(p.shares, factor),
      openedAt: p.openedAt,
      resolvedAt: p.resolvedAt,
      status: p.status,
      actualTemp: p.actualTemp,
      pnl: scale(p.pnl, factor),
      verdict: p.verdict,
      rejectReason: p.rejectReason,
      riskScoreBps: p.riskScoreBps,
    }));
    const pending = scaled.filter((p) => p.status === "pending").sort((a, b) => b.openedAt - a.openedAt);
    const resolved = scaled
      .filter((p) => p.status !== "pending" && p.verdict === "VERIFIED")
      .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
    const rejected = scaled.filter((p) => p.verdict === "REJECTED");
    const pnlPcts = resolved.map((p) => (p.betUsd > 0 ? (p.pnl / p.betUsd) * 100 : 0));
    const holds = resolved.map((p) => ((p.resolvedAt ?? asOf) - p.openedAt) / HOUR);
    const eq = pts.map((p) => p.equity);
    const metrics = computeMetrics({
      capital,
      equityCurve: eq,
      tradePnlPcts: pnlPcts,
      holdHoursList: holds,
      buys: resolved.length + pending.length,
      sells: resolved.length,
      rejected: rejected.length,
      from,
      to: asOf,
      exposureCount: Math.round(eq.length * 0.78),
      openPosition: pending.length > 0,
      candlesPerDay: 24,
    });
    const cityMap = new Map<string, { city: string; trades: number; wins: number; pnl: number }>();
    for (const p of resolved) {
      const c = cityMap.get(p.city) ?? { city: p.city, trades: 0, wins: 0, pnl: 0 };
      c.trades += 1;
      if (p.status === "win") c.wins += 1;
      c.pnl = Math.round((c.pnl + p.pnl) * 100) / 100;
      cityMap.set(p.city, c);
    }
    return {
      kind: "weather-arb",
      agentId: cfg.agentId,
      window,
      venue: cfg.venue,
      strategy: cfg.strategy,
      capital,
      equityCurve: pts,
      metrics,
      score: computeScore(metrics),
      riskGrade: riskGradeOf(metrics.mddPct),
      asOf,
      pending,
      resolved: [...resolved, ...rejected].sort((a, b) => (b.resolvedAt ?? b.openedAt) - (a.resolvedAt ?? a.openedAt)),
      cities: Array.from(cityMap.values()).sort((a, b) => b.pnl - a.pnl),
    } satisfies WeatherResult;
  }

  // stocks
  const sim = simulateStocks(cfg, asOf);
  const { pts, factor } = rebase(sim.curve, startIdx, capital);
  const benchBase = sim.bench[startIdx] || 1;
  const benchCurve = Array.from(sim.bench.slice(startIdx)).map((v) => Math.round((capital * v) / benchBase * 100) / 100);
  const trades = sim.trades
    .filter((t) => t.t >= from)
    .map<StockTrade>((t) => ({
      ...t,
      shares: scale(t.shares, factor),
      notional: scale(t.notional, factor),
      pnl: t.pnl === null ? null : scale(t.pnl, factor),
      equityAfter: scale(t.equityAfter, factor),
    }))
    .sort((a, b) => b.t - a.t);
  const lastIdx = sim.curve.length - 1;
  const totalEq = sim.curve[lastIdx]?.equity ?? CAPITAL;
  const holdings = sim.holdings.map<StockHolding>((p) => {
    const px = sim.paths.get(p.ticker.sym)![lastIdx];
    const value = p.shares * px;
    return {
      ticker: p.ticker.sym,
      sector: p.ticker.sector,
      shares: scale(p.shares, factor),
      entryPrice: Math.round(p.entryPrice * 100) / 100,
      currentPrice: Math.round(px * 100) / 100,
      openedAt: ORIGIN + p.openH * HOUR,
      unrealizedPnl: scale(p.shares * (px - p.entryPrice), factor),
      unrealizedPct: Math.round((px / p.entryPrice - 1) * 10000) / 100,
      weightPct: Math.round((value / totalEq) * 1000) / 10,
    };
  });
  const sells = trades.filter((t) => t.side === "SELL" && t.verdict === "VERIFIED");
  const eq = pts.map((p) => p.equity);
  // 노출: 창 안에서 포지션이 있던 시간 — 거래 기록으로 근사(보유 종목이 있으면 노출)
  let exposureCount = 0;
  {
    let openCount = sim.holdings.length;
    // 거슬러 올라가며 보유 여부 추적
    const evs = sim.trades.filter((t) => t.verdict === "VERIFIED").sort((a, b) => b.t - a.t);
    let ei = 0;
    for (let i = sim.curve.length - 1; i >= startIdx; i--) {
      const t = sim.curve[i].t;
      while (ei < evs.length && evs[ei].t > t) {
        if (evs[ei].side === "BUY") openCount -= 1;
        else openCount += 1;
        ei++;
      }
      if (openCount > 0) exposureCount += 1;
    }
  }
  const metrics = computeMetrics({
    capital,
    equityCurve: eq,
    holdCurve: benchCurve,
    tradePnlPcts: sells.map((t) => t.pnlPct ?? 0),
    holdHoursList: sells.map((t) => (t.holdDays ?? 0) * 24),
    buys: trades.filter((t) => t.side === "BUY" && t.verdict === "VERIFIED").length,
    sells: sells.length,
    rejected: trades.filter((t) => t.verdict === "REJECTED").length,
    from,
    to: asOf,
    exposureCount,
    openPosition: holdings.length > 0,
    candlesPerDay: 24,
  });
  const sectorMap = new Map<string, number>();
  for (const hld of holdings) sectorMap.set(hld.sector, (sectorMap.get(hld.sector) ?? 0) + hld.weightPct);
  const invested = holdings.reduce((s, h) => s + h.weightPct, 0);
  return {
    kind: "stocks",
    agentId: cfg.agentId,
    window,
    venue: cfg.venue,
    strategy: cfg.strategy,
    capital,
    equityCurve: pts,
    metrics,
    score: computeScore(metrics),
    riskGrade: riskGradeOf(metrics.mddPct),
    asOf,
    holdings: holdings.sort((a, b) => b.weightPct - a.weightPct),
    trades,
    benchCurve,
    benchLabel: "SPY",
    sectorExposure: Array.from(sectorMap.entries())
      .map(([sector, weightPct]) => ({ sector, weightPct: Math.round(weightPct * 10) / 10 }))
      .sort((a, b) => b.weightPct - a.weightPct),
    cashPct: Math.round((100 - invested) * 10) / 10,
  } satisfies StocksResult;
}

export function summarizeAlt(r: AltResult) {
  return r;
}

/** Rng 타입 재노출 (테스트 편의) */
export type { Rng };
