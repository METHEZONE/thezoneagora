"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import type { Transaction } from "@mysten/sui/transactions";
import { getVaultDataSource } from "@/lib/vault";
import type {
  VaultActivityEvent,
  VaultState,
} from "@/lib/vault/types";
import type {
  CreateVaultParams,
  EmergencyLiquidateAllParams,
  OwnedVaultSummary,
  VaultDataSource,
} from "@/lib/vault/VaultDataSource";
import { getLiveStrategyEngine } from "@/lib/live/LiveStrategyEngine";

const MAX_FEED_LENGTH = 200;

// 게스트(지갑 미연결) 데모 볼트는 mint 전략 하나로 고정돼 있다.
const GUEST_STRATEGY_ID = "mint";

export interface UseVaultResult {
  /** 연결된 지갑 주소. 미연결이면 null → mint 전략만 게스트 데모 볼트 표시. */
  owner: string | null;
  /** 게스트 또는 내 볼트 상태. 로딩 전엔 null. */
  vault: VaultState | null;
  /** 이 지갑에 이 전략 볼트가 있는지 (게스트+mint는 항상 true — 데모 볼트가 있으므로). */
  hasVault: boolean | null;
  loading: boolean;
  /** 최신순 활동 피드 (구독으로 실시간 누적). */
  activity: VaultActivityEvent[];
  source: VaultDataSource;
  actions: {
    createVault: (params: CreateVaultParams) => Promise<VaultState>;
    depositMore: (amount: bigint) => Promise<VaultState>;
    withdrawAmount: (amount: bigint) => Promise<VaultState>;
    withdrawCrypto: (amount: bigint) => Promise<VaultState>;
    withdrawAll: () => Promise<VaultState>;
    revokeAgent: () => Promise<VaultState>;
    reactivateAgent: () => Promise<VaultState>;
    setReduceOnly: (reduceOnly: boolean) => Promise<VaultState>;
    configurePolicy: (
      policy: Parameters<VaultDataSource["configurePolicy"]>[2]
    ) => Promise<VaultState>;
    emergencyLiquidateAll: (
      params: EmergencyLiquidateAllParams
    ) => Promise<VaultState>;
    emergencyPauseAndWithdraw: () => Promise<VaultState>;
    refresh: () => Promise<void>;
  };
}

/**
 * 볼트 화면들이 공유하는 단일 훅. 지갑 1개가 전략(strategyId)별로 별도 볼트를 가질 수
 * 있어 어떤 전략을 보고 있는지 항상 명시해야 한다.
 * - 지갑 미연결 → strategyId가 "mint"일 때만 게스트 데모 볼트, 그 외엔 볼트 없음
 * - 지갑 연결 → 해당 owner·strategyId의 볼트 (없으면 hasVault=false, 온보딩 유도)
 * - LiveStrategyEngine을 mock 소스에 attach해 이 전략의 시그널 파이프라인이 피드로 흐르게 한다.
 */
