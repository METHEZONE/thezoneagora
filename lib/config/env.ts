// Env-driven config for the Sui vault integration. See .omc/specs/deep-interview-agora-vault-userside.md
//
// Vercel(웹 대시보드로 붙여넣은 값)이 NEXT_PUBLIC_VAULT_MODE="real\n"처럼 끝에 개행을
// 끼워 넣은 적이 있었다 — `"real"===VAULT_MODE`가 항상 false가 되어 real 모드가
// 한 번도 켜지지 않고 조용히 mock으로만 도는 사고가 있었다(2026-09-19 발견).
// 값 자체도 Move 타입 인자 문자열(`${fiat},${crypto}`)에 그대로 꽂히므로 trim 없이는
// 나중에 real 모드가 켜져도 모든 PTB가 깨진 타입 태그로 실패한다. 그래서 모든
// NEXT_PUBLIC_* 문자열은 여기서 한 번만 trim하고, 빈 문자열은 undefined로 정규화한다.
function cleanEnv(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export const AGENT_MARKET_PACKAGE_ID =
  cleanEnv(process.env.NEXT_PUBLIC_AGENT_MARKET_PACKAGE_ID) ??
  "0x7dcf1c6495682131bcf3a41d4723f7422ca4d49aadaed5d8bc9c2e4a683deb26";

export const AGORA_AGENT_OPERATOR = cleanEnv(process.env.NEXT_PUBLIC_AGORA_AGENT_OPERATOR);

export const AGORA_FIAT_COIN_TYPE = cleanEnv(process.env.NEXT_PUBLIC_AGORA_FIAT_COIN_TYPE);

export const AGORA_CRYPTO_COIN_TYPE =
  cleanEnv(process.env.NEXT_PUBLIC_AGORA_CRYPTO_COIN_TYPE) ?? "0x2::sui::SUI";

// Circle 공식 testnet USDC (Sui). 실제 RPC로 suix_getCoinMetadata 조회해 확인함
// (decimals 6, symbol USDC, issuer Circle) — 2026-09-01 검증.
// https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui
export const TESTNET_USDC_COIN_TYPE =
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

// Sui Foundation 공식 testnet 풀노드(fullnode.testnet.sui.io)는 2026-07 말부터
// JSON-RPC를 껐다(gRPC/GraphQL로 이전 중이고, dapp-kit 1.1.17 최신판은 아직
// JSON-RPC 클라이언트 타입에 고정돼 있어 gRPC로 못 바꾼다 — 생태계가 따라잡을
// 때까지 임시로 여전히 JSON-RPC를 서빙하는 서드파티 퍼블릭 노드로 우회한다.
// publicnode.com 엔드포인트는 suix_getCoinMetadata/sui_getObject로 직접 확인함.
export const TESTNET_RPC_URL =
  cleanEnv(process.env.NEXT_PUBLIC_SUI_TESTNET_RPC_URL) ?? "https://sui-testnet-rpc.publicnode.com";

export type VaultMode = "mock" | "real";

const VAULT_MODE = (cleanEnv(process.env.NEXT_PUBLIC_VAULT_MODE) as VaultMode | undefined) ?? "mock";

// Real mode requires both the agent operator and fiat coin type to be configured;
// otherwise fall back to mock so the app never silently calls a misconfigured contract.
export function resolvedVaultMode(): VaultMode {
  if (VAULT_MODE === "real" && AGORA_AGENT_OPERATOR && AGORA_FIAT_COIN_TYPE) {
    return "real";
  }
  return "mock";
}

/** Agora가 체결 시점에 FiatT로 징수하는 거래 수수료 (bps).
 *  contract/sui-contract/sources/vault/trading_fee.move 의 TRADING_FEE_BPS와 같아야 한다.
 *  온체인 상수라 여기서 바꿔도 실제 징수액은 변하지 않는다 — 표시용이다. */
export const TRADING_FEE_BPS = 10;

/** 표시용 백분율 문자열. 10bps -> "0.1%" */
export function tradingFeePercentLabel(): string {
  return `${(TRADING_FEE_BPS / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** 체결 금액에 대한 수수료를 추정한다. 실제 청구는 온체인에서 내림으로 계산되므로
 *  표시값이 1 단위 어긋날 수 있다. 정확한 값은 이벤트의 fee_charged를 쓸 것. */
export function estimateTradingFee(amount: bigint): bigint {
  return (amount * BigInt(TRADING_FEE_BPS)) / 10_000n;
}
