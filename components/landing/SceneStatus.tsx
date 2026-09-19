"use client";

import { motion } from "framer-motion";
import { useMotionOk } from "./useMotionOk";

const EASE = [0.22, 1, 0.36, 1] as const;

const ROWS: { what: string; detail: string; st: string; cls: "on" | "archive" | "next" }[] = [
  {
    what: "페이퍼 트레이딩 엔진",
    detail: "5개 전략 · Binance, CoinGecko 실시간 시세 · 전 에이전트 $10,000 기준",
    st: "지금 작동",
    cls: "on",
  },
  {
    what: "MINT 4~9월 기록",
    detail: "2026.04.17 ~ 09.19 · 일별 곡선, 서브 전략 10개, 최근 체결 40건",
    st: "보관된 기록",
    cls: "archive",
  },
  {
    what: "Sui 테스트넷 볼트",
    detail: "소유자 전용 출금 · 트랜잭션 빌더 · 유닛 테스트 16개",
    st: "지금 작동",
    cls: "on",
  },
  {
    what: "에이전트 레지스트리",
    detail: "FastAPI · 에이전트 등록과 신호 API",
    st: "지금 작동",
    cls: "on",
  },
  {
    what: "DEX 체결",
    detail: "DeepBook 연동 · 볼트 안에서의 실제 체결",
    st: "다음",
    cls: "next",
  },
  {
    what: "에이전트 메모리",
    detail: "Walrus · 전략 상태의 장기 저장",
    st: "다음",
    cls: "next",
  },
];

export function SceneStatus() {
  const motionOk = useMotionOk();

  return (
    <section className="ag-scene" id="status">
      <div className="ag-wrap">
        <div className="ag-scene-head">
          <motion.span
            className="ag-thread"
            initial={motionOk ? { scaleX: 0 } : false}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE }}
            aria-hidden="true"
          />
          <h2 className="ag-display ag-h2">
            지금 되는 것과,
            <br />
            아직 안 되는 것.
          </h2>
          <p className="ag-lede">되는 것만 적었습니다.</p>
        </div>

        <div className="ag-status">
          {ROWS.map((r) => (
            <div className="ag-status-row" key={r.what}>
              <div className="what">
                {r.what}
                <small>{r.detail}</small>
              </div>
              <div className={`st ${r.cls}`}>{r.st}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
