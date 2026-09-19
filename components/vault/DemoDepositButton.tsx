"use client";

// "임의로 자금 예치하기 (demo)" — Sui 지갑 없이 mock 볼트를 만들고(또는 이미 있으면 추가 입금)
// 곧바로 /vault/[strategyId] 대시보드로 보낸다. 데모 플래그를 켜므로 이후 볼트 화면들은 전부 mock 소스.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_OWNER, setDemoMode } from "@/lib/vault/demo";
import { getVaultDataSource } from "@/lib/vault";

export function DemoDepositButton({
  strategyId,
  amountUsdc = 10_000,
  label,
  className = "btn ghost",
  onDone,
}: {
  strategyId: string;
  amountUsdc?: number;
  label?: string;
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      setDemoMode(true);
      const source = getVaultDataSource();
      const amount = BigInt(Math.max(10, Math.round(amountUsdc))) * 1_000_000n;
      const exists = await source.hasVault(DEMO_OWNER, strategyId);
      if (exists) await source.depositMore(DEMO_OWNER, strategyId, amount);
      else await source.createVault(DEMO_OWNER, strategyId, { depositAmount: amount });
      onDone?.();
      router.push(`/vault/${strategyId}?demo=1`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "데모 예치에 실패했어요");
      setBusy(false);
    }
  }

  return (
    <span className="demo-deposit">
      <button type="button" className={className} onClick={run} disabled={busy} title="Sui 지갑 없이 mock 볼트에 임의 자금을 넣어 전체 흐름을 체험합니다">
        {busy ? "데모 볼트 준비 중…" : label ?? `임의로 ${amountUsdc.toLocaleString()} USDC 예치하기 (demo)`}
      </button>
      {err && <small className="demo-deposit-err">{err}</small>}
    </span>
  );
}
