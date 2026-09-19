"use client";

// Polyfox Smart Wallets 테이블을 Agora 감도로 옮긴 리더보드.
// 숫자 출처는 느린 시계(/api/replay, Binance 1h 리플레이) — 누가 봐도 같은 숫자.
// 라이브 엔진(ArenaAgent)은 캐릭터 색/백커(mock)/"지금" 배지에만 쓴다.

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AgentCharacter } from "@/components/arena/characters";
import type { ArenaAgent } from "@/components/arena/useArenaAgents";
import { useReplayBoard } from "@/lib/backtest/client";
import type { BacktestWindow } from "@/lib/backtest/klines";
import type { AgentSummary } from "@/lib/backtest/engine";
import { AGENT_NAME, STRATEGY_LABEL, SYMBOL_LABEL, WINDOW_LABEL } from "@/components/agent/meta";
import { Pnl, RiskBadge, ScoreRing, Spark, usd } from "@/components/agent/primitives";

type SortKey = "score" | "return" | "stability";

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "score", label: "종합점수", hint: "AGORA 점수 — 수익·리스크·일관성·추세를 한 숫자로" },
  { key: "return", label: "수익률", hint: "기간 수익률 그대로" },
  { key: "stability", label: "안정성", hint: "최대 낙폭이 작은 순" },
];

function sortAgents(list: AgentSummary[], key: SortKey): AgentSummary[] {
  const copy = [...list];
  if (key === "score") copy.sort((a, b) => b.score.total - a.score.total || b.metrics.roiPct - a.metrics.roiPct);
  if (key === "return") copy.sort((a, b) => b.metrics.roiPct - a.metrics.roiPct);
  if (key === "stability") copy.sort((a, b) => a.metrics.mddPct - b.metrics.mddPct || b.metrics.roiPct - a.metrics.roiPct);
  return copy;
}

