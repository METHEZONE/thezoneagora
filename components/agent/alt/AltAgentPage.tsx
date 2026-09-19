"use client";

// 크립토 외 에이전트(예측시장 카피 · 날씨 아비트리지 · 미국 주식) 전용 상세 페이지.
// 헤더/점수/순위/지표 카드는 크립토 상세와 같은 그릇을 쓰고, 포지션 영역만 종류별 뷰로 갈아 끼운다.

import Link from "next/link";
import { useMemo, useState } from "react";
import { AgentCharacter, characterFor, useCharacterBlink } from "@/components/arena/characters";
import { useAnyBacktest, useReplayBoard } from "@/lib/backtest/client";
import { WINDOWS, type BacktestWindow } from "@/lib/backtest/klines";
import type { AltAgentConfig, AltResult } from "@/lib/altstrat/types";
import { AGENTS } from "@/lib/data/seed/seasons";
import {
  AGENT_NAME,
  STRATEGY_LABEL,
  STRATEGY_ONELINER,
  WINDOW_LABEL,
  WINDOW_SHORT,
  riskSentence,
  symbolLabel,
} from "@/components/agent/meta";
import { HeroBadges } from "@/components/agent/HeroBadges";
import { MetricCards } from "@/components/agent/MetricCards";
import { Pnl, RiskBadge, ScoreBreakdownInline, ScoreRing, usd } from "@/components/agent/primitives";
import { PolyView } from "@/components/agent/alt/PolyView";
import { WeatherView } from "@/components/agent/alt/WeatherView";
import { StocksView } from "@/components/agent/alt/StocksView";
import { DemoDepositButton } from "@/components/vault/DemoDepositButton";

const PRESETS = [1_000, 10_000, 50_000];

const KIND_HOW: Record<AltResult["kind"], { k: string; v: string }[]> = {
  "polymarket-copy": [
    { k: "무대", v: "Polymarket · USDC 정산" },
    { k: "포지션 단위", v: "YES/NO 지분 @ 확률가(0~1)" },
    { k: "손익", v: "지분 × (정산가 − 진입가) · 정산가는 0 또는 1" },
    { k: "판단 검증", v: "50:50 근처·유동성 얕은 마켓은 위험도 상한에서 거부" },
  ],
  "weather-arb": [
    { k: "무대", v: "Kalshi · 도시별 최고기온 브래킷" },
    { k: "포지션 단위", v: "브래킷 YES/NO @ 호가 · 소액 고정($15~45)" },
    { k: "진입 조건", v: "모델 확률 − 호가 ≥ 8%p" },
    { k: "판단 검증", v: "엣지가 과대(호가 신뢰도 낮음)하면 거부" },
  ],
  stocks: [
    { k: "무대", v: "미국 정규장 09:30–16:00 ET" },
    { k: "포지션 단위", v: "종목 주수 · 롱 온리" },
    { k: "손익", v: "주수 × (매도가 − 평단) − 수수료 0.05%" },
    { k: "판단 검증", v: "변동성 급등 시 위험도 상한에서 거부" },
  ],
};

