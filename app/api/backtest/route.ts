import { NextResponse } from "next/server";
import { backtestAgent, parseCapital, parseWindow } from "@/lib/backtest/service";

// GET /api/backtest?agent=atlas&window=30d&capital=10000
// 단일 에이전트 풀 백테스트 — 캔들, 거래 전체, equity/hold 곡선, 지표, 점수.
export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  if (!agent) return NextResponse.json({ error: "agent 파라미터가 필요합니다." }, { status: 400 });
  try {
    const result = await backtestAgent(
      agent,
      parseWindow(url.searchParams.get("window")),
      parseCapital(url.searchParams.get("capital"))
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "백테스트에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: msg.includes("알 수 없는") ? 404 : 502 });
  }
}
