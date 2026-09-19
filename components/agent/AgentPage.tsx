"use client";

// 에이전트 전용 페이지 — Polyfox 트레이더 상세를 Agora 감도로.
// 헤더(캐릭터·점수·순위·CTA 2개) / 차트 기간탭 / 3카드 / 탭(전적·백테스트) / 스티키 바.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AgentCharacter, characterFor, useCharacterBlink } from "@/components/arena/characters";
import { useBacktest, useReplayBoard } from "@/lib/backtest/client";
import { WINDOWS, type BacktestWindow } from "@/lib/backtest/klines";
import { configFor } from "@/lib/backtest/engine";
import { altConfigFor } from "@/lib/altstrat/configs";
import { AltAgentPage } from "@/components/agent/alt/AltAgentPage";
import { MintArchivePage } from "@/components/agent/MintArchivePage";
import { DemoDepositButton } from "@/components/vault/DemoDepositButton";
import { AGENTS } from "@/lib/data/seed/seasons";
import {
  AGENT_NAME,
  STRATEGY_LABEL,
  STRATEGY_ONELINER,
  SYMBOL_LABEL,
  WINDOW_LABEL,
  WINDOW_SHORT,
  riskSentence,
} from "@/components/agent/meta";
import { PriceEquityChart } from "@/components/agent/PriceEquityChart";
import { MetricCards } from "@/components/agent/MetricCards";
import { TradeLog } from "@/components/agent/TradeLog";
import { BacktestPanel } from "@/components/agent/BacktestPanel";
import { Pnl, RiskBadge, ScoreBreakdownInline, ScoreRing, usd } from "@/components/agent/primitives";

type Tab = "record" | "backtest";

export function AgentPage({ agentId, initialTab = "record" }: { agentId: string; initialTab?: Tab }) {
  const alt = altConfigFor(agentId);
  if (alt) return <AltAgentPage cfg={alt} />;
  // MINT는 리플레이가 아니라 실제 MK2 아카이브 — 전용 페이지.
  if (agentId === "mint") return <MintArchivePage />;
  return <CryptoAgentPage agentId={agentId} initialTab={initialTab} />;
}

