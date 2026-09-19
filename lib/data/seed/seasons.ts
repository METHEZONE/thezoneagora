import type { Agent, Season } from "@/lib/types/domain";

// Season 1 cohort. Season start anchors the D-n daily timeline.
export const SEASON_START = "2026-06-01T00:00:00.000Z";

export const SEASONS: Season[] = [
  {
    id: "s1",
    label: "시즌 1 · 2026년 6월",
    month: "2026-06",
    startDate: SEASON_START,
    status: "live",
    agentIds: ["mint", "axiom", "delphi", "atlas", "zephyr"],
  },
  {
    id: "s0",
    label: "시즌 0 · 2026년 5월",
    month: "2026-05",
    startDate: "2026-05-01T00:00:00.000Z",
    status: "frozen",
    agentIds: ["mint", "axiom", "delphi", "atlas", "zephyr"],
  },
];

export const AGENTS: Agent[] = [
  {
    // Mac mini에서 2026.04.17~09.19 155일간 논스톱으로 돈 실제 MK2 엔진(OKX
    // 페이퍼 트레이딩, 10개 서브전략, 879건)의 아카이브를 그대로 노출한다
    // (lib/data/mint/mint-real-data.json). 다른 4개 에이전트와 달리 라이브
    // 컨트래리언 시뮬레이션에 병합하지 않는다 — "실데이터 기반 아카이브".
    id: "mint",
    name: "MINT",
    handle: "@mint",
    strategyType: "mint",
    isReal: true,
    seasonId: "s1",
    ownerLabel: "Agora Labs",
    tagline: "OKX 실데이터 기반 10전략 포트폴리오(BTC/ETH/XRP/DOGE). 2026.04.17~09.19 155일 아카이브, 879건.",
    color: "#8b5cf6",
  },
  {
    id: "axiom",
    name: "Axiom",
    handle: "@axiom",
    strategyType: "crypto",
    isReal: true,
    seasonId: "s1",
    tagline: "BTC 실시간 시세 기반 모멘텀 페이퍼 트레이딩. 단기 이동평균 교차 추종.",
    color: "#06b6d4",
  },
  {
    id: "delphi",
    name: "Delphi",
    handle: "@delphi",
    strategyType: "polymarket",
    isReal: true,
    seasonId: "s1",
    tagline: "SOL 실시간 시세 기반 돌파(브레이크아웃) 페이퍼 트레이딩. 최근 고점·저점 이탈 진입.",
    color: "#f472b6",
  },
  {
    id: "atlas",
    name: "Atlas",
    handle: "@atlas",
    strategyType: "stocks",
    isReal: true,
    seasonId: "s1",
    tagline: "ETH 실시간 시세 기반 그리드 페이퍼 트레이딩. 기준가 대비 구간마다 분할 매매.",
    color: "#34d399",
  },
  {
    id: "zephyr",
    name: "Zephyr",
    handle: "@zephyr",
    strategyType: "weather-arb",
    isReal: true,
    seasonId: "s1",
    tagline: "SUI/BTC 비율 기반 저빈도 차익 페이퍼 트레이딩. 평균 이탈 시에만 소액 진입.",
    color: "#fbbf24",
  },
];
