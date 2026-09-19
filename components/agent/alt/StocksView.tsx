"use client";

// 미국 주식 상세 — 포지션은 "종목 · 주수 · 평단". 정규장(09:30~16:00 ET)에만 곡선이 움직이고
// 주말·야간은 차트에 음영으로 표시된다. SPY 벤치마크 점선과 비교.
// (1) 보유 종목 테이블  (2) 섹터 노출  (3) 체결 로그(BUY/SELL · 보유일 · 사유)

import { useState } from "react";
import type { StocksResult } from "@/lib/altstrat/types";
import { Pnl, usd } from "@/components/agent/primitives";
import { AltEquityChart, type ChartMarker } from "@/components/agent/alt/AltEquityChart";

function fmtT(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const TRADING_HOURS_UTC = new Set([14, 15, 16, 17, 18, 19, 20]);
function offHours(t: number): boolean {
  const d = new Date(t);
  const wd = d.getUTCDay();
  return !(wd >= 1 && wd <= 5 && TRADING_HOURS_UTC.has(d.getUTCHours()));
}

export function StocksView({ r, accent }: { r: StocksResult; accent: string }) {
  const [showRejected, setShowRejected] = useState(false);
  const markers: ChartMarker[] = r.trades
    .filter((t) => t.verdict === "VERIFIED")
    .slice(0, 120)
    .map((t) => ({
      t: t.t,
      kind: t.side === "BUY" ? "in" : t.pnl !== null && t.pnl >= 0 ? "win" : "loss",
      label: `${t.side} ${t.ticker} @ $${t.price}${t.pnl !== null ? ` · ${t.pnl >= 0 ? "+" : "−"}${usd(Math.abs(t.pnl))}` : ""}`,
    }));
  const log = r.trades.filter((t) => showRejected || t.verdict === "VERIFIED");
  const unreal = r.holdings.reduce((s, h) => s + h.unrealizedPnl, 0);
  const investedPct = Math.round((100 - r.cashPct) * 10) / 10;
  const beat = r.metrics.roiPct - r.metrics.holdRoiPct;

  return (
    <>
      <div className="ag-chart-wrap">
        <div className="ag-chart-legend">
          <span>
            <i style={{ background: accent }} /> 내 자산
          </span>
          <span>
            <i className="dash" /> {r.benchLabel} 그냥 들고있기
          </span>
          <span>
            <i className="area" /> 장외 시간(움직임 없음)
          </span>
          <span className="buy">▲ 매수</span>
          <span className="sell">● 매도</span>
        </div>
        <AltEquityChart
          curve={r.equityCurve}
          capital={r.capital}
          accent={accent}
          bench={r.benchCurve}
          benchLabel={r.benchLabel}
          markers={markers}
          height={300}
          flatHours={offHours}
        />
        <div className="stk-vs num">
          <span>
            {r.benchLabel} 대비 <Pnl pct={beat} d={2} />
            <small className="mut"> ({beat >= 0 ? "초과" : "미달"} 수익)</small>
          </span>
          <span className="mut">정규장 09:30–16:00 ET에만 체결 · 야간·주말엔 시가평가도 멈춤</span>
        </div>
      </div>

      <div className="ag-two">
        <section className="ag-card stk-holdings">
          <header>
            <h3>
              보유 종목 <span className="num mut">{r.holdings.length}</span>
            </h3>
            <b className={`num ag-card-head ${unreal >= 0 ? "up" : "dn"}`}>
              미실현 {unreal >= 0 ? "+" : "−"}
              {usd(Math.abs(unreal))}
            </b>
          </header>
          {r.holdings.length === 0 ? (
            <p className="alt-empty">지금은 전액 현금이에요. 다음 정규장에서 신호가 나면 진입합니다.</p>
          ) : (
            <div className="alt-table stk-table">
              <div className="alt-thead" role="row">
                <span>종목</span>
                <span>주수</span>
                <span>평단 → 현재</span>
                <span>비중</span>
                <span>평가손익</span>
              </div>
              <div className="alt-tbody">
                {r.holdings.map((h) => (
                  <div className="alt-row" role="row" key={h.ticker}>
                    <span className="alt-q">
                      <b>{h.ticker}</b>
                      <small>
                        {h.sector} · {fmtT(h.openedAt)} 진입
                      </small>
                    </span>
                    <span className="num">{h.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className="num">
                      ${h.entryPrice.toFixed(2)} → <b>${h.currentPrice.toFixed(2)}</b>
                    </span>
                    <span className="num">{h.weightPct}%</span>
                    <span className={`num ${h.unrealizedPnl >= 0 ? "up" : "dn"}`}>
                      {h.unrealizedPnl >= 0 ? "+" : "−"}
                      {usd(Math.abs(h.unrealizedPnl))} <small>({h.unrealizedPct >= 0 ? "+" : ""}{h.unrealizedPct.toFixed(2)}%)</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="ag-card">
          <header>
            <h3>노출</h3>
            <span className="num ag-card-head">
              투자 {investedPct}% · 현금 {r.cashPct}%
            </span>
          </header>
          <div className="stk-expo">
            <div className="stk-expo-bar">
              {r.sectorExposure.map((s, i) => (
                <i key={s.sector} style={{ width: `${s.weightPct}%`, background: accent, opacity: 1 - i * 0.18 }} title={`${s.sector} ${s.weightPct}%`} />
              ))}
              <i className="cash" style={{ width: `${r.cashPct}%` }} title={`현금 ${r.cashPct}%`} />
            </div>
            <div className="stk-expo-list">
              {r.sectorExposure.map((s, i) => (
                <span key={s.sector} className="num">
                  <i style={{ background: accent, opacity: 1 - i * 0.18 }} /> {s.sector} <b>{s.weightPct}%</b>
                </span>
              ))}
              <span className="num">
                <i className="cash" /> 현금 <b>{r.cashPct}%</b>
              </span>
            </div>
          </div>
          <div className="ag-mrow">
            <span className="k">1회 진입 비중</span>
            <span className="v num">{r.strategy === "etf-rotation" ? "자본의 45% × 2" : "자본의 30% × 최대 3"}</span>
          </div>
          <div className="ag-mrow">
            <span className="k">청산 규칙</span>
            <span className="v">{r.strategy === "etf-rotation" ? "매주 월요일 개장 로테이션" : "트레일링 −4.5% · 12거래일 · 모멘텀 소멸"}</span>
          </div>
          <div className="ag-mrow">
            <span className="k">수수료</span>
            <span className="v num">0.05% / 체결</span>
          </div>
        </section>
      </div>

      <section className="alt-sec">
        <header className="alt-sec-head">
          <h3>
            체결 로그{" "}
            <span className="num">
              {r.trades.filter((t) => t.verdict === "VERIFIED").length}건 · 거부 {r.trades.filter((t) => t.verdict === "REJECTED").length}
            </span>
          </h3>
          <label className="ag-switch">
            <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
            <span>거부된 판단도 보기</span>
          </label>
        </header>
        <div className="alt-table stk-log">
          <div className="alt-thead" role="row">
            <span>시각</span>
            <span>판단</span>
            <span>종목</span>
            <span>가격 · 주수</span>
            <span>금액</span>
            <span>손익 · 보유</span>
            <span>잔고</span>
          </div>
          <div className="alt-tbody">
            {log.slice(0, 80).map((t) => (
              <div className={`alt-row${t.verdict === "REJECTED" ? " rejected" : ""}`} role="row" key={t.id}>
                <span className="num mut">{fmtT(t.t)}</span>
                <span>
                  <span className={`alt-side ${t.side === "BUY" ? "yes" : "no"}`}>{t.side === "BUY" ? "매수" : "매도"}</span>
                  {t.verdict === "REJECTED" && <span className="alt-status reject" style={{ marginLeft: 6 }}>REJECTED</span>}
                </span>
                <span className="alt-q">
                  <b>{t.ticker}</b>
                  <small>{t.rejectReason ? `${t.reason} · ${t.rejectReason}` : t.reason}</small>
                </span>
                <span className="num">
                  ${t.price.toFixed(2)} <small className="mut">× {t.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</small>
                </span>
                <span className="num">{t.notional ? usd(t.notional) : "—"}</span>
                <span className={`num ${t.pnl === null ? "mut" : t.pnl >= 0 ? "up" : "dn"}`}>
                  {t.pnl === null ? "—" : `${t.pnl >= 0 ? "+" : "−"}${usd(Math.abs(t.pnl))}`}
                  {t.holdDays !== null && <small className="mut"> · {t.holdDays}일</small>}
                </span>
                <span className="num">{usd(t.equityAfter)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
