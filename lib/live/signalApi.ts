import { fetchKlinesForSymbols, KLINES_INTERVAL, KLINES_LIMIT } from "@/lib/live/klines";
import { replayStrategy, type ReplaySignal } from "@/lib/live/replaySignal";
import { requiredSymbolsFor, STRATEGY_CONFIGS, type StrategyConfig } from "@/lib/live/strategyLogic";
import type { TickerSymbol } from "@/lib/live/types";
import { storeJsonBlob } from "@/lib/walrus/client";

export const DISCLAIMER =
  "실시간 시세 기반 페이퍼 트레이딩 시뮬레이션입니다 — 실제 자금 거래가 아닙니다. " +
  "price_source는 Binance 공개 klines이고, 판단(전략) 로직은 이 프로젝트에서 만든 " +
  "일반 휴리스틱입니다(고객사 실전략과 무관).";

function serializeSignal(signal: ReplaySignal) {
  return {
    signal_id: signal.id,
    side: signal.side,
    symbol: signal.symbol,
    price: signal.price,
    risk_score_bps: signal.riskScoreBps,
    verdict: signal.verdict,
    reason: signal.rejectReason ?? null,
    timestamp: new Date(signal.timestamp).toISOString(),
  };
}

export interface AgentSignalPayload {
  agent_id: string;
  strategy: string;
  symbol: string;
  data_source: string;
  as_of: string;
  equity_usd: number;
  roi_pct: number;
  current_position: { side: "LONG"; entry_price: number; quantity: number } | null;
  latest_signal: ReturnType<typeof serializeSignal> | null;
  recent_signals: ReturnType<typeof serializeSignal>[];
  disclaimer: string;
  /** 이 조회 결과를 Walrus(Sui 탈중앙 스토리지)에 저장한 기록 — 위조 불가능한 감사
   *  로그로 쓴다. 저장이 실패해도(네트워크 등) 시그널 조회 자체는 막지 않는다. */
  walrus: { blob_id: string; url: string } | null;
}

function findConfig(agentId: string): StrategyConfig | null {
  return STRATEGY_CONFIGS.find((c) => c.agentId === agentId) ?? null;
}

async function toPayload(
  cfg: StrategyConfig,
  histories: Partial<Record<TickerSymbol, number[]>>
): Promise<AgentSignalPayload> {
  const result = replayStrategy(cfg, histories);
  const sorted = [...result.signals].sort((a, b) => b.index - a.index);
  const latest = sorted[0] ?? null;

  const payload: Omit<AgentSignalPayload, "walrus"> = {
    agent_id: result.agentId,
    strategy: result.strategy,
    symbol: result.symbol,
    data_source: `binance_klines_${KLINES_INTERVAL}_last${KLINES_LIMIT}`,
    as_of: new Date().toISOString(),
    equity_usd: Math.round(result.equity * 100) / 100,
    roi_pct: Math.round(result.roiPct * 100) / 100,
    current_position: result.position
      ? {
          side: "LONG",
          entry_price: result.position.entryPrice,
          quantity: result.position.quantity,
        }
      : null,
    latest_signal: latest ? serializeSignal(latest) : null,
    recent_signals: sorted.slice(0, 10).map(serializeSignal),
    disclaimer: DISCLAIMER,
  };

  // 조회 결과를 Walrus에 감사 로그로 남긴다 — 나중에 "그때 정말 그 판단을 냈는지"를
  // 위조 불가능하게 검증할 수 있다. 스토리지가 잠깐 막혀도 시그널 조회는 계속 돼야
  // 하므로 실패는 삼키고 walrus를 null로 둔다.
  let walrus: AgentSignalPayload["walrus"] = null;
  try {
    const stored = await storeJsonBlob(payload);
    walrus = { blob_id: stored.blobId, url: stored.url };
  } catch {
    walrus = null;
  }

  return { ...payload, walrus };
}

/** 단일 에이전트 시그널 조회. agentId가 없으면 null. */
export async function buildAgentSignal(agentId: string): Promise<AgentSignalPayload | null> {
  const cfg = findConfig(agentId);
  if (!cfg) return null;
  const histories = await fetchKlinesForSymbols(requiredSymbolsFor(cfg));
  return toPayload(cfg, histories);
}

/** 전 에이전트 시그널 조회 — 심볼별 klines 호출을 공유해서 중복 요청을 없앤다. */
export async function buildAllSignals(): Promise<AgentSignalPayload[]> {
  const allSymbols = STRATEGY_CONFIGS.flatMap(requiredSymbolsFor);
  const histories = await fetchKlinesForSymbols(allSymbols);
  return Promise.all(STRATEGY_CONFIGS.map((cfg) => toPayload(cfg, histories)));
}

export function listAgentIds(): string[] {
  return STRATEGY_CONFIGS.map((c) => c.agentId);
}
