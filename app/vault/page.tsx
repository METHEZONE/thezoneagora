"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { AGENTS } from "@/lib/data/seed/seasons";
import { useMyVaults } from "@/lib/vault/useVault";
import { StrategyCard } from "@/components/vault/StrategyCard";
import { VaultDetail } from "@/components/vault/VaultDetail";
import { CharacterRow } from "@/components/vault/CharacterRow";

const GUEST_STRATEGY_ID = "mint";

export default function VaultPage() {
  const account = useCurrentAccount();
  const owner = account?.address ?? null;

  return owner ? <ConnectedVaultList /> : <GuestVaultView />;
}

/** 지갑 미연결: 기존 mint 게스트 데모 볼트 + 나머지 4개 전략 미리보기. */
function GuestVaultView() {
  const otherAgents = AGENTS.filter((agent) => agent.id !== GUEST_STRATEGY_ID);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-arena-black">
      <div className="mx-auto max-w-[1200px] px-5 pt-10 lg:px-6">
        <section className="mb-8 rounded-2xl border border-white/10 bg-surface-dark p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
            5개 전략 둘러보기
          </div>
          <p className="mt-1 text-[13px] text-muted-light">
            지갑을 연결하면 아래 전략에도 각각 따로 배분할 수 있어요. 지금은 mint 데모 볼트만
            체험할 수 있습니다.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {otherAgents.map((agent) => (
              <StrategyCard
                key={agent.id}
                agentId={agent.id}
                name={agent.name}
                tagline={agent.tagline}
                href={`/vault/onboarding?strategy=${agent.id}`}
                ctaLabel="지갑 연결하고 배분하기"
              />
            ))}
          </div>
        </section>
      </div>
      <VaultDetail strategyId={GUEST_STRATEGY_ID} />
    </main>
  );
}

/** 지갑 연결: 5개 전략 전부를 카드로 나열. 볼트가 있으면 잔액 요약 + 관리 링크. */
function ConnectedVaultList() {
  const { vaults, loading } = useMyVaults();

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-arena-black">
        <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-6">
          <p className="text-[13px] text-muted-light">볼트 정보를 불러오는 중…</p>
        </div>
      </main>
    );
  }

  const vaultByStrategy = new Map(vaults.map((v) => [v.strategyId, v.state]));

  return (
    <main className="min-h-[calc(100vh-64px)] bg-arena-black">
      <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-6">
        <header className="mb-6 flex items-center gap-4">
          <CharacterRow size={48} className="hidden md:flex" />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
              내 볼트
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-warm-ivory">
              전략별 배분
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent) => {
            const state = vaultByStrategy.get(agent.id);
            return (
              <StrategyCard
                key={agent.id}
                agentId={agent.id}
                name={agent.name}
                tagline={agent.tagline}
                vaultState={state}
                href={state ? `/vault/${agent.id}` : `/vault/onboarding?strategy=${agent.id}`}
                ctaLabel={state ? "관리하기" : "이 전략에 배분하기"}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}
