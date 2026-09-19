import { NextResponse } from "next/server";
import { assessRisk } from "@/lib/ai/riskAssessment";
import { buildAgentSignal } from "@/lib/live/signalApi";

// GET /api/signals/[agentId]/risk — "느린 시계": Agent의 실적을 LLM이 심사해
// risk_score_bps를 매긴다. 이 값이 온체인 UserVault.max_risk_score_bps와 비교되어
// 초과 시 거래를 자동 차단하는 게 원래 설계(PROGRESS.md §7) — 지금까지는 고정값
// 5000bps 스텁이었던 자리를 실제 LLM 판단으로 채운다.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  try {
    const signal = await buildAgentSignal(agentId);
    if (!signal) {
      return NextResponse.json({ error: `알 수 없는 agentId입니다: ${agentId}` }, { status: 404 });
    }
    const assessment = await assessRisk(signal);
    return NextResponse.json({
      agent_id: agentId,
      ...assessment,
      based_on: {
        roi_pct: signal.roi_pct,
        recent_signal_count: signal.recent_signals.length,
        as_of: signal.as_of,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "위험도 산출에 실패했습니다." },
      { status: 502 }
    );
  }
}
