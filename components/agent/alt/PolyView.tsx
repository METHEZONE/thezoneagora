"use client";

// Polymarket 카피트레이드 상세 — 포지션은 "YES/NO 지분 @ 확률가". 크립토의 BUY/SELL 왕복과 다르게
// (1) 열린 포지션 카드: 마켓 질문 · 진입확률 → 현재확률 바 · 지분/투입 · 미실현
// (2) 따라가는 지갑 4개
// (3) 정산·청산 로그: WON / LOST / EXIT

import { useState } from "react";
import type { PolyPosition, PolyResult } from "@/lib/altstrat/types";
import { usd } from "@/components/agent/primitives";
import { AltEquityChart, type ChartMarker } from "@/components/agent/alt/AltEquityChart";

function fmtT(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function cents(p: number): string {
  return `${Math.round(p * 100)}¢`;
}

function SideTag({ side }: { side: "YES" | "NO" }) {
  return <span className={`alt-side ${side === "YES" ? "yes" : "no"}`}>{side}</span>;
}

function StatusTag({ status }: { status: PolyPosition["status"] }) {
  const map = { open: ["보유 중", "open"], won: ["WON", "win"], lost: ["LOST", "loss"], exited: ["EXIT", "exit"] } as const;
  const [label, cls] = map[status];
  return <span className={`alt-status ${cls}`}>{label}</span>;
}

export function PolyView({ r, accent }: { r: PolyResult; accent: string }) {
  const [showRejected, setShowRejected] = useState(false);
  const markers: ChartMarker[] = r.closed
    .filter((p) => p.verdict === "VERIFIED")
    .slice(0, 80)
    .map((p) => ({
      t: p.closedAt ?? p.openedAt,
      kind: p.status === "won" ? "win" : p.status === "lost" ? "loss" : "out",
      label: `${p.market} · ${p.status.toUpperCase()} ${p.pnl >= 0 ? "+" : "−"}${usd(Math.abs(p.pnl))}`,
    }));
  const log = r.closed.filter((p) => showRejected || p.verdict === "VERIFIED");
  const openMtm = r.open.reduce((s, p) => s + p.pnl, 0);
  const openStake = r.open.reduce((s, p) => s + p.stake, 0);

  return (
    <>
      <div className="ag-chart-wrap">
        <div className="ag-chart-legend">
          <span>
            <i style={{ background: accent }} /> 내 자산 (지분 시가평가)
          </span>
          <span className="buy">● 정산 WON</span>
          <span className="sell">● 정산 LOST</span>
          <span>▼ 조기 청산</span>
        </div>
        <AltEquityChart curve={r.equityCurve} capital={r.capital} accent={accent} markers={markers} height={300} />
      </div>

      <section className="alt-sec">
        <header className="alt-sec-head">
          <h3>
            지금 들고 있는 포지션 <span className="num">{r.open.length}개 · 투입 {usd(openStake)}</span>
          </h3>
          <b className={`num ${openMtm >= 0 ? "up" : "dn"}`}>
            미실현 {openMtm >= 0 ? "+" : "−"}
            {usd(Math.abs(openMtm))}
          </b>
        </header>
        {r.open.length === 0 ? (
          <p className="alt-empty">지금은 열린 포지션이 없어요. 따라가는 지갑이 새 마켓에 들어가면 여기에 뜹니다.</p>
        ) : (
          <div className="poly-cards">
            {r.open.map((p) => {
              const move = p.currentProb - p.entryProb;
              return (
                <article className="poly-card" key={p.id}>
                  <div className="poly-card-top">
                    <span className="poly-cat">{p.category}</span>
                    <SideTag side={p.side} />
                  </div>
                  <h4 className="poly-q">{p.market}</h4>
                  <div className="poly-prob">
                    <div className="poly-prob-bar">
                      <i className="entry" style={{ left: `${p.entryProb * 100}%` }} title={`진입 ${cents(p.entryProb)}`} />
                      <i className={`now ${move >= 0 ? "up" : "dn"}`} style={{ left: `${p.currentProb * 100}%` }} title={`현재 ${cents(p.currentProb)}`} />
                      <b style={{ width: `${p.currentProb * 100}%`, background: accent }} />
                    </div>
                    <div className="poly-prob-nums num">
                      <span>
                        진입 <b>{cents(p.entryProb)}</b>
                      </span>
                      <span className={move >= 0 ? "up" : "dn"}>
                        현재 <b>{cents(p.currentProb)}</b> ({move >= 0 ? "+" : ""}
                        {Math.round(move * 100)}¢)
                      </span>
                    </div>
                  </div>
                  <div className="poly-meta num">
                    <span>
                      지분 <b>{p.shares.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b>
                    </span>
                    <span>
                      투입 <b>{usd(p.stake)}</b>
                    </span>
                    <span>
                      정산 시 <b>{usd(p.shares)}</b>
                    </span>
                    <span className={p.pnl >= 0 ? "up" : "dn"}>
                      미실현 <b>{p.pnl >= 0 ? "+" : "−"}{usd(Math.abs(p.pnl))}</b>
                    </span>
                  </div>
                  <div className="poly-foot">
                    <span>카피 · {p.copiedFrom}</span>
                    <span className="num">{fmtT(p.openedAt)} 진입</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="alt-sec">
        <header className="alt-sec-head">
          <h3>따라가는 지갑</h3>
          <span className="alt-sec-note">지갑이 들어가면 우리도 같은 확률가에 비례 진입 · 지갑이 나오면 같이 나온다</span>
        </header>
        <div className="poly-wallets">
          {r.wallets.map((w) => (
            <div className="poly-wallet" key={w.address}>
              <div className="poly-wallet-id">
                <b className="num">{w.address}</b>
                <span>{w.label}</span>
              </div>
              <div className="poly-wallet-stats num">
                <span>
                  비중 <b>{w.weightPct}%</b>
                </span>
                <span>
                  30일 <b className={w.pnl30d >= 0 ? "up" : "dn"}>{w.pnl30d >= 0 ? "+" : "−"}{usd(Math.abs(w.pnl30d))}</b>
                </span>
                <span>
                  승률 <b>{w.winRatePct}%</b>
                </span>
                <span>
                  이 창 포지션 <b>{w.positions}</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="alt-sec">
        <header className="alt-sec-head">
          <h3>
            정산·청산 로그{" "}
            <span className="num">
              {r.closed.filter((p) => p.verdict === "VERIFIED").length}건 · 거부 {r.closed.filter((p) => p.verdict === "REJECTED").length}
            </span>
          </h3>
          <label className="ag-switch">
            <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} />
            <span>거부된 판단도 보기</span>
          </label>
        </header>
        <div className="alt-table poly-log">
          <div className="alt-thead" role="row">
            <span>정산</span>
            <span>마켓</span>
            <span>사이드</span>
            <span>진입 → 정산</span>
            <span>투입</span>
            <span>손익</span>
            <span>결과</span>
          </div>
          <div className="alt-tbody">
            {log.slice(0, 60).map((p) => (
              <div className={`alt-row${p.verdict === "REJECTED" ? " rejected" : ""}`} role="row" key={p.id}>
                <span className="num mut">{fmtT(p.closedAt ?? p.openedAt)}</span>
                <span className="alt-q">
                  {p.market}
                  <small>
                    {p.category} · {p.copiedFrom}
                    {p.rejectReason ? ` · ${p.rejectReason}` : ""}
                  </small>
                </span>
                <span>
                  <SideTag side={p.side} />
                </span>
                <span className="num">
                  {cents(p.entryProb)} → <b>{p.verdict === "REJECTED" ? "—" : cents(p.currentProb)}</b>
                </span>
                <span className="num">{p.verdict === "REJECTED" ? "—" : usd(p.stake)}</span>
                <span className={`num ${p.pnl >= 0 ? "up" : "dn"}`}>
                  {p.verdict === "REJECTED" ? "—" : `${p.pnl >= 0 ? "+" : "−"}${usd(Math.abs(p.pnl))}`}
                </span>
                <span>{p.verdict === "REJECTED" ? <span className="alt-status reject">REJECTED</span> : <StatusTag status={p.status} />}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
