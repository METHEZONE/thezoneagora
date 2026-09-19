// 에이전트 상세 3종(크립토/대체 전략/MINT 아카이브)이 공유하는 헤더 배지 줄.
// 큰 h1과 같은 줄에 배지를 욱여넣으면(예전 방식) 좁은 화면에서 줄바꿈 지점이 애매해
// 배지끼리 거의 붙어버렸다 — h1은 자기 줄, 배지는 그 아래 별도 줄로 분리해 항상 여유 있게 감싼다.

import type { AgentKind } from "@/lib/backtest/engine";
import { KIND_COLOR, KIND_SHORT } from "@/components/agent/meta";

export function HeroBadges({
  kind,
  strategyLabel,
  accent,
  sourceLabel,
  real,
}: {
  kind: AgentKind;
  strategyLabel: string;
  accent: string;
  sourceLabel: string;
  real?: boolean;
}) {
  return (
    <div className="ag-hero-badges">
      {real && <span className="tag real">REAL · 아카이브</span>}
      <span className="ag-kind num big" style={{ "--kc": KIND_COLOR[kind] } as React.CSSProperties}>
        {KIND_SHORT[kind]}
      </span>
      <span className="ag-chip" style={{ "--c": accent } as React.CSSProperties}>
        {strategyLabel}
      </span>
      <span className="ag-sym num">{sourceLabel}</span>
    </div>
  );
}