function CryptoAgentPage({ agentId, initialTab = "record" }: { agentId: string; initialTab?: Tab }) {
  useCharacterBlink();
  const cfg = configFor(agentId);
  const seed = AGENTS.find((a) => a.id === agentId);
  const accent = characterFor(agentId).accent;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [window, setWindow] = useState<BacktestWindow>("30d");
  const [showRejected, setShowRejected] = useState(false);
  const bt = useBacktest(cfg ? agentId : null, window, 10_000);
  const board = useReplayBoard(window);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const rank = useMemo(() => {
    if (!board.data) return null;
    const sorted = [...board.data.agents].sort((a, b) => b.score.total - a.score.total);
    const i = sorted.findIndex((a) => a.agentId === agentId);
    return i >= 0 ? i + 1 : null;
  }, [board.data, agentId]);

  if (!cfg) {
    return (
      <div className="ag-page wrap">
        <div className="ag-error">알 수 없는 에이전트입니다: {agentId}</div>
        <Link href="/" className="btn ghost">
          ← 아레나로
        </Link>
      </div>
    );
  }

  const name = AGENT_NAME[agentId];
  const r = bt.data;
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
              <span className="ag-chip" style={{ "--c": accent } as React.CSSProperties}>
                {STRATEGY_LABEL[cfg.strategy]}
              </span>
              <span className="ag-sym num">{SYMBOL_LABEL[cfg.symbol]} 실시간 시세 · 페이퍼 트레이딩</span>
            </div>
            <p className="ag-hero-oneliner">{STRATEGY_ONELINER[cfg.strategy]}</p>
            {seed?.tagline && <p className="ag-hero-tag">{seed.tagline}</p>}
            <div className="ag-hero-ctas">
              <Link href={`/vault/onboarding?strategy=${agentId}&amount=10000`} className="btn primary">
                {name}에게 맡기기 →
              </Link>
              <button type="button" className="btn ghost" onClick={() => setTab("backtest")}>
                백테스트 해보기
              </button>
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

        <div className="ag-tabs ag-tabs-page" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "record"} className={`ag-tab${tab === "record" ? " on" : ""}`} onClick={() => setTab("record")}>
            전적
          </button>
          <button type="button" role="tab" aria-selected={tab === "backtest"} className={`ag-tab${tab === "backtest" ? " on" : ""}`} onClick={() => setTab("backtest")}>
            백테스트
          </button>
        </div>

        {tab === "record" && (
          <section className="ag-record">
            <div className="ag-record-head">
              <div>
                <div className="ag-bt-eyebrow">$10,000 넣었으면 · 최근 {WINDOW_LABEL[window]}</div>
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
              <div className="ag-seg">
                {WINDOWS.map((w) => (
                  <button key={w} type="button" className={`ag-seg-btn num${window === w ? " on" : ""}`} onClick={() => setWindow(w)} title={WINDOW_LABEL[w]}>
                    {WINDOW_SHORT[w]}
                  </button>
                ))}
              </div>
            </div>

            {bt.error && <div className="ag-error">데이터를 불러오지 못했어요 — {bt.error}</div>}
            {r && (
              <>
                <div className="ag-chart-wrap">
                  <div className="ag-chart-legend">
                    <span>
                      <i style={{ background: accent }} /> 내 자산
                    </span>
                    <span>
                      <i className="dash" /> 그냥 들고있기
                    </span>
                    <span>
                      <i className="area" /> {SYMBOL_LABEL[r.symbol]} 가격
                    </span>
                    <span className="buy">▲ 매수</span>
                    <span className="sell">▼ 매도</span>
                  </div>
                  <PriceEquityChart result={r} accent={accent} showRejected={showRejected} height={320} />
                </div>

                <MetricCards m={r.metrics} grade={r.riskGrade} windowLabel={WINDOW_LABEL[window]} />

                <div className="ag-two">
                  <section className="ag-card">
                    <header>
                      <h3>AGORA 점수 분해</h3>
                      <b className="num ag-card-head">{r.score.total} / 100</b>
                    </header>
                    <ScoreBreakdownInline score={r.score} color={accent} />
                    <p className="ag-bd-note">수익률 30 · 위험조정 30 · 일관성 20 · 최근추세 20. 10명 모두 같은 공식.</p>
                  </section>
                  <section className="ag-card">
                    <header>
                      <h3>이 에이전트는 어떻게 움직이나</h3>
                    </header>
                    <p className="ag-card-sentence">{STRATEGY_ONELINER[cfg.strategy]}</p>
                    <div className="ag-mrow">
                      <span className="k">추종 시세</span>
                      <span className="v num">{cfg.symbol} · Binance</span>
                    </div>
                    <div className="ag-mrow">
                      <span className="k">1회 진입 비중</span>
                      <span className="v num">자본의 {Math.round({ momentum: 50, contrarian: 50, grid: 40, breakout: 50, "stable-arb": 20 }[cfg.strategy])}%</span>
                    </div>
                    <div className="ag-mrow">
                      <span className="k">판단 검증</span>
                      <span className="v">위험도 상한 · 가격 편차 임계치</span>
                    </div>
                    <div className="ag-mrow">
                      <span className="k">실행</span>
                      <span className="v">Sui Testnet 비수탁 볼트 · 출금 권한 없음</span>
                    </div>
                  </section>
                </div>

                <TradeLog
                  trades={r.trades}
                  symbol={SYMBOL_LABEL[r.symbol]}
                  showRejected={showRejected}
                  onToggleRejected={setShowRejected}
                />

                <div className="ag-sticky">
                  <div className="ag-sticky-txt num">
                    <span>{name}에게 $10,000 맡겼다면 →</span>
                    <b className={m!.pnl >= 0 ? "up" : "dn"}>{usd(m!.finalEquity)}</b>
                    <Pnl pct={m!.roiPct} d={1} />
                  </div>
                  <span className="ag-sticky-ctas">
                    <button type="button" className="btn ghost" onClick={() => setTab("backtest")}>
                      내 금액으로 백테스트
                    </button>
                    <Link href={`/vault/onboarding?strategy=${agentId}&amount=10000`} className="btn primary">
                      지금 맡기기 →
                    </Link>
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "backtest" && <BacktestPanel agentId={agentId} accent={accent} initialWindow={window} />}
      </div>
    </div>
  );
}
