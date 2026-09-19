"use client";

import { motion } from "framer-motion";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { AGORA_FIAT_COIN_TYPE, resolvedVaultMode } from "@/lib/config/env";
import { sanitizeUsdcInput } from "./onboardingFormat";

interface DepositStepProps {
  value: string;
  onChange: (value: string) => void;
  minUsdc: number;
  valid: boolean;
  onNext: () => void;
  /** 연결된 지갑 주소 — real 모드에서 테스트넷 USDC 잔고를 보여주기 위해 */
  owner?: string | null;
  /** 백테스트/전적 페이지에서 금액을 들고 넘어왔는지 */
  prefilled?: boolean;
}

function WalletBalance({ owner, onUseAll }: { owner: string; onUseAll: (usdc: string) => void }) {
  const coinType = AGORA_FIAT_COIN_TYPE ?? "";
  const q = useSuiClientQuery(
    "getBalance",
    { owner, coinType },
    { enabled: !!coinType, refetchInterval: 15_000 }
  );
  const raw = q.data?.totalBalance ? Number(q.data.totalBalance) / 1_000_000 : null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-muted-light">
      <span>
        테스트넷 지갑 잔고{" "}
        <b className="font-mono tabular-nums text-warm-ivory">
          {q.isLoading ? "…" : raw === null ? "0.00" : raw.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </b>{" "}
        USDC
      </span>
      <span className="flex items-center gap-3">
        {raw !== null && raw > 0 && (
          <button type="button" className="underline decoration-white/30 hover:text-warm-ivory" onClick={() => onUseAll(String(Math.floor(raw * 100) / 100))}>
            전액 넣기
          </button>
        )}
        <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer" className="underline decoration-white/30 hover:text-warm-ivory">
          USDC 받기 (Circle faucet)
        </a>
        <a href="https://faucet.sui.io/" target="_blank" rel="noreferrer" className="underline decoration-white/30 hover:text-warm-ivory">
          가스용 SUI 받기
        </a>
      </span>
    </div>
  );
}

export function DepositStep({
  value,
  onChange,
  minUsdc,
  valid,
  onNext,
  owner,
  prefilled,
}: DepositStepProps) {
  const showMinError = value.trim().length > 0 && !valid;
  const realMode = resolvedVaultMode() === "real";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[24px] border border-white/10 bg-surface-dark px-8 py-10"
    >
      <h1 className="font-display text-xl font-bold tracking-tight text-warm-ivory">
        얼마를 예치할까요?
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-light">
        Agora가 검증한 시그널로만 자동 운용되며, 출금 권한은 항상 내게
        있습니다.
      </p>

      <div className="mt-8">
        <label
          htmlFor="deposit-amount"
          className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-light"
        >
          예치 금액 (USDC)
        </label>
        <div className="mt-2 flex items-center gap-3 rounded-[12px] border border-white/10 bg-arena-black px-4 py-3">
          <input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => onChange(sanitizeUsdcInput(e.target.value))}
            className="w-full bg-transparent font-mono text-[20px] font-semibold tabular-nums text-warm-ivory outline-none placeholder:text-muted-light/60"
          />
          <span className="shrink-0 font-mono text-[13px] font-medium text-muted-light">
            USDC
          </span>
        </div>
        {showMinError ? (
          <p className="mt-2 text-[13px] text-negative">
            최소 {minUsdc} USDC 이상 입력해 주세요.
          </p>
        ) : prefilled ? (
          <p className="mt-2 text-[13px] text-muted-light">
            백테스트 금액을 그대로 가져왔어요. 테스트넷 지갑 잔고에 맞게 줄여도 됩니다 (최소 {minUsdc} USDC).
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-muted-light">
            최소 예치 금액은 {minUsdc} USDC입니다.
          </p>
        )}
        {realMode && owner && <WalletBalance owner={owner} onUseAll={onChange} />}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!valid}
          onClick={onNext}
          className="rounded-[12px] bg-agora-orange px-6 py-3 text-[14px] font-semibold text-arena-black transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          다음
        </button>
      </div>
    </motion.div>
  );
}
