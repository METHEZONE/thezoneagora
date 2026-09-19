"use client";

import { useEffect, useRef } from "react";
import type { BtTrade } from "@/lib/backtest/engine";
import { usd } from "@/components/agent/primitives";

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:00`;
}

export function TradeLog({
  trades,
  upTo,
  activeIndex,
  onPick,
  symbol,
  showRejected,
  onToggleRejected,
}: {
  trades: BtTrade[];
  /** 이 캔들 인덱스 이후 거래는 흐리게 (Time Machine) */
  upTo?: number | null;
  /** 현재 강조할 거래의 배열 인덱스 */
  activeIndex?: number | null;
  onPick?: (tradeArrayIndex: number) => void;
  symbol: string;
  showRejected: boolean;
  onToggleRejected: (v: boolean) => void;
}) {
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const visible = trades.map((t, i) => ({ t, i })).filter(({ t }) => showRejected || t.verdict === "VERIFIED");
  const executed = trades.filter((t) => t.verdict === "VERIFIED").length;
  const rejected = trades.length - executed;

  return (
    <div className="ag-log">
      <div className="ag-log-head">
        <h3>
          거래 로그 <span className="num">{executed}건 체결 · {rejected}건 거부</span>
        </h3>
        <label className="ag-switch">
          <input type="checkbox" checked={showRejected} onChange={(e) => onToggleRejected(e.target.checked)} />
          <span>거부된 시그널도 보기</span>
        </label>
      </div>
      <div className="ag-log-cols" role="row">
        <span>시각</span>
        <span>판단</span>
        <span>{symbol} 가격</span>
        <span>금액</span>
        <span>손익</span>
        <span>잔고</span>
      </div>
      <div className="ag-log-body">
        {visible.length === 0 && <div className="ag-log-empty">이 기간엔 체결이 없었어요. 이 전략은 조건이 맞을 때만 움직입니다.</div>}
        {visible.map(({ t, i }) => {
          const future = upTo !== null && upTo !== undefined && t.index > upTo;
          const active = activeIndex === i;
          const rejectedRow = t.verdict === "REJECTED";
          return (
            <div
              key={i}
              ref={active ? activeRef : undefined}
              className={`ag-log-row${future ? " future" : ""}${active ? " active" : ""}${rejectedRow ? " rejected" : ""}`}
              onClick={() => onPick?.(i)}
              role="row"
            >
              <span className="num">{fmtTime(t.t)}</span>
              <span>
                {rejectedRow ? (
                  <span className="ag-side rej" title={t.rejectReason}>
                    거부 · {t.side === "BUY" ? "매수" : "매도"}
                  </span>
                ) : (
                  <span className={`ag-side ${t.side === "BUY" ? "buy" : "sell"}`}>{t.side === "BUY" ? "▲ 매수" : "▼ 매도"}</span>
                )}
                {rejectedRow && <small className="ag-rej-reason">{t.rejectReason}</small>}
              </span>
              <span className="num">${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 10 ? 4 : 2 })}</span>
              <span className="num">{rejectedRow ? "—" : usd(t.notional)}</span>
              <span className={`num ${t.pnl === null ? "" : t.pnl >= 0 ? "up" : "dn"}`}>
                {t.pnl === null
                  ? "—"
                  : `${t.pnl >= 0 ? "+" : "−"}${usd(Math.abs(t.pnl))} (${t.pnlPct! >= 0 ? "+" : "−"}${Math.abs(t.pnlPct!).toFixed(2)}%)`}
              </span>
              <span className="num">{usd(t.equityAfter)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
