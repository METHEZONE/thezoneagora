"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { AGENTS } from "@/lib/data/seed/seasons";
import { useMyVaults } from "@/lib/vault/useVault";
import { StrategyCard } from "@/components/vault/StrategyCard";
import { VaultDetail } from "@/components/vault/VaultDetail";
import { CharacterRow } from "@/components/vault/CharacterRow";
import { DemoDepositButton } from "@/components/vault/DemoDepositButton";
import { useDemoMode } from "@/lib/vault/useDemoMode";
import { DEMO_OWNER, setDemoMode } from "@/lib/vault/demo";

const GUEST_STRATEGY_ID = "mint";

export default function VaultPage() {
  const account = useCurrentAccount();
  const demo = useDemoMode();
  const owner = account?.address ?? (demo ? DEMO_OWNER : null);

  return owner ? <ConnectedVaultList demo={!account && demo} /> : <GuestVaultView />;
}

/** Sui 연결이 안 될 때의 탈출구 — 지갑 없이 임의 자금으로 mock 볼트 체험. */
function DemoDepositBanner({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${compact ? "mb-4" : "mb-6"} rounded-2xl border border-agora-orange/30 bg-agora-orange/10 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-agora-orange">Sui 지갑이 안 붙나요? · DEMO</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-light">
            지갑 없이 임의 자금 10,000 USDC를 예치해 입금·출금·긴급탈출·활동 피드까지 같은 볼트 흐름을 체험할 수 있어요. 데모
            볼트는 이 브라우저에만 저장됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoDepositButton
            strategyId={GUEST_STRATEGY_ID}
            amountUsdc={10_000}
            className="rounded-xl bg-agora-orange px-5 py-2.5 text-[13px] font-bold text-arena-black transition-opacity hover:opacity-90"
            label="임의로 10,000 USDC 예치하기 (demo)"
          />
        </div>
      </div>
    </section>
  );
}

/** 지갑 미연결: 기존 mint 게스트 데모 볼트 + 나머지 4개 전략 미리보기. */
function GuestVaultView() {
  const otherAgents = AGENTS.filter((agent) => agent.id !== GUEST_STRATEGY_ID);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-arena-black">
      <div className="mx-auto max-w-[1200px] px-5 pt-10 lg:px-6">
        <DemoDepositBanner />
        <section className="mb-8 rounded-2xl border border-white/10 bg-surface-dark p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
            10개 전략 둘러보기
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

/** 지갑 연결: 10개 전략 전부를 카드로 나열. 볼트가 있으면 잔액 요약 + 관리 링크. */
function ConnectedVaultList({ demo = false }: { demo?: boolean }) {
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
        {demo && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-agora-orange/30 bg-agora-orange/10 px-4 py-3">
            <p className="text-[13px] font-medium text-agora-orange">
              데모 모드 — 지갑 없이 mock 볼트를 쓰고 있어요. 각 전략 카드에서 임의 자금을 더 넣을 수 있습니다.
            </p>
            <button
              type="button"
              className="text-[12px] font-semibold text-warm-ivory underline decoration-white/30"
              onClick={() => setDemoMode(false)}
            >
              데모 종료
            </button>
          </div>
        )}
        <header className="mb-6 flex items-center gap-4">
          <CharacterRow size={48} className="hidden md:flex" />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
              {demo ? "내 볼트 · DEMO" : "내 볼트"}
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
              <div key={agent.id} className="flex flex-col gap-2">
                <StrategyCard
                  agentId={agent.id}
                  name={agent.name}
                  tagline={agent.tagline}
                  vaultState={state}
                  href={state ? `/vault/${agent.id}` : `/vault/onboarding?strategy=${agent.id}`}
                  ctaLabel={state ? "관리하기" : "이 전략에 배분하기"}
                />
                {demo && (
                  <DemoDepositButton
                    strategyId={agent.id}
                    amountUsdc={state ? 1_000 : 10_000}
                    className="rounded-xl border border-agora-orange/40 bg-agora-orange/10 px-3 py-2 text-[12px] font-semibold text-agora-orange hover:bg-agora-orange/20"
                    label={state ? "+1,000 USDC 임의 예치 (demo)" : "임의로 10,000 USDC 예치 (demo)"}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
