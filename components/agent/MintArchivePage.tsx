"use client";

// MINT 전용 상세 — 실제 MK2 엔진 아카이브. 리플레이/시뮬레이션이 아니라 "실제로 이렇게 돌았다".
// 헤더/점수/지표는 다른 에이전트와 같은 그릇, 본문은 (1) 일별 실기록 곡선 (2) 서브전략 10개 (3) 최근 체결.

import Link from "next/link";
import { useMemo, useState } from "react";
import { AgentCharacter, characterFor, useCharacterBlink } from "@/components/arena/characters";
import { useAnyBacktest, useReplayBoard } from "@/lib/backtest/client";
import { WINDOWS, type BacktestWindow } from "@/lib/backtest/klines";
import { isMintArchive, type MintArchiveResult } from "@/lib/backtest/mintArchive";
import { AGENTS } from "@/lib/data/seed/seasons";
import { AGENT_NAME, STRATEGY_LABEL, STRATEGY_ONELINER, WINDOW_LABEL, WINDOW_SHORT, riskSentence } from "@/components/agent/meta";
import { HeroBadges } from "@/components/agent/HeroBadges";
import { MetricCards } from "@/components/agent/MetricCards";
import { Pnl, RiskBadge, ScoreBreakdownInline, ScoreRing, usd } from "@/components/agent/primitives";
import { AltEquityChart } from "@/components/agent/alt/AltEquityChart";
import { DemoDepositButton } from "@/components/vault/DemoDepositButton";

const PRESETS = [1_000, 10_000, 50_000];
const ASSET_COLORS: Record<string, string> = { ETH: "#627EEA", BTC: "#F7931A", XRP: "#00AAE4", DOGE: "#C2A633" };

function fmtT(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, ".");
}

