import { NextResponse } from "next/server";
import { parseCapital, parseWindow, replayAll } from "@/lib/backtest/service";

// GET /api/replay?window=7d|30d&capital=10000
// 느린 시계: 5개 에이전트를 Binance 1시간봉 위에서 결정론적으로 재생한 리더보드 요약.
// 누가 봐도 같은 숫자 — 리더보드 7D/30D 컬럼·AGORA 점수의 단일 출처.
export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const board = await replayAll(parseWindow(url.searchParams.get("window")), parseCapital(url.searchParams.get("capital")));
    return NextResponse.json(board, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "리플레이 계산에 실패했습니다." },
      { status: 502 }
    );
  }
}
