import { resolvedVaultMode } from "@/lib/config/env";
import { MockVaultSource } from "@/lib/vault/MockVaultSource";
import { SuiVaultSource } from "@/lib/vault/SuiVaultSource";
import type { VaultDataSource } from "@/lib/vault/VaultDataSource";

import { isDemoMode } from "@/lib/vault/demo";

// mock/real 싱글턴 팩토리. lib/data/index.ts의 getDataSource() 패턴을 그대로 따른다.
// 데모 모드(localStorage 플래그)가 켜져 있으면 env가 real이어도 mock 소스를 돌려준다 —
// Sui 지갑이 안 붙는 환경에서도 볼트 전체 흐름을 체험할 수 있어야 하기 때문.
const instances: Partial<Record<"mock" | "real", VaultDataSource>> = {};

export function getVaultDataSource(): VaultDataSource {
  const mode = isDemoMode() ? "mock" : resolvedVaultMode();
  const hit = instances[mode];
  if (hit) return hit;
  const created = mode === "real" ? new SuiVaultSource() : new MockVaultSource();
  instances[mode] = created;
  return created;
}

export type {
  CreateVaultParams,
  EmergencyLiquidateAllParams,
  OwnedVaultSummary,
  VaultDataEvent,
  VaultDataSource,
  VaultSubscriber,
} from "@/lib/vault/VaultDataSource";
export * from "@/lib/vault/types";