export function AltAgentPage({ cfg }: { cfg: AltAgentConfig }) {
  useCharacterBlink();
  const agentId = cfg.agentId;
  const seed = AGENTS.find((a) => a.id === agentId);
  const accent = characterFor(agentId).accent;
  const [window, setWindow] = useState<BacktestWindow>("30d");
  const [capital, setCapital] = useState(10_000);
  const bt = useAnyBacktest(agentId, window, capital);
  const board = useReplayBoard(window);
  const name = AGENT_NAME[agentId] ?? agentId.toUpperCase();

  const rank = useMemo(() => {
    if (!board.data) return null;
    const sorted = [...board.data.agents].sort((a, b) => b.score.total - a.score.total);
    const i = sorted.findIndex((a) => a.agentId === agentId);
    return i >= 0 ? i + 1 : null;
  }, [board.data, agentId]);

  const r = bt.data && bt.data.kind !== "crypto" ? (bt.data as AltResult) : null;
  const m = r?.metrics;

  return (
    <div className="ag-page">
      <div className="wrap">
        <nav className="ag-crumb">
          <Link href="/">아레나</Link>
          <span>/</span>
          <span>{name}</span>
        </nav>

        <header className="ag-hero">
          <div className="ag-hero-char">
            <AgentCharacter agentId={agentId} size={120} label={name} />
          </div>
          <div className="ag-hero-main">
            <div className="ag-hero-title">
              <h1>{name}</h1>
            </div>
            <HeroBadges
              kind={cfg.kind}
              strategyLabel={STRATEGY_LABEL[cfg.strategy] ?? cfg.strategy}
              accent={accent}
              sourceLabel={`${symbolLabel(cfg.venue)} · 페이퍼 시뮬레이션`}
            />
            <p className="ag-hero-oneliner">{STRATEGY_ONELINER[cfg.strategy]}</p>
            {seed?.tagline && <p className="ag-hero-tag">{seed.tagline}</p>}
            <div className="ag-hero-ctas">
              <Link href={`/vault/onboarding?strategy=${agentId}&amount=10000`} className="btn primary">
                {name}에게 맡기기 →
              </Link>
              <DemoDepositButton strategyId={agentId} amountUsdc={10_000} className="btn ghost" label="데모 자금으로 예치 (Sui 없이)" />
            </div>
          </div>
          <div className="ag-hero-side">
            {r ? (
              <>
                <ScoreRing score={r.score} color={accent} size={84} showBreakdown={false} />
                <div className="ag-hero-rank num">
                  <b>#{rank ?? "–"}</b>
                  <small>AGORA 점수 기준 · {WINDOW_LABEL[window]} · 10명 중</small>
                </div>
              </>
            ) : (
              <div className="ag-skel-ring" />
            )}
          </div>
        </header>

        <section className="ag-record">
          <div className="ag-record-head">
            <div>
              <div className="ag-bt-eyebrow">
                {usd(capital)} 넣었으면 · 최근 {WINDOW_LABEL[window]}
              </div>
              {m ? (
                <div className="ag-bt-money num">
                  <span className="from">{usd(m.capital)}</span>
                  <span className="arrow">→</span>
                  <span className={`to ${m.pnl >= 0 ? "up" : "dn"}`}>{usd(m.finalEquity)}</span>
                  <Pnl pct={m.roiPct} d={2} className="ag-bt-roi" />
                </div>
              ) : (
                <div className="ag-skel-line" />
              )}
              {m && r && (
                <div className="ag-record-risk">
                  <RiskBadge grade={r.riskGrade} mddPct={m.mddPct} />
                  <span>{riskSentence(m.mddPct, WINDOW_LABEL[window])}</span>
                </div>
              )}
            </div>
            <div className="alt-controls">
              <div className="ag-seg" role="group" aria-label="금액">
                {PRESETS.map((c) => (
                  <button key={c} type="button" className={`ag-seg-btn num${capital === c ? " on" : ""}`} onClick={() => setCapital(c)}>
                    {usd(c)}
                  </button>
                ))}
              </div>
              <div className="ag-seg" role="group" aria-label="기간">
                {WINDOWS.map((w) => (
                  <button key={w} type="button" className={`ag-seg-btn num${window === w ? " on" : ""}`} onClick={() => setWindow(w)} title={WINDOW_LABEL[w]}>
                    {WINDOW_SHORT[w]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {bt.error && <div className="ag-error">데이터를 불러오지 못했어요 — {bt.error}</div>}
          {bt.loading && !r && <div className="ag-skel-line" style={{ width: "100%", height: 300 }} />}

          {r && (
            <>
              {r.kind === "polymarket-copy" && <PolyView r={r} accent={accent} />}
              {r.kind === "weather-arb" && <WeatherView r={r} accent={accent} />}
              {r.kind === "stocks" && <StocksView r={r} accent={accent} />}

              <MetricCards m={r.metrics} grade={r.riskGrade} windowLabel={WINDOW_LABEL[window]} kind={r.kind} />

              <div className="ag-two">
                <section className="ag-card">
                  <header>
                    <h3>AGORA 점수 분해</h3>
                    <b className="num ag-card-head">{r.score.total} / 100</b>
                  </header>
                  <ScoreBreakdownInline score={r.score} color={accent} />
                  <p className="ag-bd-note">수익률 30 · 위험조정 30 · 일관성 20 · 최근추세 20. 크립토·예측시장·날씨·주식 10명 모두 같은 공식.</p>
                </section>
                <section className="ag-card">
                  <header>
                    <h3>이 에이전트는 어떻게 움직이나</h3>
                  </header>
                  <p className="ag-card-sentence">{STRATEGY_ONELINER[cfg.strategy]}</p>
                  {KIND_HOW[r.kind].map((row) => (
                    <div className="ag-mrow" key={row.k}>
                      <span className="k">{row.k}</span>
                      <span className="v">{row.v}</span>
                    </div>
                  ))}
                  <div className="ag-mrow">
                    <span className="k">실행</span>
                    <span className="v">Sui Testnet 비수탁 볼트 · 출금 권한 없음</span>
                  </div>
                  <div className="ag-mrow">
                    <span className="k">데이터</span>
                    <span className="v">결정론적 페이퍼 시뮬레이션 · 누가 봐도 같은 숫자 · 실데이터 연동 준비 중</span>
                  </div>
                </section>
              </div>

              <div className="ag-sticky">
                <div className="ag-sticky-txt num">
                  <span>
                    {name}에게 {usd(capital)} 맡겼다면 →
                  </span>
                  <b className={m!.pnl >= 0 ? "up" : "dn"}>{usd(m!.finalEquity)}</b>
                  <Pnl pct={m!.roiPct} d={1} />
                </div>
                <span className="ag-sticky-ctas">
                  <DemoDepositButton strategyId={agentId} amountUsdc={capital} className="btn ghost" label="데모로 예치" />
                  <Link href={`/vault/onboarding?strategy=${agentId}&amount=${capital}`} className="btn primary">
                    지금 맡기기 →
                  </Link>
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
