"use client";

// 백테스트 입력 → 결과 한 판. 입력은 딱 두 개(금액, 기간). 나머지는 전부 결과.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WINDOWS, type BacktestWindow } from "@/lib/backtest/klines";
import { fetchBacktest } from "@/lib/backtest/client";
import type { BtResult } from "@/lib/backtest/engine";
import { AGENT_NAME, STRATEGY_LABEL, SYMBOL_LABEL, WINDOW_LABEL, WINDOW_SHORT } from "@/components/agent/meta";
import { PriceEquityChart } from "@/components/agent/PriceEquityChart";
import { MetricCards } from "@/components/agent/MetricCards";
import { TimeMachine } from "@/components/agent/TimeMachine";
import { TradeLog } from "@/components/agent/TradeLog";
import { Pnl, ScoreRing, usd } from "@/components/agent/primitives";

const PRESETS = [1_000, 10_000, 50_000];

export function BacktestPanel({
  agentId,
  accent,
  initialWindow = "30d",
  initialCapital = 10_000,
  onResult,
}: {
  agentId: string;
  accent: string;
  initialWindow?: BacktestWindow;
  initialCapital?: number;
  onResult?: (r: BtResult | null) => void;
}) {
  const [window, setWindow] = useState<BacktestWindow>(initialWindow);
  const [capital, setCapital] = useState<number>(initialCapital);
  const [custom, setCustom] = useState<string>("");
  const [result, setResult] = useState<BtResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCursor(null);
    try {
      const r = await fetchBacktest(agentId, window, capital);
      setResult(r);
      onResult?.(r);
      setRan(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "실패");
      setResult(null);
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, window, capital, onResult]);

  // 첫 진입 시 기본값으로 한 번 자동 실행 — 빈 화면을 보여주지 않는다.
  useEffect(() => {
    if (!ran) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTradeIdx = useMemo(() => {
    if (!result || cursor === null) return null;
    let best: number | null = null;
    result.trades.forEach((t, i) => {
      if (t.index <= cursor && t.verdict === "VERIFIED") best = i;
    });
    return best;
  }, [result, cursor]);

  const m = result?.metrics;

  return (
    <div className="ag-bt">
      <form
        className="ag-bt-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="ag-bt-field">
          <label>얼마를 맡겼다면</label>
          <div className="ag-bt-presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`ag-preset num${capital === p && custom === "" ? " on" : ""}`}
                onClick={() => {
                  setCapital(p);
                  setCustom("");
                }}
              >
                {usd(p)}
              </button>
            ))}
            <span className="ag-custom num">
              $
              <input
                inputMode="numeric"
                placeholder="직접 입력"
                value={custom}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setCustom(raw);
                  const n = Number(raw);
                  if (n >= 100) setCapital(n);
                }}
              />
            </span>
          </div>
        </div>
        <div className="ag-bt-field">
          <label>얼마 동안</label>
          <div className="ag-seg">
            {WINDOWS.map((w) => (
              <button key={w} type="button" className={`ag-seg-btn num${window === w ? " on" : ""}`} onClick={() => setWindow(w)} title={`최근 ${WINDOW_LABEL[w]}`}>
                {WINDOW_SHORT[w]}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn primary big ag-bt-run" disabled={loading}>
          {loading ? (
            <>
              <span className="spin" /> 실제 시세로 다시 돌려보는 중…
            </>
          ) : (
            "백테스트 실행"
          )}
        </button>
      </form>

      {error && <div className="ag-error">백테스트 실패 — {error}</div>}

      {result && m && (
        <>
          <div className="ag-bt-headline">
            <div className="ag-bt-hl-left">
              <div className="ag-bt-eyebrow">
                {AGENT_NAME[agentId]} · {STRATEGY_LABEL[result.strategy]} · {SYMBOL_LABEL[result.symbol]} · 최근 {WINDOW_LABEL[window]}
              </div>
              <div className="ag-bt-money num">
                <span className="from">{usd(m.capital)}</span>
                <span className="arrow">→</span>
                <span className={`to ${m.pnl >= 0 ? "up" : "dn"}`}>{usd(m.finalEquity)}</span>
              </div>
              <div className="ag-bt-sub num">
                <span className={m.pnl >= 0 ? "up" : "dn"}>
                  {m.pnl >= 0 ? "+" : "−"}
                  {usd(Math.abs(m.pnl))}
                </span>{" "}
                <Pnl pct={m.roiPct} d={2} /> · 그냥 들고 있었으면 <Pnl pct={m.holdRoiPct} d={2} />
              </div>
            </div>
            <div className="ag-bt-hl-right">
              <ScoreRing score={result.score} color={accent} size={72} />
              <span className="ag-bt-score-k">AGORA 점수</span>
            </div>
          </div>

          <div className="ag-chart-wrap">
            <div className="ag-chart-legend">
              <span>
                <i style={{ background: accent }} /> 내 자산
              </span>
              <span>
                <i className="dash" /> 그냥 들고있기
              </span>
              <span>
                <i className="area" /> {SYMBOL_LABEL[result.symbol]} 가격
              </span>
              <span className="buy">▲ 매수</span>
              <span className="sell">▼ 매도</span>
            </div>
            <PriceEquityChart result={result} accent={accent} upTo={cursor} showRejected={showRejected} height={340} />
          </div>

          <TimeMachine result={result} cursor={cursor} onCursor={setCursor} />

          <MetricCards m={m} grade={result.riskGrade} windowLabel={WINDOW_LABEL[window]} />

          <TradeLog
            trades={result.trades}
            upTo={cursor}
            activeIndex={activeTradeIdx}
            onPick={(i) => setCursor(result.trades[i].index)}
            symbol={SYMBOL_LABEL[result.symbol]}
            showRejected={showRejected}
            onToggleRejected={setShowRejected}
          />

          <p className="ag-disclaimer">
            과거 시세(Binance 1시간봉)로 다시 돌려본 시뮬레이션입니다. 수수료 0.10%는 반영했고 슬리피지는 없다고 가정했어요.
            미래 수익을 보장하지 않습니다.
          </p>

          <div className="ag-sticky">
            <div className="ag-sticky-txt num">
              <span>{AGENT_NAME[agentId]}에게 {usd(m.capital)} 맡겼다면 →</span>
              <b className={m.pnl >= 0 ? "up" : "dn"}>{usd(m.finalEquity)}</b>
              <Pnl pct={m.roiPct} d={1} />
            </div>
            <Link href={`/vault/onboarding?strategy=${agentId}&amount=${Math.min(m.capital, 1_000_000)}`} className="btn primary">
              이 결과로 맡기기 →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
