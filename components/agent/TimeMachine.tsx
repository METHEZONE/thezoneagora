"use client";

// Polyfox Time Machine 포팅: 캔들 하나씩 재생/스텝/배속/슬라이더.
// cursor = 캔들 인덱스. 부모가 차트(upTo)와 거래 로그(activeIndex)에 동기화한다.

import { useEffect, useRef, useState } from "react";
import type { BtResult } from "@/lib/backtest/engine";
import { Pnl, usd } from "@/components/agent/primitives";

const SPEEDS = [1, 4, 16] as const;

export function TimeMachine({
  result,
  cursor,
  onCursor,
}: {
  result: BtResult;
  cursor: number | null;
  onCursor: (i: number | null) => void;
}) {
  const n = result.candles.length;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  const idx = cursor ?? n - 1;
  const equity = result.equityCurve[idx];
  const pnl = equity - result.metrics.capital;
  const roi = (pnl / result.metrics.capital) * 100;
  const tradesSoFar = result.trades.filter((t) => t.index <= idx && t.verdict === "VERIFIED").length;
  const d = new Date(result.candles[idx].t);

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      return;
    }
    // 1× = 초당 6캔들(6시간/초). 30일=720캔들이 1×에서 2분, 16×에서 8초.
    const perCandleMs = 1000 / (6 * speed);
    const step = (ts: number) => {
      if (ts - last.current >= perCandleMs) {
        last.current = ts;
        const next = (cursor ?? -1) + 1;
        if (next >= n - 1) {
          onCursor(n - 1);
          setPlaying(false);
          return;
        }
        onCursor(next);
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, cursor, n, onCursor]);

  function togglePlay() {
    if (!playing && (cursor === null || cursor >= n - 1)) onCursor(0);
    setPlaying((p) => !p);
  }

  return (
    <div className="ag-tm">
      <div className="ag-tm-top">
        <div>
          <div className="ag-tm-eyebrow">TIME MACHINE · 캔들 하나씩 다시 보기</div>
          <div className="ag-tm-when num">
            {d.getMonth() + 1}/{d.getDate()} {String(d.getHours()).padStart(2, "0")}:00
            <small>
              {idx + 1} / {n} 시간
            </small>
          </div>
        </div>
        <div className="ag-tm-kpis">
          <div className="ag-tm-kpi">
            <div className="k">그때 자산</div>
            <div className="v num">{usd(equity)}</div>
          </div>
          <div className="ag-tm-kpi">
            <div className="k">누적 손익</div>
            <div className={`v num ${pnl >= 0 ? "up" : "dn"}`}>
              {pnl >= 0 ? "+" : "−"}
              {usd(Math.abs(pnl))} <small><Pnl pct={roi} /></small>
            </div>
          </div>
          <div className="ag-tm-kpi">
            <div className="k">체결 누적</div>
            <div className="v num">{tradesSoFar}건</div>
          </div>
        </div>
      </div>

      <div className="ag-tm-controls">
        <button type="button" className="ag-tm-btn" aria-label="한 캔들 뒤로" onClick={() => onCursor(Math.max(0, idx - 1))}>
          ‹
        </button>
        <button type="button" className={`ag-tm-btn play${playing ? " on" : ""}`} onClick={togglePlay} aria-label={playing ? "일시정지" : "재생"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className="ag-tm-btn" aria-label="한 캔들 앞으로" onClick={() => onCursor(Math.min(n - 1, idx + 1))}>
          ›
        </button>
        <div className="ag-seg">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={`ag-seg-btn num${speed === s ? " on" : ""}`} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <input
          type="range"
          className="ag-tm-slider"
          min={0}
          max={n - 1}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            onCursor(Number(e.target.value));
          }}
          style={{ "--fill": `${(idx / (n - 1)) * 100}%` } as React.CSSProperties}
          aria-label="리플레이 위치"
        />
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            setPlaying(false);
            onCursor(null);
          }}
        >
          끝으로
        </button>
      </div>
    </div>
  );
}
