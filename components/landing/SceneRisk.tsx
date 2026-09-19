"use client";

import { motion } from "framer-motion";
import {
  KALSHI,
  RECENT_TRADES_COUNT,
  RECENT_WINS,
  RECENT_WIN_RATE_PCT,
  DAILY_MDD_PCT,
  STRATS,
  fmtSignedPct,
} from "./mint";
import { useMotionOk } from "./useMotionOk";

const EASE = [0.22, 1, 0.36, 1] as const;
const MDD_LABEL = `-${(Math.round(Math.abs(DAILY_MDD_PCT) * 10) / 10).toFixed(1)}%`;
const MAX_ABS_ROI = Math.max(...STRATS.map((s) => Math.abs(s.roiPct)));

/** 수익률 격차(+280% vs -30%)가 커서 제곱근 스케일로 상대 길이만 표현한다. 숫자가 진실이다. */
function barScale(roiPct: number): number {
  return Math.sqrt(Math.abs(roiPct)) / Math.sqrt(MAX_ABS_ROI);
}

export function SceneRisk() {
  const motionOk = useMotionOk();
  const negatives = STRATS.filter((s) => s.roiPct < 0).length;

  return (
    <section className="ag-scene" id="risk">
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
            수익 옆에 위험을
            <br />
            같이 적습니다.
          </h2>
          <p className="ag-lede">
            MINT의 서브 전략 {STRATS.length}개 중 {negatives}개는 잃었습니다.
            잃은 줄을 지우면 광고가 되고, 남겨 두면 기록이 됩니다. AGORA는 기록을
            택합니다.
          </p>
        </div>

        <div className="ag-risk-grid">
          <div>
            <div className="ag-risk-stat">
              <div className="v ag-dn">{MDD_LABEL}</div>
              <div className="k">최대 낙폭 · 2026년 4~9월 일별 곡선 기준</div>
            </div>
            <div className="ag-risk-stat">
              <div className="v">{RECENT_WIN_RATE_PCT.toFixed(1)}%</div>
              <div className="k">
                최근 {RECENT_TRADES_COUNT}건 승률 · {RECENT_WINS}승{" "}
                {RECENT_TRADES_COUNT - RECENT_WINS}패
              </div>
            </div>
          </div>

          <div>
            <div className="ag-strats-head" aria-hidden="true">
              <span>서브 전략</span>
              <span />
              <span>시즌 수익률</span>
              <span>승률</span>
            </div>
            <motion.div
              className="ag-strats"
              initial={motionOk ? "hidden" : false}
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
            >
              {STRATS.map((s, i) => {
                const pos = s.roiPct >= 0;
                const width = Math.max(barScale(s.roiPct) * 50, 1.5);
                return (
                  <div className="ag-strat-row" key={s.name}>
                    <span className="nm">{s.name}</span>
                    <span className="ag-strat-bar" aria-hidden="true">
                      <motion.i
                        className={pos ? "pos" : "neg"}
                        style={{ width: `${width}%` }}
                        variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1 } }}
                        transition={{ duration: 0.6, delay: i * 0.045, ease: EASE }}
                      />
                    </span>
                    <span className={`roi ${pos ? "ag-up" : "ag-dn"}`}>
                      {fmtSignedPct(s.roiPct)}
                    </span>
                    <span className="wr">
                      {s.winRate}% · {s.trades}건
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>

        <p className="ag-kalshi">
          실패한 실험도 같은 서랍에 있습니다. 같은 아카이브의 <b>Kalshi 날씨 마켓</b>{" "}
          기록은 {KALSHI.totalTrades}건에 수익률 <b className="ag-dn">{KALSHI.roiPct}%</b>,
          승률 {KALSHI.winRate}%로 끝났습니다. 이것도 지우지 않았습니다.
        </p>
      </div>
    </section>
  );
}
