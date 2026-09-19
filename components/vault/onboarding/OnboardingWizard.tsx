"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault/useVault";
import { AGENTS } from "@/lib/data/seed/seasons";
import { StepIndicator } from "./StepIndicator";
import { ConnectStep } from "./ConnectStep";
import { DepositStep } from "./DepositStep";
import { ConfirmStep } from "./ConfirmStep";
import { CompleteScreen } from "./CompleteScreen";
import { parseUsdcInput } from "./onboardingFormat";

const MIN_DEPOSIT_USDC = 10;
const MIN_DEPOSIT_BASE_UNITS = BigInt(MIN_DEPOSIT_USDC) * 1_000_000n;
const REDIRECT_DELAY_MS = 1200;
const DEFAULT_STRATEGY_ID = "mint";

type Step = 1 | 2 | 3;

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const strategyId = searchParams.get("strategy") ?? DEFAULT_STRATEGY_ID;
  const agentName = AGENTS.find((a) => a.id === strategyId)?.name ?? strategyId;
  const { owner, hasVault, loading, actions } = useVault(strategyId);

  // 백테스트/전적 페이지에서 "이 결과로 맡기기"로 넘어오면 금액이 프리필된다 (?amount=10000).
  const amountParam = searchParams.get("amount");
  const prefilled =
    amountParam && /^\d+$/.test(amountParam) && Number(amountParam) >= MIN_DEPOSIT_USDC
      ? String(Math.min(Number(amountParam), 1_000_000))
      : "";

  const [step, setStep] = useState<Step>(1);
  const [depositInput, setDepositInput] = useState(prefilled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // 이미 볼트가 있는 지갑은 온보딩을 건너뛴다. 지갑이 연결되면 자동으로 예치 단계로 이동한다.
  useEffect(() => {
    if (loading || completed) return;
    if (owner && hasVault) {
      router.replace(`/vault/${strategyId}`);
      return;
    }
    if (owner && step === 1) {
      setStep(2);
    }
    if (!owner && step !== 1) {
      setStep(1);
    }
  }, [owner, hasVault, loading, completed, step, router, strategyId]);

  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => router.push(`/vault/${strategyId}`), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [completed, router, strategyId]);

  const depositAmount = parseUsdcInput(depositInput);
  const depositValid =
    depositAmount !== null && depositAmount >= MIN_DEPOSIT_BASE_UNITS;

  const handleCreateVault = async () => {
    if (!depositAmount) return;
    setSubmitting(true);
    setError(null);
    try {
      await actions.createVault({ depositAmount });
      setCompleted(true);
    } catch {
      setError("볼트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-arena-black px-5 py-12 lg:px-6">
        <div className="w-full max-w-[480px]">
          <CompleteScreen />
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-arena-black px-5 py-12 lg:px-6">
        <p className="text-[14px] text-muted-light">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-arena-black px-5 py-16 lg:px-6">
      <div className="mx-auto max-w-[480px]">
        <StepIndicator step={step} />

        {step === 1 && <ConnectStep />}

        {step === 2 && (
          <DepositStep
            value={depositInput}
            onChange={setDepositInput}
            minUsdc={MIN_DEPOSIT_USDC}
            valid={depositValid}
            onNext={() => setStep(3)}
            owner={owner}
            prefilled={prefilled !== "" && depositInput === prefilled}
          />
        )}

        {step === 3 && depositAmount !== null && (
          <ConfirmStep
            strategyId={strategyId}
            agentName={agentName}
            depositAmount={depositAmount}
            submitting={submitting}
            error={error}
            onBack={() => setStep(2)}
            onConfirm={handleCreateVault}
          />
        )}
      </div>
    </main>
  );
}
