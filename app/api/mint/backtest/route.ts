import { NextResponse } from "next/server";
import { replayStrategy } from "@/lib/live/replaySignal";
import type { StrategyConfig } from "@/lib/live/strategyLogic";

// TheZoneAgora/MAIN BE/app/testing/mock_agent.py 계약을 그대로 따르는 MINT 참조 구현.
// BE(agent_backtest_client.py)가 POST {endpoint_url}/backtest 로 과거 캔들을 보내면,
// "그 구간에서 이 전략이라면 언제 샀다/팔았다"를 {signals:[{open_time, action}]}로
// 돌려준다 — 실시간 시그널이 아니라 백테스트 오라클(느린 시계 채점용).
//
// 지표 로직은 lib/live/strategyLogic.ts(contrarian)를 그대로 재사용한다 — 심볼이
// 바뀌어도 지표 계산은 동일하다는 원칙 그대로. 이건 진짜 MK2(Go, NPD+Smoothed HA+
// BB(0.6σ)+StochRSI) 자리에 넣는 자리표시자다 — 실제 로직으로 교체하려면 이 파일의
// STRATEGY만 바꾸면 됨.
const STRATEGY: StrategyConfig = { agentId: "mint", strategy: "contrarian", symbol: "ETHUSDT" };

interface IncomingCandle {
  open_time: string;
  close: string | number;
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { ohlcv?: IncomingCandle[] };
  const candles = body.ohlcv;
  if (!Array.isArray(candles) || candles.length === 0) {
    return NextResponse.json({ error: "ohlcv must be a non-empty array" }, { status: 422 });
  }

  const closes = candles.map((c) => Number(c.close));
  const result = replayStrategy(STRATEGY, { ETHUSDT: closes });

  const signals = result.signals
    .filter((s) => s.verdict === "VERIFIED")
    .map((s) => ({ open_time: candles[s.index].open_time, action: s.side }));

  return NextResponse.json({ signals });
}
