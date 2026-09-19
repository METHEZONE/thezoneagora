import { NextResponse } from "next/server";
import { replayStrategy } from "@/lib/live/replaySignal";
import type { StrategyConfig } from "@/lib/live/strategyLogic";
import { storeJsonBlob } from "@/lib/walrus/client";

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
  const body = (await req.json()) as {
    symbol?: string;
    timeframe?: string;
    ohlcv?: IncomingCandle[];
  };
  const candles = body.ohlcv;
  if (!Array.isArray(candles) || candles.length === 0) {
    return NextResponse.json({ error: "ohlcv must be a non-empty array" }, { status: 422 });
  }

  const closes = candles.map((c) => Number(c.close));
  const result = replayStrategy(STRATEGY, { ETHUSDT: closes });

  const signals = result.signals
    .filter((s) => s.verdict === "VERIFIED")
    .map((s) => ({ open_time: candles[s.index].open_time, action: s.side }));

  // BE의 AgentBacktestResponse는 extra="forbid"라 응답 바디에 필드를 추가하면
  // BE가 거절한다. 그래서 실제 백테스트 입력(캔들 전체, "큰 데이터")과 산출된
  // 시그널을 Walrus에 통째로 저장하고, blob_id는 응답 바디가 아니라 헤더로만
  // 노출한다 — "이 백테스트가 정확히 이 데이터로 돌았다"를 나중에도 위조 없이
  // 검증할 수 있는 감사 로그. 저장 실패는 삼키고 계약대로 응답만 내려준다.
  let walrusBlobId: string | null = null;
  try {
    const stored = await storeJsonBlob({
      symbol: body.symbol,
      timeframe: body.timeframe,
      ohlcv: candles,
      signals,
      ranAt: new Date().toISOString(),
    });
    walrusBlobId = stored.blobId;
  } catch {
    walrusBlobId = null;
  }

  return NextResponse.json(
    { signals },
    walrusBlobId ? { headers: { "X-Walrus-Blob-Id": walrusBlobId } } : undefined
  );
}
