"use client";

// design/agora-arena.html의 renderRace() 포팅 — 레인 = 에이전트 수(10), 위치는 수익률을 16%~82%로 정규화.
// 숫자는 ArenaHome이 mergeBoard()로 덧입힌 느린 시계(선택한 창) 값이라 아래 리더보드와 항상 같다.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AgentCharacter } from "@/components/arena/characters";
import { fmtPct } from "@/components/arena/format";
import type { ArenaAgent } from "@/components/arena/useArenaAgents";
import { WINDOWS, type BacktestWindow } from "@/lib/backtest/klines";
import { KIND_COLOR, KIND_LABEL, KIND_ORDER, KIND_SHORT, WINDOW_LABEL, WINDOW_SHORT } from "@/components/agent/meta";
import type { AgentKind } from "@/lib/backtest/engine";

export function RaceWindowSeg({
  window,
  onChange,
  compact = false,
}: {
  window: BacktestWindow;
  onChange: (w: BacktestWindow) => void;
  compact?: boolean;
}) {
  return (
    <div className="ag-seg" role="group" aria-label="기간">
      {WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          className={`ag-seg-btn num${window === w ? " on" : ""}`}
          onClick={() => onChange(w)}
          aria-pressed={window === w}
        >
          {compact ? WINDOW_SHORT[w] : WINDOW_LABEL[w]}
        </button>
      ))}
    </div>
  );
}

export function RaceTrack({
  agents,
  window,
  onWindowChange,
  loading,
  kindFilter,
  onKindFilter,
}: {
  agents: ArenaAgent[];
  window: BacktestWindow;
  onWindowChange: (w: BacktestWindow) => void;
  loading?: boolean;
  kindFilter: AgentKind | "all";
  onKindFilter: (k: AgentKind | "all") => void;
}) {
  const shown = kindFilter === "all" ? agents : agents.filter((a) => a.kind === kindFilter);
  const ranked = [...agents].sort((a, b) => b.score - a.score || b.ret - a.ret);
  const rets = shown.map((a) => a.ret);
  const min = Math.min(...rets, 0);
  const max = Math.max(...rets, 0);
  const span = max - min || 1;
  const dense = shown.length > 6;

  const prevRet = useRef<Record<string, number>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const changed: string[] = [];
    for (const a of agents) {
      if (prevRet.current[a.id] !== undefined && prevRet.current[a.id] !== a.ret) changed.push(a.id);
      prevRet.current[a.id] = a.ret;
    }
    if (changed.length === 0) return;
    setRunningIds((prev) => {
      const next = new Set(prev);
      changed.forEach((id) => next.add(id));
      return next;
    });
    const t = setTimeout(() => {
      setRunningIds((prev) => {
        const next = new Set(prev);
        changed.forEach((id) => next.delete(id));
        return next;
      });
    }, 1700);
    return () => clearTimeout(t);
  }, [agents]);

  const kinds = KIND_ORDER.filter((k) => agents.some((a) => a.kind === k));

  return (
    <div className="track-block">
      <div className="track-controls">
        <div className="track-kinds" role="group" aria-label="전략 종류">
          <button
            type="button"
            className={`kind-chip${kindFilter === "all" ? " on" : ""}`}
            onClick={() => onKindFilter("all")}
          >
            전체 <b className="num">{agents.length}</b>
          </button>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className={`kind-chip${kindFilter === k ? " on" : ""}`}
              style={{ "--kc": KIND_COLOR[k] } as React.CSSProperties}
              onClick={() => onKindFilter(k)}
            >
              <i /> {KIND_LABEL[k]} <b className="num">{agents.filter((a) => a.kind === k).length}</b>
            </button>
          ))}
        </div>
        <div className="track-window">
          <span className="track-window-k">
            {loading ? "불러오는 중…" : `${WINDOW_LABEL[window]} 수익률`}
          </span>
          <RaceWindowSeg window={window} onChange={onWindowChange} compact />
        </div>
      </div>

      <div className={`track${dense ? " dense" : ""}${loading ? " is-loading" : ""}`} id="track">
        <div className="finish" />
        <div className="finish-label">FINISH</div>
        <div className="zero-line" style={{ left: `${16 + ((0 - min) / span) * 66}%` }} title="0%" />
        {shown.map((a) => {
          const rank = ranked.indexOf(a) + 1;
          const pos = 16 + ((a.ret - min) / span) * 66;
          const running = runningIds.has(a.id);
          return (
            <div className={`lane${rank === 1 ? " leadlane" : ""}`} key={a.id}>
              <div className="lane-glow" />
              <span className="lane-kind num" style={{ "--kc": KIND_COLOR[a.kind] } as React.CSSProperties}>
                {KIND_SHORT[a.kind]}
              </span>
              <Link
                href={`/agent/${a.id}`}
                className={`racer${running ? " running" : ""}${rank === 1 ? " lead" : ""}`}
                style={{ left: `${pos}%` }}
                aria-label={`${a.name} 상세 보기`}
                prefetch={false}
              >
                <div className="char">
                  <AgentCharacter agentId={a.id} size={dense ? 46 : 58} running={running} label={a.name} />
                  <span className="rankbadge num">{rank}</span>
                  <span className="speed">
                    <span />
                    <span />
                  </span>
                </div>
                <span className="nm">{a.name}</span>
                <span className={`rt num ${a.ret >= 0 ? "up" : "dn"}`}>{fmtPct(a.ret)}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