export function MintArchivePage() {
  useCharacterBlink();
  const agentId = "mint";
  const seed = AGENTS.find((a) => a.id === agentId);
  const accent = characterFor(agentId).accent;
  const [window, setWindow] = useState<BacktestWindow>("30d");
  const [capital, setCapital] = useState(10_000);
  const bt = useAnyBacktest(agentId, window, capital);
  const board = useReplayBoard(window);
  const name = AGENT_NAME[agentId];

  const rank = useMemo(() => {
    if (!board.data) return null;
    const sorted = [...board.data.agents].sort((a, b) => b.score.total - a.score.total);
    const i = sorted.findIndex((a) => a.agentId === agentId);
    return i >= 0 ? i + 1 : null;
  }, [board.data]);

  const r: MintArchiveResult | null = bt.data && isMintArchive(bt.data) ? bt.data : null;
  const m = r?.metrics;
  const bestStrat = r?.strategies[0];
  const maxRoi = r ? Math.max(...r.strategies.map((s) => Math.abs(s.seasonRoiPct)), 1) : 1;

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
              kind="crypto"
              strategyLabel={STRATEGY_LABEL["mk2-portfolio"]}
              accent={accent}
              sourceLabel="OKX 실기록 아카이브"
              real
            />
            <p className="ag-hero-oneliner">{STRATEGY_ONELINER["mk2-portfolio"]}</p>
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
                {usd(capital)} 넣었으면 · 최근 {WINDOW_LABEL[window]} · 실기록
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

          {r && (
            <>
              <div className="ag-chart-wrap">
                <div className="ag-chart-legend">
                  <span>
                    <i style={{ background: accent }} /> 실제 자산 (일별 · 서브전략 10개 균등가중 합산)
                  </span>
                  <span className="mut num">
                    아카이브 {ymd(r.archiveFrom)} ~ {ymd(r.archiveTo)} · {r.totalDays}일 · 체결 {r.totalTrades.toLocaleString()}건
                  </span>
                </div>
                <AltEquityChart curve={r.equityCurve} capital={r.capital} accent={accent} height={300} />
                {r.equityCurve.length <= 3 && (
                  <p className="ag-bd-note">아카이브는 일별 기록이라 {WINDOW_LABEL[window]} 창에는 점이 {r.equityCurve.length}개뿐이에요. 더 긴 창으로 보면 곡선이 나옵니다.</p>
                )}
              </div>

              <section className="alt-sec">
                <header className="alt-sec-head">
                  <h3>
                    서브전략 10개 · 시즌 누적 <span className="num">{bestStrat ? `1위 ${bestStrat.strategy}` : ""}</span>
                  </h3>
                  <span className="alt-sec-note">각 $10,000 시작 · 자산 × 타임프레임 · 시즌 시작(4/17) 이후 실기록</span>
                </header>
                <div className="alt-table mint-strats">
                  <div className="alt-thead" role="row">
                    <span>전략</span>
                    <span>시즌 ROI</span>
                    <span>현재 자산</span>
                    <span>체결 · 승률</span>
                  </div>
                  <div className="alt-tbody">
                    {r.strategies.map((s) => (
                      <div className="alt-row" role="row" key={s.strategy}>
                        <span className="alt-q">
                          <b>
                            <i className="mint-dot" style={{ background: ASSET_COLORS[s.asset] ?? accent }} /> {s.strategy}
                          </b>
                          <small>
                            {s.asset} · {s.tf} 봉
                          </small>
                        </span>
                        <span className="mint-roi">
                          <Pnl pct={s.seasonRoiPct} d={1} />
                          <i className="bar">
                            <b style={{ width: `${(Math.abs(s.seasonRoiPct) / maxRoi) * 100}%`, background: s.seasonRoiPct >= 0 ? "var(--pos)" : "var(--neg)" }} />
                          </i>
                        </span>
                        <span className="num">{usd(s.currentEquity)}</span>
                        <span className="num">
                          {s.season1Trades}건 · <b>{s.season1WinRate}%</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="alt-sec">
                <header className="alt-sec-head">
                  <h3>
                    최근 체결 <span className="num">{r.trades.length}건 · 이 창</span>
                  </h3>
                  <span className="alt-sec-note">아카이브에 남은 최근 40건 중 · 레버리지 포함 실현 손익</span>
                </header>
                {r.trades.length === 0 ? (
                  <p className="alt-empty">이 창 안에 남아 있는 체결 기록이 없어요(아카이브는 최근 40건만 보관). 더 긴 창으로 보세요.</p>
                ) : (
                  <div className="alt-table mint-log">
                    <div className="alt-thead" role="row">
                      <span>시각</span>
                      <span>전략</span>
                      <span>방향 · 레버리지</span>
                      <span>진입 → 청산</span>
                      <span>손익</span>
                      <span>서브전략 잔고</span>
                      <span>사유</span>
                    </div>
                    <div className="alt-tbody">
                      {r.trades.map((t, i) => (
                        <div className="alt-row" role="row" key={`${t.ts}-${i}`}>
                          <span className="num mut">{fmtT(t.ts)}</span>
                          <span className="alt-q">
                            <b>{t.strategy}</b>
                            <small>{t.action === "exit" ? "전량 청산" : "부분 청산"}</small>
                          </span>
                          <span>
                            <span className={`alt-side ${t.side === "long" ? "yes" : "no"}`}>{t.side.toUpperCase()}</span>{" "}
                            <small className="num mut">{t.leverage}x</small>
                          </span>
                          <span className="num">
                            {t.entry} → <b>{t.exit}</b>
                          </span>
                          <span className={`num ${t.pnl >= 0 ? "up" : "dn"}`}>
                            {t.pnl >= 0 ? "+" : "−"}
                            {usd(Math.abs(t.pnl))}
                          </span>
                          <span className="num">{usd(t.equity)}</span>
                          <span className="mut">{t.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <MetricCards m={r.metrics} grade={r.riskGrade} windowLabel={WINDOW_LABEL[window]} kind="polymarket-copy" />

              <div className="ag-two">
                <section className="ag-card">
                  <header>
                    <h3>AGORA 점수 분해</h3>
                    <b className="num ag-card-head">{r.score.total} / 100</b>
                  </header>
                  <ScoreBreakdownInline score={r.score} color={accent} />
                  <p className="ag-bd-note">수익률 30 · 위험조정 30 · 일관성 20 · 최근추세 20. 실기록도 시뮬레이션과 똑같은 공식으로 채점합니다.</p>
                </section>
                <section className="ag-card">
                  <header>
                    <h3>이 기록은 어디서 오나</h3>
                  </header>
                  <div className="ag-mrow">
                    <span className="k">엔진</span>
                    <span className="v">MK2 (Go) · NPD + Smoothed HA + BB(0.6σ) + StochRSI</span>
                  </div>
                  <div className="ag-mrow">
                    <span className="k">무대</span>
                    <span className="v">OKX 페이퍼 · 선물 · 레버리지 ~10x</span>
                  </div>
                  <div className="ag-mrow">
                    <span className="k">서브전략</span>
                    <span className="v">BTC/ETH/XRP/DOGE × 15m/30m (일부 다중) = 10개, 각 $10,000</span>
                  </div>
                  <div className="ag-mrow">
                    <span className="k">갱신</span>
                    <span className="v num">{new Date(r.generatedAt).toLocaleString("ko-KR")}</span>
                  </div>
                  <div className="ag-mrow">
                    <span className="k">주의</span>
                    <span className="v">페이퍼 트레이딩 실기록 — 실제 자금 아님. 레버리지 탓에 낙폭이 큽니다.</span>
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
