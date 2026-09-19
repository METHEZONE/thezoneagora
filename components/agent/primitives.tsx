"use client";

import { useState } from "react";
import type { RiskGrade, ScoreBreakdown } from "@/lib/backtest/engine";
import { RISK_COLOR, RISK_LABEL } from "@/components/agent/meta";
import { fmtPct } from "@/components/arena/format";

// ─── 리스크 등급 배지 ─────────────────────────────────────────────────────────
export function RiskBadge({ grade, mddPct, compact }: { grade: RiskGrade; mddPct: number; compact?: boolean }) {
  return (
    <span className={`ag-risk ag-risk-${grade}`} style={{ "--rc": RISK_COLOR[grade] } as React.CSSProperties}>
      <i />
      {RISK_LABEL[grade]}
      {!compact && <b className="num">−{mddPct.toFixed(1)}%</b>}
    </span>
  );
}

// ─── AGORA 점수 링 + 분해 팝오버 ─────────────────────────────────────────────
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

export function ScoreRing({
  score,
  color,
  size = 56,
  showBreakdown = true,
}: {
  score: ScoreBreakdown;
  color: string;
  size?: number;
  showBreakdown?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="ag-score"
      style={{ width: size, height: size }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      <svg viewBox="0 0 52 52" width={size} height={size}>
        <circle cx={26} cy={26} r={RING_R} fill="none" stroke="var(--line)" strokeWidth={4} />
        <circle
          cx={26}
          cy={26}
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - score.total / 100)}
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dashoffset 0.9s var(--ease)" }}
        />
      </svg>
      <b className="num" style={{ fontSize: size * 0.32 }}>
        {score.total}
      </b>
      {showBreakdown && open && <ScoreBreakdownPop score={score} color={color} />}
    </span>
  );
}

const BREAKDOWN_ROWS: { key: keyof Omit<ScoreBreakdown, "total">; label: string; max: number; hint: string }[] = [
  { key: "returns", label: "수익률", max: 30, hint: "기간 수익률. −10%→0점, +20%→만점" },
  { key: "riskAdjusted", label: "위험조정", max: 30, hint: "수익률 ÷ 최대낙폭. 덜 흔들리며 벌수록 높음" },
  { key: "consistency", label: "일관성", max: 20, hint: "승률 절반 + 수익 난 날 비율 절반" },
  { key: "trend", label: "최근 추세", max: 20, hint: "최근 7일 수익률" },
];

export function ScoreBreakdownPop({ score, color }: { score: ScoreBreakdown; color: string }) {
  return (
    <div className="ag-score-pop" onClick={(e) => e.stopPropagation()}>
      <div className="ag-score-pop-head">
        <span>AGORA 점수</span>
        <b className="num">{score.total} / 100</b>
      </div>
      {BREAKDOWN_ROWS.map((r) => (
        <div key={r.key} className="ag-bd-row" title={r.hint}>
          <span className="k">{r.label}</span>
          <span className="bar">
            <i style={{ width: `${(score[r.key] / r.max) * 100}%`, background: color }} />
          </span>
          <span className="v num">
            {score[r.key].toFixed(0)}
            <small>/{r.max}</small>
          </span>
        </div>
      ))}
      <p className="ag-bd-note">수익률 30 · 위험조정 30 · 일관성 20 · 추세 20. 누구에게나 같은 공식.</p>
    </div>
  );
}

export function ScoreBreakdownInline({ score, color }: { score: ScoreBreakdown; color: string }) {
  return (
    <div className="ag-bd-inline">
      {BREAKDOWN_ROWS.map((r) => (
        <div key={r.key} className="ag-bd-row" title={r.hint}>
          <span className="k">{r.label}</span>
          <span className="bar">
            <i style={{ width: `${(score[r.key] / r.max) * 100}%`, background: color }} />
          </span>
          <span className="v num">
            {score[r.key].toFixed(0)}
            <small>/{r.max}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 스파크라인 ──────────────────────────────────────────────────────────────
export function Spark({
  values,
  color,
  w = 120,
  h = 36,
  baseline = true,
}: {
  values: number[];
  color: string;
  w?: number;
  h?: number;
  baseline?: boolean;
}) {
  if (values.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const px = (i: number) => (i / (values.length - 1)) * w;
  const py = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const zeroY = py(0);
  const last = values[values.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="ag-spark">
      {baseline && <line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="var(--line)" strokeDasharray="2 3" />}
      <polyline
        points={pts}
        fill="none"
        stroke={last >= 0 ? color : "var(--neg)"}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── 큰 손익 숫자 ─────────────────────────────────────────────────────────────
export function Pnl({ pct, d = 1, className = "" }: { pct: number; d?: number; className?: string }) {
  return <span className={`num ${pct >= 0 ? "up" : "dn"} ${className}`}>{fmtPct(pct, d)}</span>;
}

export function usd(n: number, d = 0): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
