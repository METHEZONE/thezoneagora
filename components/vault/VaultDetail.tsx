"use client";

import Link from "next/link";
import { useVault } from "@/lib/vault/useVault";
import { AGENTS } from "@/lib/data/seed/seasons";
import { AgentStatusBadge } from "@/components/vault/AgentStatusBadge";
import { BalanceCards } from "@/components/vault/BalanceCards";
import { VaultPerformance } from "@/components/vault/VaultPerformance";
import { ActivityFeed } from "@/components/vault/ActivityFeed";
import { ActionBar } from "@/components/vault/ActionBar";
import { CharacterRow } from "@/components/vault/CharacterRow";
import { DemoDepositButton } from "@/components/vault/DemoDepositButton";
import { DEMO_OWNER } from "@/lib/vault/demo";

/**
 * 특정 전략(strategyId) 볼트의 대시보드. /vault(mint 게스트)와 /vault/[strategyId]가 공유한다.
 * <main> 래핑은 호출부 책임 — 게스트 페이지가 이 컴포넌트 위에 다른 섹션을 함께 두므로
 * 여기서 <main>을 직접 열면 페이지에 <main>이 중첩된다.
 */
export function VaultDetail({ strategyId }: { strategyId: string }) {
  const { owner, vault, hasVault, loading, activity, actions } = useVault(strategyId);
  const agentName = AGENTS.find((a) => a.id === strategyId)?.name ?? strategyId;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-6">
        <p className="text-[13px] text-muted-light">볼트 정보를 불러오는 중…</p>
      </div>
    );
  }

  // 지갑 미연결 + 게스트 데모가 없는 전략 → 지갑 연결 유도.
  if (!owner && !vault) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center px-5 py-24 text-center lg:px-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
          {agentName}
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-warm-ivory">
          지갑을 연결해 주세요
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-light">
          이 전략은 지갑 미연결 데모가 없어요. 지갑을 연결하면 {agentName}에 바로 배분할 수
          있습니다.
        </p>
        <Link
          href={`/vault/onboarding?strategy=${strategyId}`}
          className="mt-6 rounded-xl bg-agora-orange px-6 py-3 text-[14px] font-bold text-arena-black transition-opacity hover:opacity-90"
        >
          지갑 연결하고 배분하기
        </Link>
        <DemoDepositButton
          strategyId={strategyId}
          amountUsdc={10_000}
          className="mt-3 rounded-xl border border-agora-orange/40 bg-agora-orange/10 px-5 py-2.5 text-[13px] font-semibold text-agora-orange hover:bg-agora-orange/20"
          label="Sui 없이 임의로 10,000 USDC 예치하기 (demo)"
        />
      </div>
    );
  }

  // 지갑 연결 + 볼트 없음 → 온보딩 유도.
  if (owner && hasVault === false) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center px-5 py-24 text-center lg:px-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
          {agentName}
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-warm-ivory">
          아직 이 전략에 배분한 볼트가 없습니다
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-light">
          지갑 연결을 확인했습니다. 온보딩을 완료하면 실시세 기반 라이브 전략이 내 볼트에서 바로
          동작합니다.
        </p>
        <Link
          href={`/vault/onboarding?strategy=${strategyId}`}
          className="mt-6 rounded-xl bg-agora-orange px-6 py-3 text-[14px] font-bold text-arena-black transition-opacity hover:opacity-90"
        >
          볼트 만들기
        </Link>
        <DemoDepositButton
          strategyId={strategyId}
          amountUsdc={10_000}
          className="mt-3 rounded-xl border border-agora-orange/40 bg-agora-orange/10 px-5 py-2.5 text-[13px] font-semibold text-agora-orange hover:bg-agora-orange/20"
          label="임의로 10,000 USDC 예치하기 (demo)"
        />
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-6">
        <p className="text-[13px] text-muted-light">볼트 정보를 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-6">
      {vault.isGuest && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-agora-orange/30 bg-agora-orange/10 px-4 py-3">
          <p className="text-[13px] font-medium text-agora-orange">
            데모 볼트 — 지갑을 연결하면 내 볼트를 만들 수 있어요
          </p>
          <DemoDepositButton
            strategyId={strategyId}
            amountUsdc={10_000}
            className="rounded-xl bg-agora-orange px-4 py-2 text-[12px] font-bold text-arena-black hover:opacity-90"
            label="Sui 없이 임의로 10,000 USDC 예치 (demo)"
          />
        </div>
      )}
      {owner === DEMO_OWNER && !vault.isGuest && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-agora-orange/30 bg-agora-orange/10 px-4 py-3">
          <p className="text-[13px] font-medium text-agora-orange">
            DEMO — 지갑 없이 임의 자금으로 만든 mock 볼트입니다. 입금·출금·긴급탈출 전부 이 브라우저 안에서만 동작해요.
          </p>
          <DemoDepositButton
            strategyId={strategyId}
            amountUsdc={1_000}
            className="rounded-xl border border-agora-orange/40 bg-agora-orange/10 px-4 py-2 text-[12px] font-semibold text-agora-orange hover:bg-agora-orange/20"
            label="+1,000 USDC 임의 예치 (demo)"
          />
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CharacterRow size={56} className="hidden md:flex" />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
              {vault.isGuest ? "데모 볼트" : "내 볼트"}
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-warm-ivory">
              {agentName} 볼트
            </h1>
          </div>
        </div>
        <AgentStatusBadge status={vault.agentStatus} />
      </header>

      <div className="mb-6">
        <BalanceCards vault={vault} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <VaultPerformance vault={vault} />
        <ActivityFeed activity={activity} />
      </div>

      {!vault.isGuest && owner && (
        <div className="mt-6">
          <ActionBar vault={vault} actions={actions} />
        </div>
      )}
    </div>
  );
}
