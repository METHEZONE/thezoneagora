"use client";

import type { BtMetrics, RiskGrade } from "@/lib/backtest/engine";
import { RISK_LABEL, riskSentence } from "@/components/agent/meta";
import { Pnl, RiskBadge, usd } from "@/components/agent/primitives";

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="ag-mrow" title={hint}>
      <span className="k">{k}</span>
      <span className="v num">{v}</span>
    </div>
  );
}

function hours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h.toFixed(0)}시간`;
  return `${(h / 24).toFixed(1)}일`;
}

export function MetricCards({
  m,
  grade,
  windowLabel,
}: {
  m: BtMetrics;
  grade: RiskGrade;
  windowLabel: string;
}) {
  const beatHold = m.roiPct - m.holdRoiPct;
  return (
    <div className="ag-cards">
      <section className="ag-card">
        <header>
          <h3>수익</h3>
          <Pnl pct={m.roiPct} d={2} className="ag-card-head" />
        </header>
        <Row
          k={`${usd(m.capital)} 넣었으면`}
          v={<b className={m.pnl >= 0 ? "up" : "dn"}>{usd(m.finalEquity)}</b>}
          hint="기간 시작에 넣고 끝까지 뒀을 때 (수수료 0.10% 포함)"
        />
        <Row k="손익" v={<span className={m.pnl >= 0 ? "up" : "dn"}>{`${m.pnl >= 0 ? "+" : "−"}${usd(Math.abs(m.pnl))}`}</span>} />
        <Row
          k="그냥 들고 있었으면"
          v={
            <span>
              <Pnl pct={m.holdRoiPct} d={2} />{" "}
              <small className={beatHold >= 0 ? "up" : "dn"}>({beatHold >= 0 ? "+" : "−"}{Math.abs(beatHold).toFixed(1)}p)</small>
            </span>
          }
          hint="같은 코인을 같은 기간 그냥 보유했을 때와 비교"
        />
        <Row k="최고 거래" v={m.bestTradePct !== null ? <Pnl pct={m.bestTradePct} d={2} /> : "—"} />
        <Row k="평균 거래" v={m.avgTradePct !== null ? <Pnl pct={m.avgTradePct} d={2} /> : "—"} />
      </section>

      <section className="ag-card">
        <header>
          <h3>리스크</h3>
          <RiskBadge grade={grade} mddPct={m.mddPct} compact />
        </header>
        <p className="ag-card-sentence">{riskSentence(m.mddPct, windowLabel)}</p>
        <Row k="최대 낙폭 (MDD)" v={<span className="dn">−{m.mddPct.toFixed(2)}%</span>} hint="고점에서 저점까지 가장 크게 빠진 폭" />
        <Row k="최악 거래" v={m.worstTradePct !== null ? <Pnl pct={m.worstTradePct} d={2} /> : "—"} />
        <Row k="연속 승 / 연속 패" v={`${m.maxWinStreak} / ${m.maxLoseStreak}`} />
        <Row k="시장 노출" v={`${m.exposurePct.toFixed(0)}%`} hint="기간 중 포지션을 들고 있던 시간 비율" />
        <Row k="리스크 등급" v={RISK_LABEL[grade]} hint="MDD ≤5% 낮음 · ≤12% 중간 · 그 외 높음" />
      </section>

      <section className="ag-card">
        <header>
          <h3>활동</h3>
          <span className="num ag-card-head">{m.buys + m.sells}회</span>
        </header>
        <Row k="승률" v={m.roundTrips ? `${m.winRatePct.toFixed(0)}% (${m.wins}승 ${m.losses}패)` : "—"} />
        <Row k="매수 / 매도" v={`${m.buys} / ${m.sells}`} />
        <Row k="거부된 시그널" v={m.rejected} hint="위험도 상한·가격 편차 검증에서 걸러진 판단. 지우지 않고 남깁니다" />
        <Row k="평균 보유" v={hours(m.avgHoldHours)} />
        <Row k="수익 난 날" v={m.tradingDays ? `${m.profitableDaysPct.toFixed(0)}% (${m.tradingDays}일 중)` : "—"} />
        <Row k="열린 포지션" v={m.openPosition ? "있음 (시가평가)" : "없음"} />
      </section>
    </div>
  );
}