export function LeaderboardTable({
  liveAgents,
  window,
  onWindowChange,
  onDelegateClick,
}: {
  liveAgents: ArenaAgent[];
  window: BacktestWindow;
  onWindowChange: (w: BacktestWindow) => void;
  onDelegateClick: (agentId: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const board = useReplayBoard(window);
  const liveById = useMemo(() => new Map(liveAgents.map((a) => [a.id, a])), [liveAgents]);
  const ranked = useMemo(() => (board.data ? sortAgents(board.data.agents, sort) : []), [board.data, sort]);
  const capital = board.data?.capital ?? 10_000;

  const agg = useMemo(() => {
    if (!board.data) return null;
    const list = board.data.agents;
    const avgRoi = list.reduce((s, a) => s + a.metrics.roiPct, 0) / list.length;
    const best = [...list].sort((a, b) => b.metrics.roiPct - a.metrics.roiPct)[0];
    const trades = list.reduce((s, a) => s + a.metrics.buys + a.metrics.sells, 0);
    const positive = list.filter((a) => a.metrics.roiPct > 0).length;
    const avgHold = list.reduce((s, a) => s + a.metrics.holdRoiPct, 0) / list.length;
    return { avgRoi, best, trades, positive, avgHold, n: list.length };
  }, [board.data]);

  return (
    <div className="ag-board">
      <div className="ag-board-controls">
        <div className="ag-tabs" role="tablist" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={sort === s.key}
              className={`ag-tab${sort === s.key ? " on" : ""}`}
              title={s.hint}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="ag-seg" role="group" aria-label="기간">
          {(["7d", "30d"] as BacktestWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              className={`ag-seg-btn num${window === w ? " on" : ""}`}
              onClick={() => onWindowChange(w)}
            >
              {w === "30d" ? "시즌 · 30일" : "7일"}
            </button>
          ))}
        </div>
      </div>

      {agg && (
        <div className="ag-agg">
          <div className="ag-agg-cell">
            <div className="k">5개 평균 수익률 · {WINDOW_LABEL[window]}</div>
            <div className="v">
              <Pnl pct={agg.avgRoi} d={2} />
            </div>
            <div className="s num">
              그냥 들고 있었으면 <Pnl pct={agg.avgHold} d={1} />
            </div>
          </div>
          <div className="ag-agg-cell">
            <div className="k">수익률 1위</div>
            <div className="v">
              {AGENT_NAME[agg.best.agentId]} <Pnl pct={agg.best.metrics.roiPct} d={2} />
            </div>
            <div className="s">
              {STRATEGY_LABEL[agg.best.strategy]} · {SYMBOL_LABEL[agg.best.symbol]}
            </div>
          </div>
          <div className="ag-agg-cell">
            <div className="k">수익 난 에이전트</div>
            <div className="v num">
              {agg.positive} <small>/ {agg.n}</small>
            </div>
            <div className="s">손실 에이전트도 그대로 보여드려요</div>
          </div>
          <div className="ag-agg-cell">
            <div className="k">기간 내 총 체결</div>
            <div className="v num">{agg.trades.toLocaleString()}</div>
            <div className="s">Binance 1시간봉 리플레이 · 수수료 0.10% 반영</div>
          </div>
        </div>
      )}

      <div className="ag-table" role="table">
        <div className="ag-thead" role="row">
          <span>#</span>
          <span>에이전트</span>
          <span title="수익·리스크·일관성·추세를 합친 0~100점">AGORA 점수</span>
          <span>{WINDOW_LABEL[window]} 수익률</span>
          <span>{usd(capital)} 넣었으면</span>
          <span>리스크 · 최대낙폭</span>
          <span>승률 · 거래</span>
          <span>백커</span>
          <span />
        </div>

        {board.loading && !board.data && (
          <div className="ag-skeleton">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="ag-skel-row" />
            ))}
          </div>
        )}
        {board.error && <div className="ag-error">리플레이 데이터를 불러오지 못했어요 — {board.error}</div>}

        {ranked.map((a, i) => {
          const live = liveById.get(a.agentId);
          const accent = live?.accent ?? "#ff5a1f";
          const m = a.metrics;
          const rank = i + 1;
          return (
            <motion.div
              key={a.agentId}
              layout
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`ag-row${rank === 1 ? " first" : ""}`}
              role="row"
            >
              <span className="ag-rank num">{rank}</span>

              <Link href={`/agent/${a.agentId}`} className="ag-agent">
                <AgentCharacter agentId={a.agentId} size={44} label={AGENT_NAME[a.agentId]} />
                <span className="ag-agent-txt">
                  <span className="ag-agent-name">
                    {AGENT_NAME[a.agentId]}
                    {live && <i className="ag-live-dot" title="실시간 시세 반응 중" />}
                  </span>
                  <span className="ag-agent-sub">
                    <span className="ag-chip" style={{ "--c": accent } as React.CSSProperties}>
                      {STRATEGY_LABEL[a.strategy]}
                    </span>
                    <span className="ag-sym num">{SYMBOL_LABEL[a.symbol]}</span>
                  </span>
                </span>
              </Link>

              <span className="ag-cell-score">
                <ScoreRing score={a.score} color={accent} size={48} />
              </span>

              <span className="ag-cell-ret">
                <Pnl pct={m.roiPct} d={2} className="ag-big" />
                <Spark values={a.spark} color={accent} w={96} h={28} />
              </span>

              <span className="ag-cell-money num">
                <b className={m.pnl >= 0 ? "up" : "dn"}>{usd(m.finalEquity)}</b>
                <small className={m.pnl >= 0 ? "up" : "dn"}>
                  {m.pnl >= 0 ? "+" : "−"}
                  {usd(Math.abs(m.pnl))}
                </small>
              </span>

              <span className="ag-cell-risk">
                <RiskBadge grade={a.riskGrade} mddPct={m.mddPct} />
              </span>

              <span className="ag-cell-win num">
                <b>{m.roundTrips ? `${m.winRatePct.toFixed(0)}%` : "—"}</b>
                <small>
                  {m.roundTrips}회 왕복 · 거부 {m.rejected}
                </small>
              </span>

              <span className="ag-cell-backers num">
                <b>{(live?.backers ?? 0).toLocaleString()}</b>
                <small>demo</small>
              </span>

              <span className="ag-cell-cta">
                <Link href={`/agent/${a.agentId}/backtest`} className="btn ghost sm">
                  백테스트
                </Link>
                <button type="button" className="btn primary sm" onClick={() => onDelegateClick(a.agentId)}>
                  맡기기
                </button>
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="ag-foot-note">
        점수는 <b>수익률 30 · 위험조정 30 · 일관성 20 · 최근추세 20</b>. 점수 링에 마우스를 올리면 분해가 보여요.
        모든 숫자는 {WINDOW_LABEL[window]} 동안의 실제 시세로 다시 돌려본 결과이며, 백커 수는 데모 시드값입니다.
      </p>
    </div>
  );
}

export function HookBanner({
  window,
  onDelegateClick,
}: {
  window: BacktestWindow;
  onDelegateClick: (agentId: string) => void;
}) {
  const board = useReplayBoard(window);
  if (!board.data) return null;
  const top = sortAgents(board.data.agents, "score")[0];
  if (!top) return null;
  const m = top.metrics;
  return (
    <div className="ag-hook">
      <span className="ag-hook-txt">
        <span className="ag-hook-lead">처음이세요?</span>
        <AgentCharacter agentId={top.agentId} size={26} label={AGENT_NAME[top.agentId]} />
        <b>{AGENT_NAME[top.agentId]}</b>가 이번 시즌 종합 1위 ·{" "}
        <Pnl pct={m.roiPct} d={1} /> · {usd(board.data.capital)} 넣었으면 지금 <b className="num">{usd(m.finalEquity)}</b>
      </span>
      <span className="ag-hook-cta">
        <Link href={`/agent/${top.agentId}`} className="btn ghost sm">
          전적 보기
        </Link>
        <button type="button" className="btn primary sm" onClick={() => onDelegateClick(top.agentId)}>
          바로 맡기기 →
        </button>
      </span>
    </div>
  );
}
