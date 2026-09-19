"use client";

import Link from "next/link";
import { AgentCharacter } from "@/components/arena/characters";
import { CopyableAddress } from "@/components/vault/CopyableAddress";
import { formatUsdc } from "@/components/vault/format";
import { pseudoVaultAddress } from "@/lib/vault/pseudoAddress";
import type { VaultState } from "@/lib/vault/types";

/** /vault 목록 페이지의 전략 카드. 볼트 보유 여부에 따라 잔액 요약과 CTA가 바뀐다. */
export function StrategyCard({
  agentId,
  name,
  tagline,
  vaultState,
  href,
  ctaLabel,
}: {
  agentId: string;
  name: string;
  tagline: string;
  vaultState?: VaultState | null;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-surface-dark p-5">
      <div className="flex items-center gap-3">
        <AgentCharacter agentId={agentId} size={44} bob={false} label={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-warm-ivory">{name}</div>
          <span className="mt-1 inline-block rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-light">
            온체인 실행 · Sui Testnet
          </span>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted-light">{tagline}</p>

      <CopyableAddress
        address={vaultState?.vaultId ?? pseudoVaultAddress(agentId)}
        label={vaultState?.vaultId ? "볼트 주소" : "배분 예정 주소"}
      />

      <div className="flex-1" />

      {vaultState && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-light">
            USDC 잔액
          </div>
          <div className="tabular-nums mt-0.5 text-[15px] font-bold text-warm-ivory">
            {formatUsdc(vaultState.fiatBalance)}
          </div>
        </div>
      )}

      <Link
        href={href}
        className="mt-4 flex min-h-[40px] items-center justify-center rounded-xl bg-agora-orange px-4 text-[13px] font-semibold text-arena-black transition-opacity hover:opacity-90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