export function useVault(strategyId: string): UseVaultResult {
  const account = useCurrentAccount();
  const owner = account?.address ?? null;
  const source = useMemo(() => getVaultDataSource(), []);

  // real(SuiVaultSource) 모드에서 createVault/depositMore 등이 실제로 지갑 서명을
  // 요청하려면 dApp Kit의 서명 콜백을 소스에 주입해야 한다. 이 배선이 아예 없어서
  // 지갑 서명 팝업이 뜨지도 않고 requireSigner()가 매번 조용히 실패해
  // "볼트 생성에 실패했습니다"만 보이는 버그가 있었다 (OnboardingWizard의 catch가
  // 실제 에러 메시지를 삼켜서 원인이 안 보였다).
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showRawEffects: true, showObjectChanges: true },
      }),
  });

  useEffect(() => {
    const maybeSuiSource = source as unknown as {
      setSignAndExecute?: (
        fn:
          | ((transaction: Transaction) => Promise<{
              digest: string;
              objectChanges?: Array<{
                type: string;
                objectType?: string;
                objectId?: string;
              }>;
            }>)
          | null
      ) => void;
    };
    if (typeof maybeSuiSource.setSignAndExecute !== "function") return;
    if (!owner) {
      maybeSuiSource.setSignAndExecute(null);
      return;
    }
    maybeSuiSource.setSignAndExecute(async (transaction) => {
      const result = await signAndExecuteTransaction({ transaction });
      return result as unknown as {
        digest: string;
        objectChanges?: Array<{
          type: string;
          objectType?: string;
          objectId?: string;
        }>;
      };
    });
    return () => maybeSuiSource.setSignAndExecute?.(null);
  }, [source, owner, signAndExecuteTransaction]);

  const [vault, setVault] = useState<VaultState | null>(null);
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<VaultActivityEvent[]>([]);

  // 라이브 엔진을 볼트 소스에 연결 (mock 전용 주입 지점, 있을 때만).
  useEffect(() => {
    const maybeAttach = source as unknown as {
      attachEngine?: (
        engine: unknown,
        options: { owner?: string | null; strategyId: string }
      ) => void;
    };
    if (typeof maybeAttach.attachEngine === "function") {
      maybeAttach.attachEngine(getLiveStrategyEngine(), { owner, strategyId });
    }
  }, [source, owner, strategyId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (owner) {
        const exists = await source.hasVault(owner, strategyId);
        setHasVault(exists);
        setVault(exists ? await source.getVaultState(owner, strategyId) : null);
      } else if (strategyId === GUEST_STRATEGY_ID && source.getGuestVault) {
        setHasVault(true);
        setVault(await source.getGuestVault(strategyId));
      } else {
        setHasVault(false);
        setVault(null);
      }
      // 저장된 이력으로 피드를 시드해 첫 진입 시 빈 화면을 피한다 (mock 전용).
      if (source.getActivityHistory) {
        setActivity(await source.getActivityHistory(owner, strategyId));
      }
    } finally {
      setLoading(false);
    }
  }, [owner, strategyId, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 상태/활동 실시간 구독. 같은 strategyId + owner(또는 게스트) 이벤트만 반영.
  useEffect(() => {
    return source.subscribe((event) => {
      if (event.strategyId !== strategyId) return;
      const mine = owner ? event.owner === owner : event.owner === null;
      if (!mine) return;
      setVault(event.state);
      if (event.activity) {
        setActivity((prev) =>
          [event.activity as VaultActivityEvent, ...prev].slice(0, MAX_FEED_LENGTH)
        );
      }
    });
  }, [source, owner, strategyId]);

  const actions = useMemo(
    () => ({
      createVault: async (params: CreateVaultParams) => {
        if (!owner) throw new Error("지갑을 먼저 연결해 주세요.");
        const state = await source.createVault(owner, strategyId, params);
        setHasVault(true);
        setVault(state);
        return state;
      },
      depositMore: (amount: bigint) =>
        mustOwner(owner, (o) => source.depositMore(o, strategyId, amount)),
      withdrawAmount: (amount: bigint) =>
        mustOwner(owner, (o) => source.withdrawAmount(o, strategyId, amount)),
      withdrawCrypto: (amount: bigint) =>
        mustOwner(owner, (o) => source.withdrawCrypto(o, strategyId, amount)),
      withdrawAll: () => mustOwner(owner, (o) => source.withdrawAll(o, strategyId)),
      revokeAgent: () => mustOwner(owner, (o) => source.revokeAgent(o, strategyId)),
      reactivateAgent: () =>
        mustOwner(owner, (o) => source.reactivateAgent(o, strategyId)),
      setReduceOnly: (reduceOnly: boolean) =>
        mustOwner(owner, (o) => source.setReduceOnly(o, strategyId, reduceOnly)),
      configurePolicy: (policy: Parameters<VaultDataSource["configurePolicy"]>[2]) =>
        mustOwner(owner, (o) => source.configurePolicy(o, strategyId, policy)),
      emergencyLiquidateAll: (params: EmergencyLiquidateAllParams) =>
        mustOwner(owner, (o) => source.emergencyLiquidateAll(o, strategyId, params)),
      emergencyPauseAndWithdraw: () =>
        mustOwner(owner, (o) => source.emergencyPauseAndWithdraw(o, strategyId)),
      refresh,
    }),
    [owner, strategyId, source, refresh]
  );

  return { owner, vault, hasVault, loading, activity, source, actions };
}

/** owner가 만든 모든 전략의 볼트 요약 목록. 잔액 미리보기용 — 라이브 엔진은 attach하지 않는다. */
export function useMyVaults(): {
  vaults: OwnedVaultSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const account = useCurrentAccount();
  const owner = account?.address ?? null;
  const source = useMemo(() => getVaultDataSource(), []);

  const [vaults, setVaults] = useState<OwnedVaultSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!owner) {
      setVaults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setVaults(await source.listVaults(owner));
    } finally {
      setLoading(false);
    }
  }, [owner, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!owner) return;
    return source.subscribe((event) => {
      if (event.owner !== owner) return;
      setVaults((prev) => {
        const idx = prev.findIndex((v) => v.strategyId === event.strategyId);
        const entry = { strategyId: event.strategyId, state: event.state };
        if (idx === -1) return [...prev, entry];
        const next = [...prev];
        next[idx] = entry;
        return next;
      });
    });
  }, [source, owner]);

  return { vaults, loading, refresh };
}

function mustOwner(
  owner: string | null,
  fn: (owner: string) => Promise<VaultState>
): Promise<VaultState> {
  if (!owner) return Promise.reject(new Error("지갑을 먼저 연결해 주세요."));
  return fn(owner);
}
