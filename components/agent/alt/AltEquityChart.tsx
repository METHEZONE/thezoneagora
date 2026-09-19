"use client";

// 대체 전략용 가벼운 SVG 자산 곡선. 크립토 상세(PriceEquityChart, lightweight-charts)와 달리
// "추종 시세" 개념이 없어 가격 캔들을 겹치지 않는다. 벤치마크(SPY 등)가 있으면 점선으로.

import { useMemo, useState } from "react";
import type { EquityPoint } from "@/lib/altstrat/types";
import { fmtPct } from "@/components/arena/format";
import { usd } from "@/components/agent/primitives";

export interface ChartMarker {
  t: number;
  kind: "in" | "out" | "win" | "loss";
  label: string;
}

function fmtT(ms: number, spanMs: number): string {
  const d = new Date(ms);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  if (spanMs <= 2 * 24 * 3600_000) return `${mm}/${dd} ${String(d.getHours()).padStart(2, "0")}:00`;
  return `${mm}/${dd}`;
}

export function AltEquityChart({
  curve,
  capital,
  accent,
  bench,
  benchLabel,
  markers = [],
  height = 300,
  flatHours,
}: {
  curve: EquityPoint[];
  capital: number;
  accent: string;
  bench?: number[];
  benchLabel?: string;
  markers?: ChartMarker[];
  height?: number;
  /** 정규장 외 시간처럼 곡선이 "멈추는" 구간을 표시할 판별 함수 */
  flatHours?: (t: number) => boolean;
}) {
  const w = 900;
  const h = height;
  const padL = 56;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (curve.length < 2) return null;
    const t0 = curve[0].t;
    const t1 = curve[curve.length - 1].t;
    const vals = curve.map((p) => p.equity);
    const all = bench ? [...vals, ...bench] : vals;
    let min = Math.min(...all, capital);
    let max = Math.max(...all, capital);
    const pad = (max - min || capital * 0.02) * 0.08;
    min -= pad;
    max += pad;
    const px = (t: number) => padL + ((t - t0) / (t1 - t0 || 1)) * (w - padL - padR);
    const py = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
    const line = curve.map((p, i) => `${i ? "L" : "M"}${px(p.t).toFixed(1)},${py(p.equity).toFixed(1)}`).join(" ");
    const area = `${line} L${px(t1).toFixed(1)},${(h - padB).toFixed(1)} L${px(t0).toFixed(1)},${(h - padB).toFixed(1)} Z`;
    const benchLine = bench
      ? bench.map((v, i) => `${i ? "L" : "M"}${px(curve[Math.min(i, curve.length - 1)].t).toFixed(1)},${py(v).toFixed(1)}`).join(" ")
      : null;
    // y 그리드 4단
    const ticks = [0, 1, 2, 3, 4].map((k) => min + ((max - min) * k) / 4);
    // x 라벨 5개
    const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + (t1 - t0) * f);
    // 정규장 외 구간 음영
    const bands: { x0: number; x1: number }[] = [];
    if (flatHours) {
      let start: number | null = null;
      for (let i = 0; i < curve.length; i++) {
        const flat = flatHours(curve[i].t);
        if (flat && start === null) start = curve[i].t;
        if (!flat && start !== null) {
          bands.push({ x0: px(start), x1: px(curve[i].t) });
          start = null;
        }
      }
      if (start !== null) bands.push({ x0: px(start), x1: px(t1) });
    }
    return { t0, t1, min, max, px, py, line, area, benchLine, ticks, xt, bands, zeroY: py(capital) };
  }, [curve, bench, capital, h, flatHours]);

  if (!geo) return <div className="ag-skel-line" style={{ width: "100%", height }} />;

  const hp = hover !== null ? curve[hover] : null;
  const hb = hover !== null && bench ? bench[Math.min(hover, bench.length - 1)] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const f = (x - padL) / (w - padL - padR);
    const i = Math.round(Math.max(0, Math.min(1, f)) * (curve.length - 1));
    setHover(i);
  }

  return (
    <div className="alt-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="alt-chart-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {geo.bands.map((b, i) => (
          <rect key={i} x={b.x0} y={padT} width={Math.max(0.5, b.x1 - b.x0)} height={h - padT - padB} fill="var(--line2)" opacity={0.28} />
        ))}
        {geo.ticks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={geo.py(v)} y2={geo.py(v)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={padL - 8} y={geo.py(v) + 4} fill="var(--mut2)" fontSize={11} textAnchor="end" className="num">
              {usd(v)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={w - padR} y1={geo.zeroY} y2={geo.zeroY} stroke="var(--mut2)" strokeWidth={1} opacity={0.7} />
        <path d={geo.area} fill={accent} opacity={0.09} />
        {geo.benchLine && <path d={geo.benchLine} fill="none" stroke="var(--mut2)" strokeWidth={1.5} strokeDasharray="5 4" />}
        <path d={geo.line} fill="none" stroke={accent} strokeWidth={2.4} strokeLinejoin="round" />
        {markers.map((m, i) => {
          const x = geo.px(m.t);
          const idx = Math.round(((m.t - geo.t0) / (geo.t1 - geo.t0 || 1)) * (curve.length - 1));
          const y = geo.py(curve[Math.max(0, Math.min(curve.length - 1, idx))].equity);
          const color = m.kind === "in" ? "var(--ivory)" : m.kind === "out" ? "var(--mut)" : m.kind === "win" ? "var(--pos)" : "var(--neg)";
          return (
            <g key={i}>
              <title>{m.label}</title>
              {m.kind === "in" ? (
                <path d={`M${x},${y - 10} l5,7 h-10 z`} fill={color} />
              ) : m.kind === "out" ? (
                <path d={`M${x},${y + 10} l5,-7 h-10 z`} fill={color} />
              ) : (
                <circle cx={x} cy={y} r={3.4} fill={color} />
              )}
            </g>
          );
        })}
        {geo.xt.map((t, i) => (
          <text
            key={i}
            x={geo.px(t)}
            y={h - 8}
            fill="var(--mut2)"
            fontSize={11}
            textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
            className="num"
          >
            {fmtT(t, geo.t1 - geo.t0)}
          </text>
        ))}
        {hp && (
          <g>
            <line x1={geo.px(hp.t)} x2={geo.px(hp.t)} y1={padT} y2={h - padB} stroke="var(--mut)" strokeDasharray="3 3" />
            <circle cx={geo.px(hp.t)} cy={geo.py(hp.equity)} r={4.5} fill={accent} stroke="var(--black)" strokeWidth={2} />
          </g>
        )}
      </svg>
      <div className="alt-chart-tip num">
        {hp ? (
          <>
            <span>{fmtT(hp.t, geo.t1 - geo.t0)}</span>
            <b className={hp.equity >= capital ? "up" : "dn"}>{usd(hp.equity)}</b>
            <span className={hp.equity >= capital ? "up" : "dn"}>{fmtPct(((hp.equity - capital) / capital) * 100, 2)}</span>
            {hb !== null && benchLabel && (
              <span className="bench">
                {benchLabel} {usd(hb)}
              </span>
            )}
          </>
        ) : (
          <span className="mut">차트에 마우스를 올리면 시점별 자산이 보여요</span>
        )}
      </div>
    </div>
  );
}
