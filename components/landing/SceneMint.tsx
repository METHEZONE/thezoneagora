"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  BASE_CAPITAL,
  DAILY_MDD_PCT,
  DAYS,
  END,
  FINAL_ROI_PCT,
  LAST_DAY,
  START,
  TAPE,
  dayAt,
  equityAt,
  fmtSigned,
  fmtSignedPct,
  fmtUsd,
} from "./mint";
import { useMotionOk } from "./useMotionOk";

const PAD = { l: 6, r: 6, t: 14, b: 12 };
const EQ_MIN = Math.min(...DAYS.map((d) => d.equity));
const EQ_MAX = Math.max(...DAYS.map((d) => d.equity));
const DOMAIN_MIN = EQ_MIN - (EQ_MAX - EQ_MIN) * 0.07;
const DOMAIN_MAX = EQ_MAX + (EQ_MAX - EQ_MIN) * 0.07;

/** 브리프 표기(-12.2%)와 같은 절대값 기준 반올림. */
const MDD_LABEL = `-${(Math.round(Math.abs(DAILY_MDD_PCT) * 10) / 10).toFixed(1)}%`;
const ROI_LABEL = fmtSignedPct(FINAL_ROI_PCT);

function useBox(): [React.RefObject<HTMLDivElement>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

/**
 * 곡선 차트. dayMv(0~22 실수)에 맞춰 클립 영역이 넓어지며 하루씩 그려진다.
 * 픽셀 좌표계 + ref 직접 갱신이라 리렌더 없이 60fps로 따라간다.
 */
function MintChart({
  dayMv,
  staticFull,
}: {
  dayMv: MotionValue<number> | null;
  staticFull: boolean;
}) {
  const [boxRef, box] = useBox();
  const { w, h } = box;
  const clipRef = useRef<SVGRectElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const vlineRef = useRef<SVGGElement>(null);

  const fallback = useMotionValue(LAST_DAY);
  const mv = dayMv ?? fallback;

  const x = useCallback(
    (day: number) => PAD.l + (day / LAST_DAY) * Math.max(w - PAD.l - PAD.r, 1),
    [w]
  );
  const y = useCallback(
    (eq: number) =>
      PAD.t +
      (1 - (eq - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN)) *
        Math.max(h - PAD.t - PAD.b, 1),
    [h]
  );

  const linePath = useMemo(() => {
    if (!w || !h) return "";
    return (
      "M" + DAYS.map((d) => `${x(d.day).toFixed(1)},${y(d.equity).toFixed(1)}`).join(" L")
    );
  }, [w, h, x, y]);

  const areaPath = useMemo(() => {
    if (!linePath) return "";
    return `${linePath} L${x(LAST_DAY).toFixed(1)},${h - PAD.b} L${x(0).toFixed(1)},${h - PAD.b} Z`;
  }, [linePath, x, h]);

  const apply = useCallback(
    (d: number) => {
      const day = staticFull ? LAST_DAY : Math.min(Math.max(d, 0), LAST_DAY);
      const cx = x(day);
      const cy = y(equityAt(day));
      clipRef.current?.setAttribute("width", String(cx + 3));
      headRef.current?.setAttribute("transform", `translate(${cx}, ${cy})`);
      vlineRef.current?.setAttribute("transform", `translate(${cx}, 0)`);
    },
    [staticFull, x, y]
  );

  useMotionValueEvent(mv, "change", apply);
  useEffect(() => apply(mv.get()), [apply, mv, w, h]);

  const gridLevels = [10000, 12000, 14000];

  return (
    <div className="ag-mint-chartbox">
      <div ref={boxRef} className="ag-mint-plot">
        {w > 0 && h > 0 && (
          <svg width={w} height={h} className="ag-mint-chart" aria-hidden="true">
            <defs>
              <clipPath id="ag-mint-clip">
                <rect ref={clipRef} x="0" y="0" width="0" height={h} />
              </clipPath>
            </defs>

            {gridLevels.map((lv) => (
              <g key={lv}>
                <line
                  x1={PAD.l}
                  x2={w - PAD.r}
                  y1={y(lv)}
                  y2={y(lv)}
                  stroke={lv === BASE_CAPITAL ? "rgba(17,16,15,0.3)" : "rgba(17,16,15,0.09)"}
                  strokeWidth={1}
                  strokeDasharray={lv === BASE_CAPITAL ? "5 5" : undefined}
                />
                <text
                  x={PAD.l + 2}
                  y={y(lv) - 7}
                  textAnchor="start"
                  fontSize={11}
                  fill="#A49A8C"
                  fontFamily="var(--mono)"
                >
                  {lv === BASE_CAPITAL ? "기준 $10,000" : `$${lv.toLocaleString("en-US")}`}
                </text>
              </g>
            ))}

            <g clipPath="url(#ag-mint-clip)">
              <path d={areaPath} fill="#FF5A1F" opacity={0.08} />
              <path
                d={linePath}
                fill="none"
                stroke="#FF5A1F"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {DAYS.map((d) => (
                <circle
                  key={d.day}
                  cx={x(d.day)}
                  cy={y(d.equity)}
                  r={2.6}
                  fill="#11100F"
                  opacity={0.3}
                />
              ))}
            </g>

            <g ref={vlineRef}>
              <line
                x1={0}
                x2={0}
                y1={PAD.t}
                y2={h - PAD.b}
                stroke="rgba(17,16,15,0.15)"
                strokeWidth={1}
              />
            </g>
            <g ref={headRef}>
              <circle r={10} fill="#FF5A1F" opacity={0.16} />
              <circle r={4.5} fill="#FF5A1F" />
            </g>
          </svg>
        )}
      </div>
      <div className="ag-mint-xaxis" aria-hidden="true">
        <span>04.17</span>
        <span>06.08</span>
        <span>07.29</span>
        <span>09.19</span>
      </div>
    </div>
  );
}

function TapeList({ reveal }: { reveal: number }) {
  const rows = TAPE.slice(Math.max(0, reveal - 9), reveal);
  return (
    <div className="ag-tape">
      {rows.map((e) => (
        <motion.div
          key={`${e.t}-${e.title}`}
          className={`ag-tape-row ${e.kind}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="ag-td">{e.date}</span>
          <span className="ag-tt">
            {e.kind === "trade" ? <b>{e.title}</b> : e.title}
            {e.kind === "trade" ? ` · ${e.note}` : ""}
          </span>
          <span className={`ag-tv ${e.delta >= 0 ? "ag-up" : "ag-dn"}`}>{fmtSigned(e.delta)}</span>
        </motion.div>
      ))}
    </div>
  );
}

function ChapterHead() {
  return (
    <div className="ag-mint-head">
      <h2 className="ag-mint-title">MINT가 달린 155일</h2>
      <p className="ag-mint-archive">
        2026.04.17 ~ 09.19 · <b>보관된 기록</b> · 지금 도는 라이브가 아니며, 미래
        수익의 약속도 아닙니다
      </p>
    </div>
  );
}

/** 모션 축소/정지 시: 핀 없이 완성된 최종 상태를 그대로 보여준다. */
function StaticChapter() {
  return (
    <section className="ag-scene" id="mint">
      <div className="ag-wrap">
        <ChapterHead />
        <div className="ag-mint-grid">
          <div className="ag-mint-num">
            <div className="ag-mint-eq">
              <span>{fmtUsd(END.equity)}</span>
              <small>USD</small>
            </div>
            <div className="ag-mint-sub">
              <span className="ag-date">{END.full}</span>
              <span className={FINAL_ROI_PCT >= 0 ? "ag-up" : "ag-dn"}>{ROI_LABEL}</span>
            </div>
            <div className="ag-mint-summary">
              시작 <b>${fmtUsd(START.equity)}</b>, 155일 뒤 <b>${fmtUsd(END.equity)}</b>. 기준
              $10,000 대비 <b>{ROI_LABEL}</b>, 그 사이 최대 낙폭은 <b>{MDD_LABEL}</b>
              였습니다 (일별 곡선 기준).
            </div>
          </div>
          <MintChart dayMv={null} staticFull />
          <TapeList reveal={TAPE.length} />
        </div>
      </div>
    </section>
  );
}

function ScrubChapter() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const eqRef = useRef<HTMLSpanElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const roiRef = useRef<HTMLSpanElement>(null);
  const revealRef = useRef(0);
  const [reveal, setReveal] = useState(0);

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });
  // 앞뒤로 여백을 둬서 챕터 진입/이탈 시 숨 고를 틈을 만든다.
  const chapter = useTransform(scrollYProgress, [0.03, 0.85], [0, 1], { clamp: true });
  const dayMv = useTransform(chapter, (p) => dayAt(p));
  const summaryOpacity = useTransform(scrollYProgress, [0.86, 0.93], [0, 1]);
  const summaryY = useTransform(scrollYProgress, [0.86, 0.93], [10, 0]);

  const sync = useCallback((d: number) => {
    const eq = equityAt(d);
    if (eqRef.current) eqRef.current.textContent = fmtUsd(eq);
    if (dateRef.current)
      dateRef.current.textContent = DAYS[Math.min(Math.floor(d), LAST_DAY)].full;
    if (roiRef.current) {
      const roi = ((eq - BASE_CAPITAL) / BASE_CAPITAL) * 100;
      roiRef.current.textContent = fmtSignedPct(roi);
      roiRef.current.style.color = roi >= 0 ? "var(--pg)" : "var(--pr)";
    }
    let count = 0;
    while (count < TAPE.length && TAPE[count].t <= d) count += 1;
    if (count !== revealRef.current) {
      revealRef.current = count;
      setReveal(count);
    }
  }, []);

  useMotionValueEvent(dayMv, "change", sync);
  useEffect(() => sync(dayMv.get()), [sync, dayMv]);

  return (
    <section className="ag-mint-wrap" id="mint" ref={wrapRef}>
      <div className="ag-mint-pin">
        <div className="ag-wrap" style={{ width: "100%" }}>
          <ChapterHead />
          <div className="ag-mint-grid">
            <div className="ag-mint-num">
              <div className="ag-mint-eq">
                <span ref={eqRef}>{fmtUsd(START.equity)}</span>
                <small>USD</small>
              </div>
              <div className="ag-mint-sub">
                <span className="ag-date" ref={dateRef}>
                  {START.full}
                </span>
                <span ref={roiRef} className="ag-num" style={{ color: "var(--pr)" }}>
                  {fmtSignedPct(((START.equity - BASE_CAPITAL) / BASE_CAPITAL) * 100)}
                </span>
              </div>
              <motion.div
                className="ag-mint-summary"
                style={{ opacity: summaryOpacity, y: summaryY }}
              >
                기준 $10,000 대비 <b>{ROI_LABEL}</b>. 그 사이 최대 낙폭은{" "}
                <b>{MDD_LABEL}</b>였습니다 (일별 곡선 기준). 이 두 숫자는 한
                몸입니다.
              </motion.div>
            </div>
            <MintChart dayMv={dayMv} staticFull={false} />
            <TapeList reveal={reveal} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function SceneMint() {
  const motionOk = useMotionOk();
  return motionOk ? <ScrubChapter /> : <StaticChapter />;
}
