"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/lib/vault/useVault";
import { AGENTS } from "@/lib/data/seed/seasons";
import { getVaultDataSource } from "@/lib/vault";
import { DEMO_OWNER, isDemoMode, setDemoMode } from "@/lib/vault/demo";
import { StepIndicator } from "./StepIndicator";
import { ConnectStep } from "./ConnectStep";
import { DepositStep } from "./DepositStep";
import { ConfirmStep } from "./ConfirmStep";
import { CompleteScreen } from "./CompleteScreen";
import { parseUsdcInput } from "./onboardingFormat";

const MIN_DEPOSIT_USDC = 5; // 사용자 피드백(2026-09-19): Circle 테스트넷 파우셋이 2시간마다 20 USDC로 제한돼 있어 10 USDC 최소는 체험 여지가 너무 좁았다.
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
  // 실제(Sui 온체인) 생성이 막 실패했고 지금은 데모 모드가 아닐 때만 켠다 —
  // "실패하면 임의 자금으로 대신 만들지" 물어보는 제안 배너용 플래그.
  const [offerDemoFallback, setOfferDemoFallback] = useState(false);
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
    setOfferDemoFallback(false);
    try {
      await actions.createVault({ depositAmount });
      setCompleted(true);
    } catch (err) {
      // 임시 진단 로그: 원인이 뭐든 화면엔 항상 같은 문구만 떠서 지갑 미연결/서명
      // 거부/RPC 실패/온체인 revert를 구분할 수 없었다. 원인 확인되면 지워도 된다.
      console.error("[Agora] createVault failed:", err);
      setError("볼트 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      // 이미 데모 모드였다면(=데모 볼트 생성 자체가 실패) 데모를 다시 제안할 이유가 없다.
      setOfferDemoFallback(!isDemoMode());
    } finally {
      setSubmitting(false);
    }
  };

  // "그냥 임의로(데모) 만들어줘" — 실제 온체인 시도가 막혔을 때(지갑 문제, 테스트넷
  // RPC 장애, USDC 잔고 부족 등 원인 불문) 곧바로 mock 볼트로 우회해 온보딩을 끝낸다.
  // setDemoMode(true) 이후 useVault()의 source가 리렌더에서 Mock으로 바뀌긴 하지만
  // 이 클릭 핸들러 안에서는 아직 그 리렌더 전이라 actions.createVault(연결된 real
  // source)를 그대로 쓰면 안 된다 — getVaultDataSource()를 직접 다시 불러 확실히
  // mock 인스턴스를 받는다.
  const handleUseDemoInstead = async () => {
    if (!depositAmount) return;
    setSubmitting(true);
    setError(null);
    try {
      setDemoMode(true);
      const demoSource = getVaultDataSource();
      await demoSource.createVault(owner ?? DEMO_OWNER, strategyId, { depositAmount });
      setCompleted(true);
    } catch (err) {
      console.error("[Agora] demo fallback createVault failed:", err);
      setError("데모 볼트 생성도 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setOfferDemoFallback(false);
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

        {step === 1 && <ConnectStep strategyId={strategyId} amountUsdc={prefilled ? Number(prefilled) : undefined} />}

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
            offerDemoFallback={offerDemoFallback}
            onBack={() => setStep(2)}
            onConfirm={handleCreateVault}
            onUseDemoInstead={handleUseDemoInstead}
          />
        )}
      </div>
    </main>
  );
}
