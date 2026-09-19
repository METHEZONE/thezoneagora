"use client";

// 날씨 아비트리지 상세 — Kalshi 기온 브래킷 마켓. 포지션 = "도시·날짜·브래킷·YES/NO @ 호가".
// (1) 대기 중인 베팅(정산 전) 카드: 예보 vs 브래킷, 모델 확률 vs 호가, 엣지
// (2) 도시별 성적
// (3) 정산 로그: 실제 기온이 브래킷에 들어갔는지
// (4) 실제 Kalshi 기록(2026-06까지 돌린 진짜 봇 아카이브) — 시뮬과 나란히 두고 과장하지 않는다.

import { useState } from "react";
import type { WeatherPosition, WeatherResult } from "@/lib/altstrat/types";
import { usd } from "@/components/agent/primitives";
import { AltEquityChart, type ChartMarker } from "@/components/agent/alt/AltEquityChart";
import mintReal from "@/lib/data/mint/mint-real-data.json";

const KALSHI_REAL = mintReal.kalshiSummary as {
  total_trades: number;
  wins: number;
  losses: number;
  pending: number;
  total_pnl: number;
  total_bet: number;
  roi_pct: number;
  win_rate: number;
  avg_edge_pct: number;
  last_updated: string;
};

function fmtT(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`;
}
const pct = (p: number) => `${Math.round(p * 100)}%`;

function SideTag({ side }: { side: "YES" | "NO" }) {
  return <span className={`alt-side ${side === "YES" ? "yes" : "no"}`}>{side}</span>;
}

function TempScale({ p }: { p: WeatherPosition }) {
  // 예보 ±10°F 범위 위에 브래킷과 예보(및 실제) 위치를 그린다.
  const lo = p.forecastTemp - 10;
  const hi = p.forecastTemp + 10;
  const x = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="wx-scale" aria-hidden>
      <i className="wx-bracket" style={{ left: x(p.bracketLo), width: `calc(${x(p.bracketHi + 1)} - ${x(p.bracketLo)})` }} />
      <i className="wx-forecast" style={{ left: x(p.forecastTemp) }} title={`예보 ${p.forecastTemp}°F`} />
      {p.actualTemp !== null && (
        <i className={`wx-actual ${p.status === "win" ? "win" : "loss"}`} style={{ left: x(p.actualTemp) }} title={`실제 ${p.actualTemp}°F`} />
      )}
      <span className="num l">{Math.round(lo)}°</span>
      <span className="num r">{Math.round(hi)}°</span>
    </div>
  );
}

export function WeatherView({ r, accent }: { r: WeatherResult; accent: string }) {
  const [showRejected, setShowRejected] = useState(false);
  const resolvedOnly = r.resolved.filter((p) => p.verdict === "VERIFIED");
  const rejected = r.resolved.filter((p) => p.verdict === "REJECTED");
  const markers: ChartMarker[] = resolvedOnly.slice(0, 120).map((p) => ({
    t: p.resolvedAt ?? p.openedAt,
    kind: p.status === "win" ? "win" : "loss",
    label: `${p.city} ${p.date} ${p.bracketLo}–${p.bracketHi}°F ${p.side} · ${p.status.toUpperCase()} ${p.pnl >= 0 ? "+" : "−"}${usd(Math.abs(p.pnl))}`,
  }));
  const log = r.resolved.filter((p) => showRejected || p.verdict === "VERIFIED");
  const pendingStake = r.pending.reduce((s, p) => s + p.betUsd, 0);
  const avgEdge = resolvedOnly.length ? resolvedOnly.reduce((s, p) => s + p.edge, 0) / resolvedOnly.length : 0;
  const nextScanKst = "23:00 KST (14:00 UTC)";

  return (
    <>
      <div className="ag-chart-wrap">
        <div className="ag-chart-legend">
          <span>
            <i style={{ background: accent }} /> 내 자산 (정산 전 베팅은 원가)
          </span>
          <span className="buy">● 정산 WIN</span>
          <span className="sell">● 정산 LOSS</span>
        </div>
        <AltEquityChart curve={r.equityCurve} capital={r.capital} accent={accent} markers={markers} height={300} />
      </div>

      <section className="alt-sec">
        <header className="alt-sec-head">
          <h3>
            정산 대기 베팅 <span className="num">{r.pending.length}건 · {usd(pendingStake)}</span>
          </h3>
          <span className="alt-sec-note">매일 {nextScanKst} 8개 도시 스캔 · 대상일 다음날 15:00 KST 정산</span>
        </header>
        {r.pending.length === 0 ? (
          <p className="alt-empty">지금은 정산 대기 중인 베팅이 없어요. 다음 스캔은 {nextScanKst}. 아래 정산 로그에서 최근 결과를 볼 수 있어요.</p>
        ) : (
          <div className="wx-cards">
            {r.pending.map((p) => (
              <article className="wx-card" key={p.id}>
                <div className="wx-card-top">
                  <b>{p.city}</b>
                  <span className="num mut">{p.date}</span>
                  <SideTag side={p.side} />
                </div>
                <h4 className="wx-q">
                  최고기온 <b className="num">{p.bracketLo}–{p.bracketHi}°F</b>?
                </h4>
                <TempScale p={p} />
                <div className="wx-nums num">
                  <span>
                    예보 <b>{p.forecastTemp}°F</b>
                  </span>
                  <span>
                    모델 <b>{pct(p.modelProb)}</b>
                  </span>
                  <span>
                    호가 <b>{pct(p.entryPrice)}</b>
                  </span>
                  <span className="up">
                    엣지 <b>+{Math.round(p.edge * 100)}%p</b>
                  </span>
                </div>
                <div className="wx-foot num">
                  <span>
                    베팅 <b>{usd(p.betUsd)}</b> · 맞으면 <b>{usd(p.shares)}</b>
                  </span>
                  <span className="mut">{p.ticker}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="ag-two">
        <section className="ag-card">
          <header>
            <h3>도시별 성적 · 이 창</h3>
            <span className="num ag-card-head">평균 엣지 {(avgEdge * 100).toFixed(1)}%p</span>
          </header>
          {r.cities.length === 0 ? (
            <p className="alt-empty">아직 정산된 베팅이 없어요.</p>
          ) : (
            <div className="wx-cities">
              {r.cities.map((c) => (
                <div className="wx-city" key={c.city}>
                  <span className="k">{c.city}</span>
                  <span className="bar">
                    <i style={{ width: `${c.trades ? (c.wins / c.trades) * 100 : 0}%`, background: accent }} />
                  </span>
                  <span className="v num">
                    {c.wins}/{c.trades}
                  </span>
                  <span className={`v num ${c.pnl >= 0 ? "up" : "dn"}`}>
                    {c.pnl >= 0 ? "+" : "−"}
                    {usd(Math.abs(c.pnl))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="ag-card alt-real">
          <header>
            <h3>실제 Kalshi 봇 기록 · 아카이브</h3>
            <span className="tag real">REAL</span>
          </header>
          <p className="ag-card-sentence">
            같은 로직으로 실제 Kalshi 기온 마켓에서 돌린 봇의 진짜 기록입니다(~{KALSHI_REAL.last_updated.slice(0, 10)}). 시뮬레이션과
            나란히 두고 과장하지 않기 위해 그대로 보여드려요.
          </p>
          <div className="ag-mrow">
            <span className="k">베팅 수</span>
            <span className="v num">
              {KALSHI_REAL.total_trades}건 ({KALSHI_REAL.wins}승 {KALSHI_REAL.losses}패 · 대기 {KALSHI_REAL.pending})
            </span>
          </div>
          <div className="ag-mrow">
            <span className="k">승률 · ROI</span>
            <span className="v num">
              {KALSHI_REAL.win_rate}% · <span className={KALSHI_REAL.roi_pct >= 0 ? "up" : "dn"}>{KALSHI_REAL.roi_pct}%</span>
            </span>
          </div>
          <div className="ag-mrow">
            <span className="k">총 베팅 · 손익</span>
            <span className="v num">
              {usd(KALSHI_REAL.total_bet)} · <span className={KALSHI_REAL.total_pnl >= 0 ? "up" : "dn"}>{KALSHI_REAL.total_pnl >= 0 ? "+" : "−"}{usd(Math.abs(KALSHI_REAL.total_pnl), 2)}</span>
            </span>
          </div>
          <div className="ag-mrow">
            <span className="k">모델이 본 평균 엣지</span>
            <span className="v num">{KALSHI_REAL.avg_edge_pct}%p</span>
          </div>
          <p className="ag-bd-note">엣지 20%p를 봤는데 승률 40%였다는 건 모델이 과신했다는 뜻 — 이번 시즌 시뮬은 그 교훈(호가 신뢰도 게이트·소액 고정)을 반영했습니다.</p>
        </section>
      </div>

      <section className="alt-sec">
        <header className="alt-sec-head">
          <h3>
            정산 로그 <span className="num">{resolvedOnly.length}건 · 거부 {rejected.length}</span>
          </h3>
          <label className="ag-switch">
            <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
            <span>거부된 판단도 보기</span>
          </label>
        </header>
        <div className="alt-table wx-log">
          <div className="alt-thead" role="row">
            <span>정산</span>
            <span>도시 · 대상일</span>
            <span>브래킷</span>
            <span>사이드 @ 호가</span>
            <span>예보 → 실제</span>
            <span>베팅</span>
            <span>손익</span>
            <span>결과</span>
          </div>
          <div className="alt-tbody">
            {log.slice(0, 80).map((p) => (
              <div className={`alt-row${p.verdict === "REJECTED" ? " rejected" : ""}`} role="row" key={p.id}>
                <span className="num mut">{fmtT(p.resolvedAt ?? p.openedAt)}</span>
                <span className="alt-q">
                  {p.city}
                  <small>
                    {p.date}
                    {p.rejectReason ? ` · ${p.rejectReason}` : ""}
                  </small>
                </span>
                <span className="num">
                  {p.bracketLo}–{p.bracketHi}°F
                </span>
                <span className="num">
                  <SideTag side={p.side} /> {pct(p.entryPrice)} <small className="mut">(모델 {pct(p.modelProb)})</small>
                </span>
                <span className="num">
                  {p.forecastTemp}° → <b>{p.actualTemp !== null ? `${p.actualTemp}°` : "—"}</b>
                </span>
                <span className="num">{p.verdict === "REJECTED" ? "—" : usd(p.betUsd)}</span>
                <span className={`num ${p.pnl >= 0 ? "up" : "dn"}`}>
                  {p.verdict === "REJECTED" ? "—" : `${p.pnl >= 0 ? "+" : "−"}${usd(Math.abs(p.pnl), 2)}`}
                </span>
                <span>
                  {p.verdict === "REJECTED" ? (
                    <span className="alt-status reject">REJECTED</span>
                  ) : (
                    <span className={`alt-status ${p.status === "win" ? "win" : "loss"}`}>{p.status.toUpperCase()}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
