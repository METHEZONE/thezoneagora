"use client";

// dapp-kit 기본 <ConnectButton>(흰 배경 "Connection failed"/"Retry Connection" 모달)
// 대신, 앱 전체(헤더·DetailSheet)와 같은 커스텀 WalletConnectProvider 모달을 쓴다.
// 실패해도 막다른 화면 없이 지갑 목록이 그대로 남아 바로 재시도할 수 있고,
// 실패 원인 대부분(Manifest V3 서비스워커 콜드스타트)은 한 번 더 누르면 풀린다.
import { useState } from "react";
import { motion } from "framer-motion";
import { useWalletConnect } from "@/components/arena/WalletConnect";
import { setDemoMode } from "@/lib/vault/demo";
import { DemoDepositButton } from "@/components/vault/DemoDepositButton";

export function ConnectStep({ strategyId, amountUsdc }: { strategyId: string; amountUsdc?: number }) {
  const wallet = useWalletConnect();
  const [attempted, setAttempted] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-6 rounded-[24px] border border-white/10 bg-surface-dark px-8 py-14 text-center"
    >
      <h1 className="font-display text-xl font-bold tracking-tight text-warm-ivory">
        Sui 지갑을 연결해 주세요
      </h1>
      <p className="max-w-sm text-[14px] leading-relaxed text-muted-light">
        볼트를 만들려면 먼저 지갑을 연결해야 합니다. 연결 후 자동으로 다음
        단계로 이동합니다.
      </p>
      <button
        type="button"
        className="rounded-[12px] bg-agora-orange px-6 py-3 text-[14px] font-semibold text-arena-black transition-opacity duration-200 hover:opacity-90"
        onClick={() => {
          setAttempted(true);
          wallet.requestConnect();
        }}
      >
        지갑 연결
      </button>
      {attempted && !wallet.connected && (
        <p className="max-w-sm text-[12px] leading-relaxed text-muted-light">
          연결이 안 되면 지갑 확장 프로그램을 열어 잠금 해제한 뒤 다시 눌러 주세요. 방금 설치했다면
          한 번은 실패할 수 있어요 (확장 프로그램이 깨어나는 시간) — 바로 재시도하면 됩니다.
        </p>
      )}

      <div className="mt-2 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-light">Sui 연결이 안 되나요?</div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-light">
          지갑 없이 데모 자금으로 같은 볼트 흐름을 끝까지 볼 수 있어요. 데모 볼트는 이 브라우저에만 저장됩니다.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <DemoDepositButton
            strategyId={strategyId}
            amountUsdc={amountUsdc ?? 10_000}
            className="flex-1 rounded-[12px] border border-agora-orange/50 bg-agora-orange/10 px-4 py-2.5 text-[13px] font-semibold text-agora-orange transition-colors hover:bg-agora-orange/20"
            label={`임의로 ${(amountUsdc ?? 10_000).toLocaleString()} USDC 예치하기 (demo)`}
          />
          <button
            type="button"
            className="flex-1 rounded-[12px] border border-white/15 bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-warm-ivory transition-colors hover:bg-white/[0.08]"
            onClick={() => setDemoMode(true)}
          >
            금액 직접 정하기 (demo)
          </button>
        </div>
      </div>
    </motion.div>
  );
}
