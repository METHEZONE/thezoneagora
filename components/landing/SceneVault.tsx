"use client";

import { motion } from "framer-motion";
import { useVault } from "@/lib/vault/useVault";
import { AgentStatusBadge } from "@/components/vault/AgentStatusBadge";
import { BalanceCards } from "@/components/vault/BalanceCards";
import { VaultPerformance } from "@/components/vault/VaultPerformance";
import { ActivityFeed } from "@/components/vault/ActivityFeed";
import { EmergencyExitModal } from "@/components/vault/EmergencyExitModal";
import { RiskPolicySettings } from "@/components/vault/settings/RiskPolicySettings";
import { Frame, FramePlaceholder } from "./Frame";
import { SceneGate } from "./SceneGate";
import { useMounted, useMotionOk } from "./useMotionOk";

const EASE = [0.22, 1, 0.36, 1] as const;
const noopVault = async () => {
  throw new Error("landing demo");
};

/** 게스트 데모 볼트 대시보드 — app/vault 페이지와 같은 실제 컴포넌트 조립. */
function VaultDashboardFrame() {
  const { vault, activity } = useVault("mint");

  if (!vault) return <FramePlaceholder height={700} />;

  return (
    <Frame url="thezonebio.com/agora/vault" cropHeight={700}>
      <div className="ag-dark" style={{ padding: "24px 24px 8px" }}>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
              데모 볼트
            </div>
            <div className="mt-1 font-display text-2xl font-bold tracking-tight text-warm-ivory">
              볼트 대시보드
            </div>
          </div>
          <AgentStatusBadge status={vault.agentStatus} />
        </header>
        <div className="mb-5">
          <BalanceCards vault={vault} />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
          <VaultPerformance vault={vault} />
          <ActivityFeed activity={activity} />
        </div>
      </div>
    </Frame>
  );
}

function SettingsFrame() {
  return (
    <div>
      <Frame url="thezonebio.com/agora/vault/settings" cropHeight={600} isStatic>
        <div className="ag-dark" style={{ padding: "24px" }}>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-light">
            리스크 설정
          </div>
          <div className="mb-5 mt-1 font-display text-xl font-bold tracking-tight text-warm-ivory">
            실행 정책 설정
          </div>
          <RiskPolicySettings />
        </div>
      </Frame>
      <p className="ag-caption">
        <b>한도는 내가 정합니다.</b> 1회 거래, epoch 누적, 손실 한도와 킬 스위치
        조건까지 12개 필드가 볼트에 저장됩니다.
      </p>
    </div>
  );
}

function EmergencyFrame() {
  const { vault } = useVault("mint");

  if (!vault) return <FramePlaceholder height={600} />;

  return (
    <div>
      <Frame url="thezonebio.com/agora/vault · 긴급 출구" cropHeight={600} isStatic>
        <div className="ag-dark" style={{ padding: "24px", minHeight: 600 }}>
          <div className="opacity-40">
            <BalanceCards vault={vault} />
          </div>
          <EmergencyExitModal
            open
            onClose={() => undefined}
            vault={vault}
            onLiquidateAll={noopVault}
            onPauseAndWithdraw={noopVault}
          />
        </div>
      </Frame>
      <p className="ag-caption">
        <b>마지막 출구도 내 것입니다.</b> 서명 한 번으로 전량 청산 또는 에이전트
        정지 후 USDC 전액 회수. 확인 문구를 입력해야 실행됩니다.
      </p>
    </div>
  );
}

export function SceneVault() {
  const mounted = useMounted();
  const motionOk = useMotionOk();

  return (
    <section className="ag-scene" id="vault">
      <div className="ag-wrap">
        <div className="ag-scene-head">
          <motion.span
            className="ag-thread"
            initial={motionOk ? { scaleX: 0 } : false}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: EASE }}
            aria-hidden="true"
          />
          <h2 className="ag-display ag-h2">
            돈이 아니라
            <br />
            권한을 위임합니다.
          </h2>
          <p className="ag-lede">
            에이전트는 신호만 보낼 수 있습니다. 신호는 볼트에 새겨 둔 정책을
            통과해야 체결되고, 돈은 처음부터 끝까지 내 볼트 안에 있습니다. 직접
            눌러 보세요.
          </p>
        </div>

        <SceneGate />

        <div className="ag-vault-main">
          {mounted ? <VaultDashboardFrame /> : <FramePlaceholder height={700} />}
          <p className="ag-caption">
            <b>실제 볼트 대시보드입니다.</b> 지갑 없이 열어 둔 게스트 데모 볼트라
            잔액은 데모 값이지만, 활동 피드에는 라이브 페이퍼 엔진의 신호 수신,
            검증, 거부, 체결이 그대로 흐릅니다.
          </p>
        </div>

        <div className="ag-vault-duo">
          {mounted ? (
            <>
              <SettingsFrame />
              <EmergencyFrame />
            </>
          ) : (
            <>
              <FramePlaceholder height={600} />
              <FramePlaceholder height={600} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
