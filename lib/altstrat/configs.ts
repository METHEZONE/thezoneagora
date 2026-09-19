import type { AltAgentConfig, AltKind } from "@/lib/altstrat/types";

// 크립토 5종(lib/live/strategyLogic.ts STRATEGY_CONFIGS) 옆에 서는 대체 전략 5종.
// 에이전트 id는 캐릭터(components/arena/characters.tsx)·시드(lib/data/seed/seasons.ts)·
// 이름표(components/agent/meta.ts)와 1:1이어야 한다.
export const ALT_CONFIGS: AltAgentConfig[] = [
  {
    agentId: "pythia",
    kind: "polymarket-copy",
    venue: "POLYMARKET",
    strategy: "poly-copy-macro",
    seed: 7101,
  },
  {
    agentId: "augur",
    kind: "polymarket-copy",
    venue: "POLYMARKET",
    strategy: "poly-copy-sports",
    seed: 7102,
  },
  {
    agentId: "kestrel",
    kind: "weather-arb",
    venue: "KALSHI",
    strategy: "weather-bracket-arb",
    seed: 7201,
  },
  {
    agentId: "sigma",
    kind: "stocks",
    venue: "US-EQ",
    strategy: "equity-momentum",
    seed: 7301,
  },
  {
    agentId: "vega",
    kind: "stocks",
    venue: "US-EQ",
    strategy: "etf-rotation",
    seed: 7302,
  },
];

export function altConfigFor(agentId: string): AltAgentConfig | undefined {
  return ALT_CONFIGS.find((c) => c.agentId === agentId);
}

export function isAltKind(kind: string): kind is AltKind {
  return kind === "polymarket-copy" || kind === "weather-arb" || kind === "stocks";
}
